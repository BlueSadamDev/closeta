import { afterEach, describe, expect, it, vi } from 'vitest';

import relais, { type Env } from '../src/index';
import { RegistreSupervision, routeDuJournal } from '../src/supervision';
import { magasin } from './kv';
import { baseSql, espaceQuota } from './quotaObjet';

// Valeurs fictives, propres aux tests : aucune ne doit apparaître dans le journal.
const JETON = 'jeton-partage-fictif';
const JETON_ADMIN = 'jeton-admin-fictif';
const ID_APP = '0f8fad5b-d9cb-469f-a165-70867728950e';
const IP = '203.0.113.42';
const ID_PHOTO = 'a'.repeat(64);
const PAGE = 'https://boutique.exemple.test/produit/veste-secrete?ref=lea';

function env() {
  const kv = magasin();
  const e: Env = {
    RELAY_TOKEN: JETON,
    ADMIN_TOKEN: JETON_ADMIN,
    LIMITEUR: { limit: async () => ({ success: true }) },
    AI: { run: async () => ({}) },
    PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
    QUOTA: kv,
    QUOTAS: espaceQuota(kv).espace,
  };
  return e;
}

const requete = (chemin: string, options: { methode?: string; jeton?: string; corps?: unknown } = {}) =>
  new Request(`https://relais.exemple.test${chemin}`, {
    method: options.methode ?? 'GET',
    headers: {
      authorization: `Bearer ${options.jeton ?? JETON}`,
      'content-type': 'application/json',
      'x-closeta-installation': ID_APP,
      'cf-connecting-ip': IP,
    },
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
  });

describe('supervision : journal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('nomme les routes par un modèle, sans identifiant ni adresse inconnue', () => {
    expect(routeDuJournal('GET', `/v1/photo/${ID_PHOTO}`)).toBe('GET /v1/photo/:id');
    expect(routeDuJournal('GET', `/photo/${ID_PHOTO}`)).toBe('GET /v1/photo/:id');
    expect(routeDuJournal('DELETE', `/v1/admin/installations/${ID_APP}`)).toBe('DELETE /v1/admin/installations/:id');
    expect(routeDuJournal('POST', '/extract')).toBe('POST /v1/extract');
    expect(routeDuJournal('GET', '/v1/admin/etat')).toBe('GET /v1/admin/etat');
    expect(routeDuJournal('GET', '/une/adresse/lea@exemple.test')).toBe('GET autre');
  });

  it('n’écrit jamais de jeton, d’identifiant, d’adresse IP, d’URL de photo ni de page', async () => {
    const lignes: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void lignes.push(args.map(String).join(' ')));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const e = env();
    await relais.fetch(requete('/v1/extract', { methode: 'POST', corps: { url: PAGE } }), e);
    await relais.fetch(requete('/v1/quota'), e);
    await relais.fetch(requete(`/v1/photo/${ID_PHOTO}`), e);
    await relais.fetch(requete(`/v1/admin/installations/${ID_APP}`, { methode: 'DELETE', jeton: JETON_ADMIN }), e);
    await relais.fetch(requete('/v1/quota', { jeton: 'jeton-inconnu-fictif' }), e);

    expect(lignes).toHaveLength(5);
    const journal = lignes.join('\n');
    for (const interdit of [JETON, JETON_ADMIN, 'jeton-inconnu-fictif', ID_APP, IP, ID_PHOTO, PAGE, 'boutique.exemple.test', 'lea']) {
      expect(journal).not.toContain(interdit);
    }
    for (const ligne of lignes) {
      const entree = JSON.parse(ligne) as Record<string, unknown>;
      expect(Object.keys(entree).every((k) => ['route', 'statut', 'duree_ms', 'depuis_cache', 'erreur'].includes(k))).toBe(true);
    }
    expect(JSON.parse(lignes[0])).toMatchObject({ route: 'POST /v1/extract', statut: 502, erreur: 'page_illisible' });
    expect(JSON.parse(lignes[4])).toMatchObject({ route: 'GET /v1/quota', statut: 403, erreur: 'jeton_refuse' });
  });

  it('laisse Cloudflare finir la supervision après la réponse (waitUntil)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const enAttente: Promise<unknown>[] = [];
    const reponse = await relais.fetch(requete('/v1/quota'), env(), { waitUntil: (p) => void enAttente.push(p) });
    expect(reponse.status).toBe(200);
    expect(enAttente).toHaveLength(1);
    await Promise.all(enAttente);
  });
});

describe('supervision : GET /v1/admin/etat', () => {
  afterEach(() => vi.restoreAllMocks());

  it('compte requêtes, réponses depuis le catalogue et erreurs des dernières 24 h', () => {
    const r = new RegistreSupervision(baseSql());
    const t = new Date('2026-11-26T10:00:00Z');
    r.noter(true, false, t);
    r.noter(false, false, t);
    r.noter(null, true, t);
    r.noter(true, false, new Date(t.getTime() - 30 * 3600_000)); // plus de 24 h : hors période
    expect(r.lire(t)).toEqual({ requetes: 3, avec_cache_possible: 2, depuis_cache: 1, erreurs: 1 });
  });

  it('renvoie le quota global du mois et les chiffres de supervision, avec le jeton d’administration', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const e = env();
    await relais.fetch(requete('/v1/quota'), e);
    const reponse = await relais.fetch(requete('/v1/admin/etat', { jeton: JETON_ADMIN }), e);
    expect(reponse.status).toBe(200);
    const corps = (await reponse.json()) as Record<string, unknown>;
    expect(corps).toMatchObject({ quota: { utilise: 0, limite: 250 }, periode_heures: 24, requetes: 1, erreurs: 0 });
    expect(corps.cache).toEqual({ reponses: 0, depuis_cache: 0, taux: null });
    expect((await relais.fetch(requete('/v1/admin/etat'), e)).status).toBe(403);
  });
});
