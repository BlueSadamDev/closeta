import { afterEach, describe, expect, it, vi } from 'vitest';

import { assemblerAlternatives, clePage, filtrer, lireDemande, rechercheTexte, type Alternative } from '../src/alternatives';
import relais, { type Env } from '../src/index';
import type { Proposition } from '../src/recherche';
import lensAlternatives from './fixtures/lens-alternatives.json';
import shopping from './fixtures/shopping.json';
import { magasin } from './kv';
import { espaceQuota } from './quotaObjet';

const JETON = 'jeton-fictif-de-test';
/** Une « photo » fictive : l'en-tête JPEG suivi d'octets quelconques, en base64. */
const PHOTO_BASE64 = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4));

/** Pièce fictive de la Wishlist. */
const PIECE = {
  image_url: 'https://images.exemple.test/origine.jpg',
  nom: 'Veste Fictive en velours côtelé',
  marque: 'Maison Exemple',
  categorie: 'Veste',
  couleur: 'Marron',
  url_exclue: 'https://boutique.exemple.test/veste-fictive',
};

const prop = (url: string, boutique: string | null = 'Boutique', nom = `Pièce ${url}`): Proposition => ({
  nom,
  marque: null,
  image: null,
  prix: null,
  devise: null,
  boutique,
  url,
  alternative: false,
});

describe('demande de l’app', () => {
  it('lit une demande complète', () => {
    expect(lireDemande(PIECE)).toEqual({
      imageUrl: 'https://images.exemple.test/origine.jpg',
      photo: null,
      nom: 'Veste Fictive en velours côtelé',
      marque: 'Maison Exemple',
      categorie: 'Veste',
      couleur: 'Marron',
      urlExclue: 'https://boutique.exemple.test/veste-fictive',
      genre: null,
    });
  });

  it('lit le genre choisi dans les Réglages ; mixte ou absent = aucun filtre ; autre valeur refusée', () => {
    expect(lireDemande({ ...PIECE, genre: 'femme' }).genre).toBe('femme');
    expect(lireDemande({ ...PIECE, genre: 'homme' }).genre).toBe('homme');
    expect(lireDemande({ ...PIECE, genre: 'mixte' }).genre).toBeNull();
    expect(() => lireDemande({ ...PIECE, genre: 'enfant' })).toThrow('requete_invalide');
    expect(() => lireDemande({ ...PIECE, genre: 3 })).toThrow('requete_invalide');
  });

  it('refuse une demande sans nom', () => {
    expect(() => lireDemande({ ...PIECE, nom: '  ' })).toThrow('requete_invalide');
    expect(() => lireDemande(null)).toThrow('requete_invalide');
  });

  it('refuse une photo qui n’est pas un JPEG', () => {
    expect(() => lireDemande({ nom: 'Veste', photo: btoa('bonjour') })).toThrow('photo_refusee');
    expect(() => lireDemande({ nom: 'Veste', photo: '%%%' })).toThrow('photo_refusee');
  });

  it('ignore une adresse d’image non publique', () => {
    expect(lireDemande({ nom: 'Veste', image_url: 'https://192.168.1.2/a.jpg' }).imageUrl).toBeNull();
  });
});

describe('filtre et classement', () => {
  it('reconnaît la page d’origine malgré www, « / » final et paramètres', () => {
    expect(clePage('https://www.Boutique.exemple.test/veste/?utm=1#x')).toBe(clePage('https://boutique.exemple.test/veste'));
  });

  it('écarte la page d’origine, les réseaux sociaux, les résultats sans boutique et les doublons', () => {
    const r = filtrer(
      [
        prop('https://boutique.exemple.test/veste-fictive?ref=lens'),
        prop('https://www.instagram.com/p/1'),
        prop('https://blog.exemple.test/a', null),
        prop('https://a.exemple.test/v'),
        prop('https://www.a.exemple.test/v/'),
      ],
      PIECE.url_exclue,
    );
    expect(r.map((p) => p.url)).toEqual(['https://a.exemple.test/v']);
  });

  it('écrit la recherche Shopping sans répéter ce que le nom dit déjà', () => {
    expect(rechercheTexte({ nom: 'Veste velours', marque: 'Maison Exemple', categorie: 'Veste', couleur: 'Marron' })).toBe(
      'Veste velours Maison Exemple Marron',
    );
  });

  it('classe par ressemblance, jamais par prix, et complète par Shopping sous 3 résultats', () => {
    const demande = lireDemande(PIECE);
    const lens = [
      { ...prop('https://c.test/', 'C', 'Casquette marron'), prix: 10 },
      prop('https://v.test/', 'V', 'Veste velours marron'),
    ];
    const r = assemblerAlternatives(lens, [prop('https://s.test/', 'S', 'Veste marron'), prop('https://v.test/', 'V')], demande);
    expect(r.map((p) => p.url)).toEqual(['https://v.test/', 'https://c.test/', 'https://s.test/']);
    expect(r[0]).not.toHaveProperty('alternative');
  });
});

// --- Parcours complet par le relais, avec stockage et SerpApi simulés ---

function stockage() {
  const fichiers = new Map<string, Uint8Array>();
  return {
    fichiers,
    put: vi.fn(async (cle: string, valeur: Uint8Array) => void fichiers.set(cle, valeur)),
    get: vi.fn(async (cle: string) => {
      const v = fichiers.get(cle);
      return v ? { body: new Response(new Uint8Array(v)).body as ReadableStream } : null;
    }),
    delete: vi.fn(async (cle: string) => void fichiers.delete(cle)),
  };
}

function env(options: { cle?: string | undefined; quota?: Record<string, string>; limite?: string } = {}) {
  const photos = stockage();
  const kv = magasin(options.quota);
  const quota = espaceQuota(kv);
  const e: Env = {
    RELAY_TOKEN: JETON,
    SERPAPI_KEY: 'cle' in options ? options.cle : 'cle-fictive',
    LIMITEUR: { limit: async () => ({ success: true }) },
    AI: { run: vi.fn() },
    PHOTOS: photos,
    QUOTA: kv,
    QUOTAS: quota.espace,
    SERPAPI_LIMITE_MOIS: options.limite,
  };
  return { e, photos, quota };
}

const envoi = (corps: unknown, jeton: string | null = JETON) =>
  new Request('https://relais.exemple.test/alternatives', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  });

const jsonOk = (corps: unknown) => new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } });
const utilise = (q: ReturnType<typeof espaceQuota>) => q.compte();

afterEach(() => vi.unstubAllGlobals());

describe('relais : /alternatives', () => {
  it('refuse sans jeton', async () => {
    const { e } = env();
    expect((await relais.fetch(envoi(PIECE, null), e)).status).toBe(401);
  });

  it('genre « femme » : ajouté à la recherche Shopping, pièces pour homme écartées', async () => {
    const { e } = env();
    const recherches: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) => {
        const u = new URL(adresse);
        expect(u.searchParams.get('engine')).toBe('google_shopping');
        recherches.push(u.searchParams.get('q') ?? '');
        return jsonOk(shopping);
      }),
    );
    const r = await relais.fetch(envoi({ nom: 'Veste velours', genre: 'femme' }), e);
    expect(r.status).toBe(200);
    const { resultats } = (await r.json()) as { resultats: Alternative[] };
    expect(recherches).toEqual(['Veste velours femme']);
    expect(resultats.length).toBeGreaterThan(0);
    expect(resultats.some((p) => /homme/i.test(p.nom))).toBe(false);
  });

  it('refuse un genre inconnu', async () => {
    const { e } = env();
    const r = await relais.fetch(envoi({ ...PIECE, genre: 'enfant' }), e);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erreur: 'requete_invalide' });
  });

  it('refuse une demande illisible ou sans nom', async () => {
    const { e } = env();
    expect(await (await relais.fetch(envoi('{oups'), e)).json()).toEqual({ erreur: 'requete_invalide' });
    expect((await relais.fetch(envoi({ ...PIECE, nom: '' }), e)).status).toBe(400);
  });

  it('Lens sur l’image de la boutique : 3 résultats retenus, pas de Shopping, rien déposé', async () => {
    const { e, photos, quota } = env();
    const appels: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) => {
        const u = new URL(adresse);
        appels.push(u.searchParams.get('engine') ?? '');
        expect(u.searchParams.get('url')).toBe(PIECE.image_url);
        return jsonOk(lensAlternatives);
      }),
    );
    const r = await relais.fetch(envoi(PIECE), e);
    expect(r.status).toBe(200);
    const { resultats } = (await r.json()) as { resultats: Alternative[] };
    // Page d'origine, Instagram et résultat sans boutique écartés ; la casquette passe derrière les vestes.
    expect(resultats.map((p) => p.url)).toEqual([
      'https://atelier.exemple.test/veste-velours',
      'https://mode.exemple.test/blouson',
      'https://chapeaux.exemple.test/casquette',
    ]);
    expect(resultats[0]).toEqual({
      nom: 'Veste en velours marron',
      marque: null,
      image: 'https://images.exemple.test/atelier.jpg',
      prix: null,
      devise: null,
      boutique: 'Atelier Exemple',
      url: 'https://atelier.exemple.test/veste-velours',
    });
    expect(appels).toEqual(['google_lens']);
    expect(photos.put).not.toHaveBeenCalled();
    expect(utilise(quota)).toBe(1);
  });

  it('photo du téléphone : déposée le temps de Lens puis supprimée, complément Shopping sous 3 résultats', async () => {
    const { e, photos, quota } = env();
    const appels: string[] = [];
    let photoLueParLens = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) => {
        const u = new URL(adresse);
        appels.push(u.searchParams.get('engine') ?? '');
        if (u.searchParams.get('engine') === 'google_lens') {
          const chemin = new URL(u.searchParams.get('url') ?? '').pathname;
          const lue = await relais.fetch(new Request(`https://relais.exemple.test${chemin}`), e);
          photoLueParLens = lue.status === 200;
          return jsonOk({ visual_matches: lensAlternatives.visual_matches.slice(0, 1) });
        }
        expect(u.searchParams.get('q')).toBe('Veste Fictive en velours côtelé Maison Exemple Marron');
        return jsonOk(shopping);
      }),
    );
    const { image_url: _i, ...sansImage } = PIECE;
    const r = await relais.fetch(envoi({ ...sansImage, photo: PHOTO_BASE64 }), e);
    expect(r.status).toBe(200);
    const { resultats } = (await r.json()) as { resultats: Alternative[] };
    expect(resultats).toHaveLength(5);
    expect(resultats.some((p) => p.url.includes('boutique.exemple.test'))).toBe(false);
    expect(appels).toEqual(['google_lens', 'google_shopping']);
    expect(photoLueParLens).toBe(true);
    expect(photos.fichiers.size).toBe(0);
    expect(utilise(quota)).toBe(2);
  });

  it('pièce sans image ni photo : Shopping seul', async () => {
    const { e } = env();
    const espion = vi.fn(async () => jsonOk(shopping));
    vi.stubGlobal('fetch', espion);
    const r = await relais.fetch(envoi({ nom: 'Veste velours', categorie: 'Veste' }), e);
    expect(r.status).toBe(200);
    expect(espion).toHaveBeenCalledTimes(1);
  });

  it('seuil atteint : quota_atteint, sans appeler SerpApi', async () => {
    const { e } = env({ limite: '0' });
    const espion = vi.fn();
    vi.stubGlobal('fetch', espion);
    const r = await relais.fetch(envoi(PIECE), e);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ erreur: 'quota_atteint' });
    expect(espion).not.toHaveBeenCalled();
  });

  it('seuil atteint après Lens : garde ce que Lens a trouvé', async () => {
    const { e } = env({ limite: '1' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonOk({ visual_matches: lensAlternatives.visual_matches.slice(2, 3) })));
    const r = await relais.fetch(envoi(PIECE), e);
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { resultats: Alternative[]; incidents: string[] };
    expect(corps.resultats).toHaveLength(1);
    expect(corps.incidents).toEqual(['quota_atteint']);
  });

  it('clé SerpApi absente : panne signalée', async () => {
    const { e } = env({ cle: undefined });
    vi.stubGlobal('fetch', vi.fn());
    const r = await relais.fetch(envoi(PIECE), e);
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ erreur: 'recherche_indisponible', incidents: ['cle_serpapi_absente'] });
  });
});
