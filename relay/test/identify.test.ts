import { afterEach, describe, expect, it, vi } from 'vitest';

import { DESCRIPTION_VIDE, enBase64, lireDescription } from '../src/ia';
import { assembler, avecMarque, estJpeg } from '../src/identify';
import relais, { type Env } from '../src/index';
import { lireDevise, type Proposition } from '../src/recherche';
import { lireLens, lireShopping } from '../src/serpapi';
import lens from './fixtures/lens.json';
import shopping from './fixtures/shopping.json';
import { magasin } from './kv';
import { espaceQuota } from './quotaObjet';

const JETON = 'jeton-fictif-de-test';
/** Une « photo » fictive : juste l'en-tête JPEG suivi d'octets quelconques. */
const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

const DESCRIPTION_IA = {
  type: 'vetement',
  categorie: 'Veste',
  couleur: 'marron',
  matiere: 'velours côtelé',
  marque: 'Maison Exemple',
  recherche: 'veste velours côtelé marron homme',
};

const reponseIA = (contenu: unknown) => ({ choices: [{ message: { content: JSON.stringify(contenu) } }] });

const prop = (url: string, alternative = false): Proposition => ({
  nom: `Pièce ${url}`,
  marque: null,
  image: null,
  prix: null,
  devise: null,
  boutique: null,
  url,
  alternative,
});

describe('description par l’IA', () => {
  it('lit la réponse de l’IA', () => {
    expect(lireDescription(reponseIA(DESCRIPTION_IA))).toEqual(DESCRIPTION_IA);
  });

  it('retrouve le JSON entouré de texte', () => {
    const r = { choices: [{ message: { content: 'Voici :\n```json\n{"type":"chaussures","couleur":"noir"}\n```' } }] };
    expect(lireDescription(r)).toMatchObject({ type: 'chaussures', couleur: 'noir', marque: null });
  });

  it('remplace les valeurs vides ou inventées par null', () => {
    const d = lireDescription(reponseIA({ type: 'sac', categorie: '  ', couleur: 'inconnue', marque: 'null', recherche: 42 }));
    expect(d).toEqual({ type: null, categorie: null, couleur: null, matiere: null, marque: null, recherche: null });
  });

  it('renvoie une description vide si la réponse est illisible', () => {
    expect(lireDescription({ choices: [{ message: { content: 'pas de JSON' } }] }).type).toBeNull();
    expect(lireDescription(null).recherche).toBeNull();
  });

  it('encode la photo en base64', () => {
    expect(enBase64(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('/9j/');
  });
});

describe('lecture des résultats SerpApi', () => {
  it('garde les correspondances Lens en boutique, sans doublon, réseau social ni banque d’images, prix d’abord', () => {
    const r = lireLens(lens);
    expect(r.map((p) => p.url)).toEqual(['https://boutique.exemple.test/veste-fictive', 'https://autre.exemple.test/veste']);
    expect(r[0]).toEqual({
      nom: 'Veste Fictive en velours côtelé – Maison Exemple',
      marque: null,
      image: 'https://images.exemple.test/veste1.jpg',
      prix: 249,
      devise: 'EUR',
      boutique: 'Boutique Exemple',
      url: 'https://boutique.exemple.test/veste-fictive',
      alternative: false,
    });
    expect(r[1]).toMatchObject({ prix: null, devise: null, image: 'https://images.exemple.test/vignette3.jpg' });
  });

  it('étiquette tous les résultats Shopping comme alternatives, prix manquant = null', () => {
    const r = lireShopping(shopping);
    expect(r).toHaveLength(5);
    expect(r.every((p) => p.alternative)).toBe(true);
    expect(r[0]).toMatchObject({ url: 'https://www.google.fr/shopping/product/1', prix: 89.99, devise: 'EUR' });
    expect(r[2]).toMatchObject({ prix: null, devise: null });
  });

  it('supporte une réponse vide ou inattendue', () => {
    expect(lireLens({})).toEqual([]);
    expect(lireShopping(null)).toEqual([]);
  });

  it('lit la devise', () => {
    expect(lireDevise('€', null)).toBe('EUR');
    expect(lireDevise('usd', null)).toBe('USD');
    expect(lireDevise(undefined, '49,90 €')).toBe('EUR');
    expect(lireDevise(undefined, '49,90')).toBeNull();
  });
});

describe('assemblage des propositions', () => {
  it('3 correspondances Lens ou plus : pas d’alternative, au plus 5', () => {
    const l = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => prop(`https://${x}.test/`));
    const r = assembler(l, [prop('https://z.test/', true)], DESCRIPTION_VIDE);
    expect(r).toHaveLength(5);
    expect(r.some((p) => p.alternative)).toBe(false);
  });

  it('moins de 3 correspondances Lens : complété par des alternatives, sans doublon', () => {
    const r = assembler([prop('https://a.test/')], [prop('https://a.test/', true), prop('https://b.test/', true)], DESCRIPTION_VIDE);
    expect(r.map((p) => [p.url, p.alternative])).toEqual([
      ['https://a.test/', false],
      ['https://b.test/', true],
    ]);
  });

  it('reporte la marque vue par l’IA seulement si elle figure dans le nom', () => {
    const p = { ...prop('https://a.test/'), nom: 'Veste MAISON EXEMPLE velours' };
    expect(avecMarque(p, 'Maison Exemple').marque).toBe('Maison Exemple');
    expect(avecMarque(prop('https://b.test/'), 'Maison Exemple').marque).toBeNull();
  });

  it('reconnaît une photo JPEG', () => {
    expect(estJpeg(PHOTO)).toBe(true);
    expect(estJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});

// --- Parcours complet par le relais, avec IA, stockage et SerpApi simulés ---

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

function env(options: { ia?: unknown; cle?: string | undefined; quota?: Record<string, string>; limite?: string } = {}) {
  const photos = stockage();
  const quota = magasin(options.quota);
  const e: Env = {
    RELAY_TOKEN: JETON,
    SERPAPI_KEY: 'cle' in options ? options.cle : 'cle-fictive',
    LIMITEUR: { limit: async () => ({ success: true }) },
    AI: { run: vi.fn(async () => options.ia ?? reponseIA(DESCRIPTION_IA)) },
    PHOTOS: photos,
    QUOTA: quota,
    QUOTAS: espaceQuota(quota).espace,
    SERPAPI_LIMITE_MOIS: options.limite,
  };
  return { e, photos, quota };
}

const envoi = (corps: BodyInit, type = 'image/jpeg', jeton: string | null = JETON) =>
  new Request('https://relais.exemple.test/identify', {
    method: 'POST',
    headers: { 'content-type': type, ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: corps,
  });

const jsonOk = (corps: unknown) => new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('relais : /identify', () => {
  it('refuse sans jeton', async () => {
    const { e } = env();
    expect((await relais.fetch(envoi(PHOTO, 'image/jpeg', null), e)).status).toBe(401);
  });

  it('refuse ce qui n’est pas une photo JPEG', async () => {
    const { e } = env();
    const r = await relais.fetch(envoi('bonjour', 'text/plain'), e);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erreur: 'photo_refusee' });
    expect((await relais.fetch(envoi(new Uint8Array([1, 2, 3, 4])), e)).status).toBe(400);
  });

  it('refuse une photo trop lourde', async () => {
    const { e } = env();
    const lourde = new Uint8Array(2_000_001);
    lourde.set([0xff, 0xd8, 0xff]);
    expect((await relais.fetch(envoi(lourde), e)).status).toBe(400);
  });

  it('propose Lens puis complète avec Shopping, et supprime la photo après la recherche', async () => {
    const { e, photos } = env();
    const appels: string[] = [];
    let photoLueParLens = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) => {
        const u = new URL(adresse);
        appels.push(u.searchParams.get('engine') ?? '');
        if (u.searchParams.get('engine') === 'google_lens') {
          // Lens lit la photo à l'adresse donnée : elle doit être disponible à ce moment-là.
          const chemin = new URL(u.searchParams.get('url') ?? '').pathname;
          const lue = await relais.fetch(new Request(`https://relais.exemple.test${chemin}`), e);
          photoLueParLens = lue.status === 200 && lue.headers.get('content-type') === 'image/jpeg';
          return jsonOk(lens);
        }
        expect(u.searchParams.get('q')).toBe('veste velours côtelé marron homme');
        return jsonOk(shopping);
      }),
    );
    const r = await relais.fetch(envoi(PHOTO), e);
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { description: unknown; resultats: Proposition[] };
    expect(corps.description).toEqual(DESCRIPTION_IA);
    expect(corps.resultats).toHaveLength(5);
    expect(corps.resultats.map((p) => p.alternative)).toEqual([false, false, true, true, true]);
    expect(corps.resultats[0].marque).toBe('Maison Exemple');
    expect(corps.resultats.find((p) => p.nom === 'Veste velours homme Maison Exemple')?.marque).toBe('Maison Exemple');
    expect(photoLueParLens).toBe(true);
    expect(appels).toEqual(['google_lens', 'google_shopping']);
    expect(photos.put).toHaveBeenCalledTimes(1);
    expect(photos.fichiers.size).toBe(0);
  });

  it('renvoie une liste vide quand rien n’est trouvé (ce n’est pas une panne)', async () => {
    const { e } = env();
    vi.stubGlobal('fetch', vi.fn(async () => jsonOk({ error: "Google hasn't returned any results for this query." })));
    const r = await relais.fetch(envoi(PHOTO), e);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { resultats: unknown[] }).resultats).toEqual([]);
  });

  it('Lens en panne : les alternatives Shopping suffisent', async () => {
    const { e, photos } = env();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) =>
        adresse.includes('google_lens') ? new Response('{}', { status: 500 }) : jsonOk(shopping),
      ),
    );
    const r = await relais.fetch(envoi(PHOTO), e);
    expect(r.status).toBe(200);
    const { resultats } = (await r.json()) as { resultats: Proposition[] };
    expect(resultats.every((p) => p.alternative)).toBe(true);
    expect(photos.fichiers.size).toBe(0);
  });

  it('genre « homme » : ajouté à la recherche Shopping des alternatives, Lens inchangé', async () => {
    const { e } = env();
    const recherches: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (adresse: string) => {
        if (adresse.includes('google_lens')) return new Response('{}', { status: 500 });
        recherches.push(new URL(adresse).searchParams.get('q') ?? '');
        return jsonOk(shopping);
      }),
    );
    const requete = envoi(PHOTO);
    const r = await relais.fetch(new Request('https://relais.exemple.test/identify?genre=homme', requete), e);
    expect(r.status).toBe(200);
    expect(recherches).toHaveLength(1);
    expect(recherches[0]).toMatch(/ homme$/);
  });

  it('refuse un genre inconnu', async () => {
    const { e } = env();
    const r = await relais.fetch(new Request('https://relais.exemple.test/identify?genre=enfant', envoi(PHOTO)), e);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erreur: 'requete_invalide' });
  });

  it('signale une panne si aucune recherche n’aboutit (clé SerpApi absente)', async () => {
    const { e } = env({ cle: undefined });
    const espion = vi.fn();
    vi.stubGlobal('fetch', espion);
    const r = await relais.fetch(envoi(PHOTO), e);
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ erreur: 'recherche_indisponible', incidents: ['cle_serpapi_absente'] });
    expect(espion).not.toHaveBeenCalled();
  });

  it('IA en échec : les correspondances Lens restent proposées', async () => {
    const { e } = env({ ia: 'réponse illisible' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonOk(lens)));
    const r = await relais.fetch(envoi(PHOTO), e);
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { description: { type: unknown }; resultats: Proposition[] };
    expect(corps.description.type).toBeNull();
    expect(corps.resultats).toHaveLength(2);
  });
});

describe('relais : /photo', () => {
  it('refuse un identifiant mal formé ou inconnu', async () => {
    const { e } = env();
    expect((await relais.fetch(new Request('https://relais.exemple.test/photo/abc'), e)).status).toBe(404);
    expect((await relais.fetch(new Request(`https://relais.exemple.test/photo/${'a'.repeat(64)}`), e)).status).toBe(404);
  });
});
