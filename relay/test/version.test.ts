import { afterEach, describe, expect, it, vi } from 'vitest';

import relais, { type Env } from '../src/index';
import { lireDepot, lireDerniereRelease, lireRedirection } from '../src/version';
import { magasin } from './kv';
import { espaceQuota } from './quotaObjet';

// Dépôt et jeton fictifs.
const DEPOT = 'exemple/closeta-test';
const JETON = 'jeton-partage-fictif';

const redirection = (location: string | null, statut = 302) =>
  new Response(null, { status: statut, headers: location ? { location } : {} });

describe('lecture de la dernière release', () => {
  it('lit l’étiquette vX.Y.Z vers laquelle GitHub renvoie', () => {
    expect(lireRedirection(DEPOT, `https://github.com/${DEPOT}/releases/tag/v1.2.0`)).toEqual({
      derniere: '1.2.0',
      url: `https://github.com/${DEPOT}/releases/tag/v1.2.0`,
    });
    expect(lireRedirection(DEPOT, `/${DEPOT}/releases/tag/2.0.1`).derniere).toBe('2.0.1');
  });

  it('ignore une liste sans release, un autre dépôt, un autre site ou une étiquette qui n’est pas une version', () => {
    expect(lireRedirection(DEPOT, `https://github.com/${DEPOT}/releases`).derniere).toBeNull();
    expect(lireRedirection(DEPOT, 'https://github.com/autre/depot/releases/tag/v9.9.9').derniere).toBeNull();
    expect(lireRedirection(DEPOT, `https://exemple.test/${DEPOT}/releases/tag/v1.2.0`).derniere).toBeNull();
    expect(lireRedirection(DEPOT, `https://github.com/${DEPOT}/releases/tag/essai`).derniere).toBeNull();
    expect(lireRedirection(DEPOT, null).derniere).toBeNull();
  });

  it('vérifie le nom du dépôt', () => {
    expect(lireDepot(' exemple/closeta-test ')).toBe(DEPOT);
    expect(lireDepot('')).toBeNull();
    expect(lireDepot('https://github.com/exemple/x')).toBeNull();
    expect(lireDepot(undefined)).toBeNull();
  });

  it('distingue « aucune release » (gardé) de « GitHub ne répond pas » (null)', async () => {
    expect(await lireDerniereRelease(DEPOT, async () => redirection(`https://github.com/${DEPOT}/releases`))).toEqual({
      derniere: null,
      url: null,
    });
    expect(await lireDerniereRelease(DEPOT, async () => new Response('', { status: 503 }))).toBeNull();
    expect(
      await lireDerniereRelease(DEPOT, async () => {
        throw new Error('réseau');
      }),
    ).toBeNull();
  });
});

describe('GET /v1/version', () => {
  afterEach(() => vi.unstubAllGlobals());

  function env(vars: Partial<Env> = {}) {
    const kv = magasin();
    const e: Env = {
      RELAY_TOKEN: JETON,
      LIMITEUR: { limit: async () => ({ success: true }) },
      AI: { run: async () => ({}) },
      PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
      QUOTA: kv,
      QUOTAS: espaceQuota(kv).espace,
      DEPOT_RELEASES: DEPOT,
      ...vars,
    };
    return { e, kv };
  }
  const demande = (jeton: string | null = JETON) =>
    new Request('https://relais.exemple.test/v1/version', { headers: jeton ? { authorization: `Bearer ${jeton}` } : {} });

  it('renvoie la dernière version, puis la sert depuis KV pendant 1 h sans rappeler GitHub', async () => {
    const telechargement = vi.fn(async () => redirection(`https://github.com/${DEPOT}/releases/tag/v1.3.0`));
    vi.stubGlobal('fetch', telechargement);
    const { e, kv } = env();
    const premiere = await relais.fetch(demande(), e);
    expect(await premiere.json()).toEqual({ derniere: '1.3.0', url: `https://github.com/${DEPOT}/releases/tag/v1.3.0` });
    expect(kv.put).toHaveBeenCalledWith(`version:${DEPOT}`, expect.any(String), { expirationTtl: 3600 });
    await relais.fetch(demande(), e);
    expect(telechargement).toHaveBeenCalledTimes(1);
  });

  it('ne garde rien quand GitHub ne répond pas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const { e, kv } = env();
    expect(await (await relais.fetch(demande(), e)).json()).toEqual({ derniere: null, url: null });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('n’interroge pas GitHub sans dépôt configuré', async () => {
    const telechargement = vi.fn();
    vi.stubGlobal('fetch', telechargement);
    const { e } = env({ DEPOT_RELEASES: '' });
    expect(await (await relais.fetch(demande(), e)).json()).toEqual({ derniere: null, url: null });
    expect(telechargement).not.toHaveBeenCalled();
  });

  it('exige un jeton, comme les autres routes de l’app', async () => {
    const { e } = env();
    expect((await relais.fetch(demande(null), e)).status).toBe(401);
  });
});
