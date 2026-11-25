import { afterEach, describe, expect, it, vi } from 'vitest';

import { adresseCanonique, Catalogue, cleRecherche, empreinte, requeteNormalisee } from '../src/catalogue';
import type { Extraction } from '../src/extract';
import relais, { type Env } from '../src/index';
import { PRINCIPALE } from '../src/installations';
import type { Proposition } from '../src/recherche';
import { settings } from '../src/settings';
import { baseD1, contenu } from './d1';
import lensAlternatives from './fixtures/lens-alternatives.json';
import lens from './fixtures/lens.json';
import shopping from './fixtures/shopping.json';
import shopifyTailles from './fixtures/shopify-tailles.html?raw';
import { magasin } from './kv';
import { espaceQuota } from './quotaObjet';

const JETON = 'jeton-fictif-de-test';
const IP = '203.0.113.42';
const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6]);
const HEURE = 3600_000;
const JOUR = 24 * HEURE;

const prop = (url: string): Proposition => ({ nom: `Pièce ${url}`, marque: null, image: null, prix: null, devise: null, boutique: null, url, alternative: false });

const extraction = (prix: number | null, disponibilite: Extraction['disponibilite'] = 'en_stock'): Extraction => ({
  nom: 'Manteau fictif',
  marque: 'Maison Exemple',
  image: 'https://cdn.exemple.test/manteau.jpg',
  prix,
  devise: prix === null ? null : 'EUR',
  url: 'https://boutique.exemple.test/manteau',
  disponibilite,
  dispo_taille: 'inconnue',
});

const nombre = (db: ReturnType<typeof baseD1>['db'], table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('adresse canonique', () => {
  it('retire les paramètres de suivi et l’ancre, garde les autres (taille, couleur)', () => {
    expect(adresseCanonique('https://boutique.exemple.test/p?utm_source=insta&taille=M&gclid=abc&fbclid=x&UTM_Medium=y#avis')).toBe(
      'https://boutique.exemple.test/p?taille=M',
    );
    expect(adresseCanonique('https://boutique.exemple.test/p?variant=42&couleur=noir&srsltid=z')).toBe(
      'https://boutique.exemple.test/p?couleur=noir&variant=42',
    );
  });

  it('même page avec des paramètres dans un autre ordre = même adresse ; sans paramètre = sans « ? »', () => {
    expect(adresseCanonique('https://exemple.test/p?b=2&a=1')).toBe(adresseCanonique('https://exemple.test/p?a=1&b=2'));
    expect(adresseCanonique('https://exemple.test/p?utm_campaign=x')).toBe('https://exemple.test/p');
  });
});

describe('clé de recherche', () => {
  it('même entrée = même clé (requête écrite autrement, image avec suivi)', async () => {
    expect(await cleRecherche('shopping', 'Veste  Velours ', 'femme')).toBe(await cleRecherche('shopping', 'veste velours', 'femme'));
    expect(await cleRecherche('lens_image', 'https://img.exemple.test/a.jpg?utm_source=x', null)).toBe(
      await cleRecherche('lens_image', 'https://img.exemple.test/a.jpg', null),
    );
    expect(requeteNormalisee('  Veste\tVELOURS ')).toBe('veste velours');
  });

  it('genre différent ou type différent = clé différente', async () => {
    const femme = await cleRecherche('shopping', 'veste', 'femme');
    expect(await cleRecherche('shopping', 'veste', 'homme')).not.toBe(femme);
    expect(await cleRecherche('shopping', 'veste', null)).not.toBe(femme);
    expect(await cleRecherche('lens_photo', 'veste', 'femme')).not.toBe(femme);
  });

  it('une photo ne sert que par son empreinte SHA-256', async () => {
    expect(await empreinte(PHOTO)).toMatch(/^[0-9a-f]{64}$/);
    expect(await empreinte(PHOTO)).toBe(await empreinte(new Uint8Array(PHOTO)));
  });
});

describe('recherches gardées', () => {
  it('servies jusqu’à expiration (Shopping 7 jours, Lens 30 jours), puis purgées la nuit', async () => {
    const base = baseD1();
    let t = Date.UTC(2026, 10, 24);
    const catalogue = new Catalogue(base, () => t);
    await catalogue.garderRecherche('cle-shopping', 'shopping', [prop('https://a.test/1')]);
    await catalogue.garderRecherche('cle-lens', 'lens_image', [prop('https://a.test/2')]);
    expect(settings.dureesRecherche).toEqual({ shopping: 7 * JOUR, lens_image: 30 * JOUR, lens_photo: 30 * JOUR });

    t += 7 * JOUR - 1;
    expect(await catalogue.recherche('cle-shopping')).toEqual([prop('https://a.test/1')]);
    t += 1;
    expect(await catalogue.recherche('cle-shopping')).toBeNull();
    expect(await catalogue.recherche('cle-lens')).toEqual([prop('https://a.test/2')]);

    await catalogue.purger();
    expect(nombre(base.db, 'recherche')).toBe(1);
    t += 23 * JOUR;
    await catalogue.purger();
    expect(nombre(base.db, 'recherche')).toBe(0);
  });

  it('une liste vide est un vrai résultat (gardé) ; une clé inconnue n’en est pas un', async () => {
    const catalogue = new Catalogue(baseD1());
    await catalogue.garderRecherche('vide', 'lens_photo', []);
    expect(await catalogue.recherche('vide')).toEqual([]);
    expect(await catalogue.recherche('inconnue')).toBeNull();
  });
});

describe('produits et observations de prix', () => {
  it('nouvelle observation seulement si le prix ou la disponibilité change', async () => {
    const base = baseD1();
    let t = Date.UTC(2026, 10, 1);
    const catalogue = new Catalogue(base, () => t);
    const url = 'https://boutique.exemple.test/manteau';
    const m = [{ tailles: ['m'], etat: 'en_stock' as const }];

    await catalogue.enregistrerLecture(url, extraction(120), m);
    t += 2 * JOUR;
    await catalogue.enregistrerLecture(url, extraction(120), m);
    expect(nombre(base.db, 'observation_prix')).toBe(1);

    t += 2 * JOUR;
    await catalogue.enregistrerLecture(url, extraction(99), m);
    t += 2 * JOUR;
    await catalogue.enregistrerLecture(url, extraction(99, 'epuise'), m);
    t += 2 * JOUR;
    await catalogue.enregistrerLecture(url, extraction(99, 'epuise'), [{ tailles: ['m'], etat: 'epuise' }]);
    expect(nombre(base.db, 'observation_prix')).toBe(4);
    expect(nombre(base.db, 'produit')).toBe(1);

    const produit = base.db.prepare('SELECT boutique, premiere_vue, derniere_vue FROM produit').get();
    expect(produit).toEqual({ boutique: 'boutique.exemple.test', premiere_vue: Date.UTC(2026, 10, 1), derniere_vue: t });
  });

  it('servi pendant 24 h, avec la disponibilité de la taille demandée ; ensuite, à relire', async () => {
    let t = Date.UTC(2026, 10, 1);
    const catalogue = new Catalogue(baseD1(), () => t);
    const url = 'https://boutique.exemple.test/manteau';
    await catalogue.enregistrerLecture(url, extraction(120), [
      { tailles: ['manteau', 's'], etat: 'epuise' },
      { tailles: ['manteau', 'm'], etat: 'en_stock' },
    ]);
    t += 24 * HEURE - 1;
    expect(await catalogue.produitRecent(url, 'Taille S')).toEqual({
      nom: 'Manteau fictif',
      marque: 'Maison Exemple',
      image: 'https://cdn.exemple.test/manteau.jpg',
      prix: 120,
      devise: 'EUR',
      disponibilite: 'en_stock',
      dispo_taille: 'epuise',
    });
    expect((await catalogue.produitRecent(url, 'M'))?.dispo_taille).toBe('en_stock');
    expect((await catalogue.produitRecent(url, null))?.dispo_taille).toBe('inconnue');
    t += 1;
    expect(await catalogue.produitRecent(url, 'M')).toBeNull();
  });

  it('une page sans nom ni prix n’est pas enregistrée', async () => {
    const base = baseD1();
    await new Catalogue(base).enregistrerLecture('https://exemple.test/vide', { ...extraction(null), nom: null }, []);
    expect(nombre(base.db, 'produit')).toBe(0);
  });

  it('D1 en panne : rien en cache, aucune erreur', async () => {
    const base = baseD1();
    base.enPanne = true;
    const catalogue = new Catalogue(base);
    await expect(catalogue.enregistrerLecture('https://exemple.test/p', extraction(10), [])).resolves.toBeUndefined();
    await expect(catalogue.garderRecherche('c', 'shopping', [])).resolves.toBeUndefined();
    expect(await catalogue.produitRecent('https://exemple.test/p', null)).toBeNull();
    expect(await catalogue.recherche('c')).toBeNull();
  });
});

// --- Parcours complets par le relais, avec le catalogue ---

function env(options: { limite?: string } = {}) {
  const base = baseD1();
  const kv = magasin();
  const e: Env = {
    RELAY_TOKEN: JETON,
    SERPAPI_KEY: 'cle-fictive',
    LIMITEUR: { limit: async () => ({ success: true }) },
    AI: {
      run: async () => ({ choices: [{ message: { content: JSON.stringify({ type: 'vetement', categorie: 'Veste', recherche: 'veste velours' }) } }] }),
    },
    PHOTOS: { put: vi.fn(async () => null), get: async () => null, delete: async () => undefined },
    QUOTA: kv,
    QUOTAS: espaceQuota(kv).espace,
    SERPAPI_LIMITE_MOIS: options.limite,
    CATALOGUE: base,
  };
  return { e, base };
}

const requete = (chemin: string, corps: BodyInit, type = 'application/json') =>
  new Request(`https://relais.exemple.test/v1${chemin}`, {
    method: 'POST',
    headers: { 'content-type': type, authorization: `Bearer ${JETON}`, 'cf-connecting-ip': IP, 'x-closeta-installation': 'a1b2c3d4-e5f6-4789-abcd-0123456789ab' },
    body: corps,
  });

const jsonOk = (corps: unknown) => new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } });

const utilise = async (e: Env) => {
  const r = await relais.fetch(new Request('https://relais.exemple.test/v1/quota', { headers: { authorization: `Bearer ${JETON}` } }), e);
  return ((await r.json()) as { installation: { utilise: number } }).installation.utilise;
};

describe('relais : /v1/extract avec le catalogue', () => {
  it('page relue moins de 24 h après : réponse du catalogue, sans relire la page ; après 24 h, relue', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 10, 24, 10));
    const { e, base } = env();
    const lectures = vi.fn(async () => new Response(shopifyTailles, { headers: { 'content-type': 'text/html' } }));
    vi.stubGlobal('fetch', lectures);

    const premiere = await relais.fetch(requete('/extract', JSON.stringify({ url: 'https://boutique.exemple.test/products/robe?utm_source=x', taille: 'M' })), e);
    const corps1 = (await premiere.json()) as Record<string, unknown>;
    expect(corps1.depuis_cache).toBe(false);

    vi.setSystemTime(Date.UTC(2026, 10, 25, 9));
    // Autre suivi, même page : même produit.
    const seconde = await relais.fetch(requete('/extract', JSON.stringify({ url: 'https://boutique.exemple.test/products/robe?fbclid=y', taille: 'M' })), e);
    const corps2 = (await seconde.json()) as Record<string, unknown>;
    expect(lectures).toHaveBeenCalledTimes(1);
    expect(corps2.depuis_cache).toBe(true);
    const { url: _u1, depuis_cache: _d1, ...sans1 } = corps1;
    const { url: _u2, depuis_cache: _d2, ...sans2 } = corps2;
    expect(sans2).toEqual(sans1);
    expect(nombre(base.db, 'produit')).toBe(1);

    vi.setSystemTime(Date.UTC(2026, 10, 25, 11));
    await relais.fetch(requete('/extract', JSON.stringify({ url: 'https://boutique.exemple.test/products/robe' })), e);
    expect(lectures).toHaveBeenCalledTimes(2);
    // Prix et disponibilité inchangés : une seule observation.
    expect(nombre(base.db, 'observation_prix')).toBe(1);
  });
});

describe('relais : recherches avec le catalogue', () => {
  it('/alternatives refaite le lendemain : depuis le catalogue, sans SerpApi ni quota ; autre genre = nouvelle recherche', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 10, 10));
    const { e } = env();
    const appels = vi.fn(async () => jsonOk(lensAlternatives));
    vi.stubGlobal('fetch', appels);
    const piece = { image_url: 'https://images.exemple.test/origine.jpg', nom: 'Veste Fictive', genre: 'femme' };

    const r1 = await relais.fetch(requete('/alternatives', JSON.stringify(piece)), e);
    const c1 = (await r1.json()) as { resultats: unknown[]; depuis_cache: boolean };
    expect(c1.depuis_cache).toBe(false);
    const apres1 = await utilise(e);
    expect(apres1).toBeGreaterThan(0);
    const appelsPayes = appels.mock.calls.length;

    vi.setSystemTime(Date.UTC(2026, 10, 11));
    const r2 = await relais.fetch(requete('/alternatives', JSON.stringify(piece)), e);
    const c2 = (await r2.json()) as { resultats: unknown[]; depuis_cache: boolean };
    expect(c2.depuis_cache).toBe(true);
    expect(c2.resultats).toEqual(c1.resultats);
    expect(appels).toHaveBeenCalledTimes(appelsPayes);
    expect(await utilise(e)).toBe(apres1);

    await relais.fetch(requete('/alternatives', JSON.stringify({ ...piece, genre: 'homme' })), e);
    expect(appels.mock.calls.length).toBeGreaterThan(appelsPayes);
  });

  it('servie depuis le catalogue même quand le quota est atteint', async () => {
    const { e } = env({ limite: '1' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonOk(lensAlternatives)));
    const piece = { image_url: 'https://images.exemple.test/origine.jpg', nom: 'Veste Fictive' };
    expect((await relais.fetch(requete('/alternatives', JSON.stringify(piece)), e)).status).toBe(200);
    const r = await relais.fetch(requete('/alternatives', JSON.stringify(piece)), e);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { depuis_cache: boolean }).depuis_cache).toBe(true);
    // Une recherche nouvelle, elle, est refusée.
    const autre = await relais.fetch(requete('/alternatives', JSON.stringify({ ...piece, image_url: 'https://images.exemple.test/autre.jpg' })), e);
    expect(autre.status).toBe(429);
  });

  it('/identify : même photo renvoyée → Lens et Shopping depuis le catalogue, photo non déposée', async () => {
    const { e } = env();
    const appels = vi.fn(async (adresse: string) => jsonOk(adresse.includes('google_lens') ? { visual_matches: [] } : shopping));
    vi.stubGlobal('fetch', appels);

    const c1 = (await (await relais.fetch(requete('/identify', PHOTO, 'image/jpeg'), e)).json()) as { resultats: unknown[]; depuis_cache: boolean };
    expect(c1.depuis_cache).toBe(false);
    expect(appels).toHaveBeenCalledTimes(2);
    const apres1 = await utilise(e);

    const c2 = (await (await relais.fetch(requete('/identify', PHOTO, 'image/jpeg'), e)).json()) as { resultats: unknown[]; depuis_cache: boolean };
    expect(c2.depuis_cache).toBe(true);
    expect(c2.resultats).toEqual(c1.resultats);
    expect(appels).toHaveBeenCalledTimes(2);
    expect(e.PHOTOS.put).toHaveBeenCalledTimes(1);
    expect(await utilise(e)).toBe(apres1);
  });

  it('les correspondances Lens gardées restent classées prix d’abord sur /identify', async () => {
    const { e } = env();
    vi.stubGlobal('fetch', vi.fn(async (adresse: string) => jsonOk(adresse.includes('google_lens') ? lens : shopping)));
    const c1 = (await (await relais.fetch(requete('/identify', PHOTO, 'image/jpeg'), e)).json()) as { resultats: Proposition[] };
    const c2 = (await (await relais.fetch(requete('/identify', PHOTO, 'image/jpeg'), e)).json()) as { resultats: Proposition[] };
    expect(c2.resultats).toEqual(c1.resultats);
  });

  it('aucun jeton, identifiant d’installation, adresse IP ni photo écrit dans D1', async () => {
    const { e, base } = env();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) =>
        adresse.startsWith('https://serpapi.com')
          ? jsonOk(adresse.includes('google_lens') ? lens : shopping)
          : new Response(shopifyTailles, { headers: { 'content-type': 'text/html' } }),
      ),
    );
    await relais.fetch(requete('/extract', JSON.stringify({ url: 'https://boutique.exemple.test/products/robe' })), e);
    await relais.fetch(requete('/identify', PHOTO, 'image/jpeg'), e);
    await relais.fetch(requete('/alternatives', JSON.stringify({ image_url: 'https://images.exemple.test/o.jpg', nom: 'Veste' })), e);

    const tout = contenu(base.db);
    expect(nombre(base.db, 'recherche')).toBeGreaterThan(0);
    for (const interdit of [JETON, PRINCIPALE.id, 'a1b2c3d4-e5f6-4789-abcd-0123456789ab', IP, 'cle-fictive', btoa(String.fromCharCode(...PHOTO))]) {
      expect(tout).not.toContain(interdit);
    }
  });

  it('tâche planifiée de la nuit : purge des recherches expirées', async () => {
    const { e, base } = env();
    base.db.prepare("INSERT INTO recherche VALUES ('vieille', 'shopping', '[]', 0, 1), ('valide', 'shopping', '[]', 0, 9e15)").run();
    await relais.scheduled({}, e);
    expect(base.db.prepare('SELECT cle FROM recherche').all()).toEqual([{ cle: 'valide' }]);
  });
});
