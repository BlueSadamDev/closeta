import { afterEach, describe, expect, it, vi } from 'vitest';

import relais, { type Env } from '../src/index';
import { cleQuota, Compteur, lireLimite, moisDe } from '../src/quota';
import lens from './fixtures/lens.json';
import shopping from './fixtures/shopping.json';
import { magasin } from './kv';

const JETON = 'jeton-fictif-de-test';
const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const DESCRIPTION_IA = { type: 'vetement', categorie: 'Veste', couleur: 'marron', recherche: 'veste velours marron' };
const CE_MOIS = () => cleQuota(moisDe(new Date()));

function env(quota: Record<string, string> = {}, limite?: string) {
  const kv = magasin(quota);
  const e: Env = {
    RELAY_TOKEN: JETON,
    SERPAPI_KEY: 'cle-fictive',
    LIMITEUR: { limit: async () => ({ success: true }) },
    AI: { run: async () => ({ choices: [{ message: { content: JSON.stringify(DESCRIPTION_IA) } }] }) },
    PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
    QUOTA: kv,
    SERPAPI_LIMITE_MOIS: limite,
  };
  return { e, kv };
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

  it('compte chaque recherche dans la case du mois, qui s’efface après 40 jours', async () => {
    const kv = magasin();
    const c = new Compteur(kv, 250, () => new Date('2026-11-15T12:00:00Z'));
    expect(await c.etat()).toEqual({ utilise: 0, limite: 250, mois: '2026-11' });
    expect(await c.reserver()).toBe(true);
    expect(await c.reserver()).toBe(true);
    expect(await c.etat()).toEqual({ utilise: 2, limite: 250, mois: '2026-11' });
    expect(kv.put).toHaveBeenLastCalledWith('serpapi:2026-11', '2', { expirationTtl: 40 * 24 * 3600 });
  });

  it('repart de zéro le mois suivant', async () => {
    const kv = magasin({ 'serpapi:2026-11': '250' });
    const c = new Compteur(kv, 250, () => new Date('2026-12-01T08:00:00Z'));
    expect((await c.etat()).utilise).toBe(0);
    expect(await c.reserver()).toBe(true);
  });

  it('refuse de réserver au seuil, sans rien compter', async () => {
    const kv = magasin({ 'serpapi:2026-11': '250' });
    const c = new Compteur(kv, 250, () => new Date('2026-11-15T12:00:00Z'));
    expect(await c.atteint()).toBe(true);
    expect(await c.reserver()).toBe(false);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('traite une case illisible comme zéro', async () => {
    const c = new Compteur(magasin({ 'serpapi:2026-11': 'abc' }), 250, () => new Date('2026-11-15T12:00:00Z'));
    expect((await c.etat()).utilise).toBe(0);
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
    const { e, kv } = env();
    vi.stubGlobal('fetch', vi.fn(async (a: string) => jsonOk(a.includes('google_lens') ? lens : shopping)));
    expect((await relais.fetch(envoiPhoto(), e)).status).toBe(200);
    expect(kv.cases.get(CE_MOIS())).toBe('2');
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
    const { e, kv } = env({ [CE_MOIS()]: '249' });
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
    expect(kv.cases.get(CE_MOIS())).toBe('250');
  });
});
