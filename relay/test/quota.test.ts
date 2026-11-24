import { afterEach, describe, expect, it, vi } from 'vitest';

import relais, { type Env } from '../src/index';
import { cleQuota, lireLimite, moisAvant, moisDe } from '../src/quota';
import lens from './fixtures/lens.json';
import shopping from './fixtures/shopping.json';
import { magasin } from './kv';
import { espaceQuota } from './quotaObjet';

const JETON = 'jeton-fictif-de-test';
const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const DESCRIPTION_IA = { type: 'vetement', categorie: 'Veste', couleur: 'marron', recherche: 'veste velours marron' };
const CE_MOIS = () => cleQuota(moisDe(new Date()));

function env(quota: Record<string, string> = {}, limite?: string) {
  const kv = magasin(quota);
  const objet = espaceQuota(kv);
  const e: Env = {
    RELAY_TOKEN: JETON,
    SERPAPI_KEY: 'cle-fictive',
    LIMITEUR: { limit: async () => ({ success: true }) },
    AI: { run: async () => ({ choices: [{ message: { content: JSON.stringify(DESCRIPTION_IA) } }] }) },
    PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
    QUOTA: kv,
    QUOTAS: objet.espace,
    SERPAPI_LIMITE_MOIS: limite,
  };
  return { e, kv, compte: objet.compte };
}

const lireQuota = (jeton: string | null = JETON) =>
  new Request('https://relais.exemple.test/quota', { headers: jeton ? { authorization: `Bearer ${jeton}` } : {} });

const envoiPhoto = () =>
  new Request('https://relais.exemple.test/identify', {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg', authorization: `Bearer ${JETON}` },
    body: PHOTO,
  });

const jsonOk = (corps: unknown) => new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('compteur SerpApi', () => {
  it('suit le mois du calendrier à l’heure de Paris', () => {
    expect(moisDe(new Date('2026-11-15T12:00:00Z'))).toBe('2026-11');
    // 30 novembre 23 h 30 UTC = 1er décembre 0 h 30 à Paris : nouveau mois.
    expect(moisDe(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12');
    expect(moisDe(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01');
  });

  it('lit le seuil de wrangler.toml, 250 par défaut', () => {
    expect(lireLimite('100')).toBe(100);
    expect(lireLimite(undefined)).toBe(250);
    expect(lireLimite('')).toBe(250);
    expect(lireLimite('beaucoup')).toBe(250);
    expect(lireLimite('-3')).toBe(250);
  });

  it('calcule le mois d’avant, y compris en changeant d’année', () => {
    expect(moisAvant('2026-11', 1)).toBe('2026-10');
    expect(moisAvant('2026-01', 1)).toBe('2025-12');
    expect(moisAvant('2026-01', 2)).toBe('2025-11');
  });
});

const NOV = () => new Date('2026-11-15T12:00:00Z');
const LIMITES = { global: 250, installation: 250 };

describe('Durable Object Quota', () => {
  it('compte chaque recherche dans la case de l’installation et dans la case globale', async () => {
    const { objet, compte } = espaceQuota(magasin(), NOV);
    expect(await objet.reserver('tel-a', LIMITES)).toBe(true);
    expect(await objet.reserver('tel-b', LIMITES)).toBe(true);
    expect(await objet.reserver('tel-a', LIMITES)).toBe(true);
    expect(compte()).toBe(3);
    expect(compte('tel-a')).toBe(2);
    expect(await objet.etat('tel-b', LIMITES)).toEqual({
      installation: { utilise: 1, limite: 250 },
      global: { utilise: 3, limite: 250 },
      mois: '2026-11',
    });
  });

  it('réservations simultanées : chacune comptée exactement une fois, jamais au-delà du seuil', async () => {
    const { objet, compte } = espaceQuota(magasin(), NOV);
    const limites = { global: 7, installation: 250 };
    const reponses = await Promise.all(
      Array.from({ length: 10 }, (_, i) => objet.reserver(i % 2 ? 'tel-a' : 'tel-b', limites)),
    );
    expect(reponses.filter(Boolean)).toHaveLength(7);
    expect(compte()).toBe(7);
    expect(compte('tel-a') + compte('tel-b')).toBe(7);
  });

  it('seuil global : refusé pour tout le monde, sans rien compter', async () => {
    const { objet, compte } = espaceQuota(magasin(), NOV);
    const limites = { global: 2, installation: 250 };
    expect(await objet.reserver('tel-a', limites)).toBe(true);
    expect(await objet.reserver('tel-a', limites)).toBe(true);
    expect(await objet.reserver('tel-b', limites)).toBe(false);
    expect(compte()).toBe(2);
    expect(compte('tel-b')).toBe(0);
  });

  it('seuil par installation : refusée, sans toucher au global ; les autres continuent', async () => {
    const { objet, compte } = espaceQuota(magasin(), NOV);
    const limites = { global: 250, installation: 1 };
    expect(await objet.reserver('tel-a', limites)).toBe(true);
    expect(await objet.reserver('tel-a', limites)).toBe(false);
    expect(compte()).toBe(1);
    expect(await objet.reserver('tel-b', limites)).toBe(true);
    expect(compte()).toBe(2);
  });

  it('repart de zéro le mois suivant et efface les mois trop anciens', async () => {
    let maintenant = new Date('2026-10-15T12:00:00Z');
    const { objet, compte } = espaceQuota(magasin(), () => maintenant);
    expect(await objet.reserver('tel-a', LIMITES)).toBe(true);
    maintenant = new Date('2026-11-30T23:30:00Z'); // 1er décembre à Paris
    expect((await objet.etat('tel-a', LIMITES)).global).toEqual({ utilise: 0, limite: 250 });
    expect(await objet.reserver('tel-a', LIMITES)).toBe(true);
    expect(compte(undefined, '2026-12')).toBe(1);
    expect(compte(undefined, '2026-10')).toBe(0); // octobre effacé (on garde novembre et décembre)
  });

  it('reprise : les compteurs KV du mois sont recopiés une seule fois, sans remise à zéro', async () => {
    const kv = magasin({
      'serpapi:2026-11': '37',
      'serpapi:2026-11:tel-a': '30',
      'serpapi:2026-11:tel-b': 'illisible',
      'serpapi:2026-10': '250',
      'jeton:abc': 'tel-a',
    });
    const { objet, compte } = espaceQuota(kv, NOV);
    // Deux demandes simultanées au premier appel : une seule reprise.
    await Promise.all([objet.reserver('tel-a', LIMITES), objet.etat('tel-b', LIMITES)]);
    expect(compte()).toBe(38);
    expect(compte('tel-a')).toBe(31);
    expect(compte('tel-b')).toBe(0);
    expect(compte(undefined, '2026-10')).toBe(0); // autre mois : ignoré
    // KV modifié ensuite (ancien Worker encore actif) : plus relu.
    kv.cases.set('serpapi:2026-11', '200');
    await objet.reserver('tel-a', LIMITES);
    expect(compte()).toBe(39);
    expect(kv.list).toHaveBeenCalledTimes(1);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('liste les recherches du mois de plusieurs installations en un appel', async () => {
    const { objet } = espaceQuota(magasin({ 'serpapi:2026-11:tel-a': '4' }), NOV);
    expect(await objet.utilises(['tel-a', 'tel-b'])).toEqual({ mois: '2026-11', utilises: { 'tel-a': 4, 'tel-b': 0 } });
  });
});

describe('relais : GET /quota', () => {
  it('refuse sans jeton', async () => {
    expect((await relais.fetch(lireQuota(null), env().e)).status).toBe(401);
  });

  it('renvoie les recherches du mois et le seuil réglé', async () => {
    const { e } = env({ [CE_MOIS()]: '37' }, '300');
    const r = await relais.fetch(lireQuota(), e);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      installation: { utilise: 0, limite: 300 },
      global: { utilise: 37, limite: 300 },
      mois: moisDe(new Date()),
    });
  });
});

describe('relais : /identify et le compteur', () => {
  it('compte une recherche Lens et une recherche Shopping', async () => {
    const { e, compte } = env();
    vi.stubGlobal('fetch', vi.fn(async (a: string) => jsonOk(a.includes('google_lens') ? lens : shopping)));
    expect((await relais.fetch(envoiPhoto(), e)).status).toBe(200);
    expect(compte()).toBe(2);
  });

  it('au seuil : répond « quota_atteint » sans appeler SerpApi ni l’IA', async () => {
    const { e } = env({ [CE_MOIS()]: '250' });
    const espion = vi.fn();
    vi.stubGlobal('fetch', espion);
    const ia = vi.spyOn(e.AI, 'run');
    const r = await relais.fetch(envoiPhoto(), e);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ erreur: 'quota_atteint' });
    expect(espion).not.toHaveBeenCalled();
    expect(ia).not.toHaveBeenCalled();
  });

  it('seuil atteint après Lens : Shopping est sauté, les résultats de Lens restent', async () => {
    const { e, compte } = env({ [CE_MOIS()]: '249' });
    const moteurs: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (a: string) => {
        moteurs.push(new URL(a).searchParams.get('engine') ?? '');
        return jsonOk(lens);
      }),
    );
    const r = await relais.fetch(envoiPhoto(), e);
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { resultats: unknown[]; incidents?: string[] };
    expect(corps.resultats).toHaveLength(2);
    expect(corps.incidents).toContain('quota_atteint');
    expect(moteurs).toEqual(['google_lens']);
    expect(compte()).toBe(250);
  });
});
