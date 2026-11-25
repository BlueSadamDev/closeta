import { afterEach, describe, expect, it, vi } from 'vitest';

import relais, { type Env } from '../src/index';
import shopifyTailles from './fixtures/shopify-tailles.html?raw';
import shopify from './fixtures/shopify.html?raw';
import { magasin } from './kv';
import { espaceQuota } from './quotaObjet';

const JETON = 'jeton-fictif-de-test';

function env(autorise = true): Env {
  return {
    RELAY_TOKEN: JETON,
    LIMITEUR: { limit: async () => ({ success: autorise }) },
    AI: { run: async () => ({}) },
    PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
    QUOTA: magasin(),
    QUOTAS: espaceQuota(magasin()).espace,
  };
}

function demande(corps: unknown, jeton: string | null = JETON, chemin = '/extract', methode = 'POST') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (jeton !== null) headers.authorization = `Bearer ${jeton}`;
  return new Request(`https://relais.exemple.test${chemin}`, {
    method: methode,
    headers,
    body: methode === 'POST' ? JSON.stringify(corps) : undefined,
  });
}

const pageHtml = (html: string, statut = 200, entetes: Record<string, string> = {}) =>
  new Response(html, { status: statut, headers: { 'content-type': 'text/html; charset=utf-8', ...entetes } });

afterEach(() => vi.unstubAllGlobals());

describe('relais : sécurité', () => {
  it('refuse une requête sans jeton', async () => {
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }, null), env());
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erreur: 'jeton_absent' });
  });

  it('refuse un mauvais jeton', async () => {
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }, 'mauvais'), env());
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ erreur: 'jeton_refuse' });
  });

  it('refuse tout si aucun jeton n’est configuré sur le relais', async () => {
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }), { ...env(), RELAY_TOKEN: undefined });
    expect(r.status).toBe(403);
  });

  it('applique la limite de débit', async () => {
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }), env(false));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ erreur: 'limite' });
  });

  it('refuse une adresse privée sans rien télécharger', async () => {
    const espion = vi.fn();
    vi.stubGlobal('fetch', espion);
    const r = await relais.fetch(demande({ url: 'https://192.168.1.1/' }), env());
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erreur: 'url_refusee' });
    expect(espion).not.toHaveBeenCalled();
  });

  it('refuse une redirection vers une adresse privée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/' } })));
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }), env());
    expect(r.status).toBe(502);
  });

  it('ne répond qu’à POST /extract, /identify, /alternatives et GET /quota', async () => {
    expect((await relais.fetch(demande(null, JETON, '/', 'GET'), env())).status).toBe(404);
    expect((await relais.fetch(demande({}, JETON, '/autre'), env())).status).toBe(404);
    expect((await relais.fetch(demande({}, JETON, '/quota'), env())).status).toBe(404);
  });

  it('signale un corps de requête illisible', async () => {
    const r = await relais.fetch(
      new Request('https://relais.exemple.test/extract', { method: 'POST', headers: { authorization: `Bearer ${JETON}` }, body: '{oups' }),
      env(),
    );
    expect(r.status).toBe(400);
  });
});

describe('relais : extraction', () => {
  it('renvoie les données produit d’une page lisible, en suivant une redirection publique', async () => {
    const appels: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        appels.push(u);
        return u.endsWith('/ancien')
          ? new Response(null, { status: 301, headers: { location: '/products/manteau-fictif' } })
          : pageHtml(shopify);
      }),
    );
    const r = await relais.fetch(demande({ url: 'https://boutique.exemple.test/ancien' }), env());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      nom: 'Manteau fictif en laine',
      marque: 'Maison Exemple',
      image: 'https://cdn.exemple.test/files/manteau.jpg?v=1',
      prix: 1290,
      devise: 'EUR',
      url: 'https://boutique.exemple.test/ancien',
      disponibilite: 'en_stock',
      dispo_taille: 'inconnue',
      depuis_cache: false,
    });
    expect(appels).toEqual(['https://boutique.exemple.test/ancien', 'https://boutique.exemple.test/products/manteau-fictif']);
  });

  it('transmet la taille demandée pour lire sa disponibilité', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pageHtml(shopifyTailles)));
    const r = await relais.fetch(demande({ url: 'https://boutique.exemple.test/veste', taille: 'M' }), env());
    expect(await r.json()).toMatchObject({ disponibilite: 'en_stock', dispo_taille: 'epuise' });
  });

  it('signale une page qui refuse la lecture (ex. protection anti-robots)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pageHtml('<html>Accès refusé</html>', 403)));
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }), env());
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ erreur: 'page_illisible' });
  });

  it('signale une adresse qui n’est pas une page web', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })));
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }), env());
    expect(r.status).toBe(502);
  });

  it('signale une boutique injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau'); }));
    const r = await relais.fetch(demande({ url: 'https://exemple.test/p' }), env());
    expect(r.status).toBe(502);
  });
});
