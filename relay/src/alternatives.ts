/**
 * /alternatives : pièces qui ressemblent à une pièce de la Wishlist (docs/SPEC.md, lot 3, étape 2).
 * 1) Google Lens cherche des images proches de celle de la pièce : l'adresse de l'image de la boutique
 *    si elle existe, sinon la photo du téléphone, déposée dans R2 le temps de la recherche.
 * 2) Sont écartés : la page d'origine, les réseaux sociaux, les résultats sans boutique.
 * 3) Classement par ressemblance (ordre de Lens, puis proximité nom / catégorie / couleur) : le prix n'y entre pas.
 * 4) Moins de 3 résultats : Google Shopping complète à partir de nom + marque + catégorie + couleur.
 * Genre choisi dans les Réglages : ajouté à la recherche Shopping ; les résultats de l'autre genre sont écartés.
 */
import { filtrerGenre, GenreInvalide, lireGenre, rechercheAvecGenre, type Genre } from './genre';
import type { Description } from './ia';
import { clePhoto, estJpeg, nouvelIdentifiant, QuotaAtteint, RechercheIndisponible, resume, type Reservation, type Stockage } from './identify';
import { classer } from './pertinence';
import { adresseLens, adresseShopping, appelerSerpApi, lireLens, lireShopping, siteIgnore, type Proposition } from './recherche';
import { settings } from './settings';
import { urlPublique } from './url';

/** Ce que l'app envoie, une fois vérifié. */
export type Demande = {
  /** Image de la pièce sur la boutique (https public), lue directement par Lens. */
  imageUrl: string | null;
  /** Photo du téléphone (JPEG), utilisée seulement s'il n'y a pas d'image de boutique. */
  photo: Uint8Array | null;
  nom: string;
  marque: string | null;
  categorie: string | null;
  couleur: string | null;
  /** Page boutique de la pièce elle-même, à ne pas reproposer. */
  urlExclue: string | null;
  /** Genre choisi dans les Réglages (null = mixte, aucun filtre). */
  genre: Genre | null;
};

/** Une alternative renvoyée à l'app. */
export type Alternative = Omit<Proposition, 'alternative'>;

export class DemandeInvalide extends Error {
  constructor(readonly code: 'requete_invalide' | 'photo_refusee') {
    super(code);
  }
}

const texte = (v: unknown, max = 200): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t.slice(0, max);
};

/** Décode la photo envoyée en base64 ; null si ce n'est pas un JPEG ou s'il est trop lourd. */
export function lirePhotoBase64(v: string): Uint8Array | null {
  // 4 caractères base64 = 3 octets : on refuse avant de décoder ce qui serait trop lourd.
  if (v.length > Math.ceil(settings.tailleMaxPhoto / 3) * 4) return null;
  let binaire: string;
  try {
    binaire = atob(v);
  } catch {
    return null;
  }
  const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  return estJpeg(octets) ? octets : null;
}

/** Vérifie la demande de l'app. Lève DemandeInvalide si elle est inutilisable. */
export function lireDemande(corps: unknown): Demande {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) throw new DemandeInvalide('requete_invalide');
  const c = corps as Record<string, unknown>;
  const nom = texte(c.nom);
  if (!nom) throw new DemandeInvalide('requete_invalide');
  let photo: Uint8Array | null = null;
  if (c.photo !== undefined && c.photo !== null) {
    photo = typeof c.photo === 'string' ? lirePhotoBase64(c.photo) : null;
    if (!photo) throw new DemandeInvalide('photo_refusee');
  }
  // Une adresse d'image non publique est ignorée (Lens ne saurait pas la lire) : la photo prend le relais.
  const image = urlPublique(c.image_url);
  const exclue = urlPublique(c.url_exclue);
  let genre: Genre | null;
  try {
    genre = lireGenre(c.genre);
  } catch (e) {
    if (e instanceof GenreInvalide) throw new DemandeInvalide('requete_invalide');
    throw e;
  }
  return {
    imageUrl: image ? image.toString() : null,
    photo,
    nom,
    marque: texte(c.marque, 80),
    categorie: texte(c.categorie, 40),
    couleur: texte(c.couleur, 40),
    urlExclue: exclue ? exclue.toString() : null,
    genre,
  };
}

/** Clé de comparaison d'une page : site sans « www. », chemin sans « / » final ; paramètres et ancre ignorés. */
export function clePage(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return null;
  }
}

/** Écarte la page d'origine, les réseaux sociaux, les résultats sans boutique et les doublons. */
export function filtrer(propositions: Proposition[], urlExclue: string | null, dejaVues: Set<string> = new Set()): Proposition[] {
  const exclue = urlExclue ? clePage(urlExclue) : null;
  const vues = new Set(dejaVues);
  return propositions.filter((p) => {
    const cle = clePage(p.url);
    if (!cle || cle === exclue || vues.has(cle) || !p.boutique || siteIgnore(p.url)) return false;
    vues.add(cle);
    return true;
  });
}

/**
 * Recherche écrite pour Google Shopping : nom, marque, catégorie, couleur, sans répéter ce que le nom dit déjà,
 * puis le genre choisi dans les Réglages.
 */
export function rechercheTexte(d: Pick<Demande, 'nom' | 'marque' | 'categorie' | 'couleur'> & { genre?: Genre | null }): string {
  let recherche = d.nom;
  for (const morceau of [d.marque, d.categorie, d.couleur]) {
    if (morceau && !recherche.toLowerCase().includes(morceau.toLowerCase())) recherche += ` ${morceau}`;
  }
  return rechercheAvecGenre(recherche, d.genre ?? null);
}

/** Ce que l'on sait de la pièce, sous la forme attendue par le classement par ressemblance. */
export const descriptionDe = (d: Demande): Description => ({
  type: null,
  categorie: d.categorie,
  couleur: d.couleur,
  matiere: null,
  marque: d.marque,
  recherche: d.nom,
});

/** Liste finale : Lens d'abord, Shopping en complément, chaque groupe classé par ressemblance, au plus 5. */
export function assemblerAlternatives(lens: Proposition[], shopping: Proposition[], d: Demande): Alternative[] {
  const description = descriptionDe(d);
  const retenusLens = filtrer(filtrerGenre(lens, d.genre), d.urlExclue);
  const complement =
    retenusLens.length >= settings.resultatsMin
      ? []
      : filtrer(filtrerGenre(shopping, d.genre), d.urlExclue, new Set(retenusLens.map((p) => clePage(p.url) ?? '')));
  return [...classer(retenusLens, description), ...classer(complement, description)]
    .slice(0, settings.resultatsMax)
    .map(({ alternative: _a, ...reste }) => reste);
}

/**
 * Enchaîne Lens puis, si besoin, Shopping. Chaque appel SerpApi est d'abord réservé auprès du compteur.
 * Lève QuotaAtteint si le seuil a empêché toute recherche, RechercheIndisponible si aucune n'a abouti.
 */
export async function chercherAlternatives(
  d: Demande,
  outils: { stockage: Stockage; cleSerpApi: string | undefined; quota: Reservation; adressePhoto: (id: string) => string },
): Promise<{ resultats: Alternative[]; incidents?: string[] }> {
  const { stockage, cleSerpApi, quota } = outils;
  const incidents: string[] = [];

  const lens = async (): Promise<Proposition[] | null> => {
    if (!d.imageUrl && !d.photo) return null;
    if (!cleSerpApi) {
      incidents.push('cle_serpapi_absente');
      return null;
    }
    if (!(await quota.reserver())) {
      incidents.push('quota_atteint');
      return null;
    }
    // Image de la boutique : Lens la lit directement, rien n'est déposé.
    if (d.imageUrl) {
      try {
        return lireLens(await appelerSerpApi(adresseLens(cleSerpApi, d.imageUrl), settings.delaiLensMs), false);
      } catch (e) {
        incidents.push(`lens: ${resume(e, cleSerpApi)}`);
        return null;
      }
    }
    const id = nouvelIdentifiant();
    try {
      await stockage.put(clePhoto(id), d.photo as Uint8Array, { httpMetadata: { contentType: 'image/jpeg' } });
    } catch (e) {
      incidents.push(`stockage: ${resume(e, cleSerpApi)}`);
      return null;
    }
    try {
      return lireLens(await appelerSerpApi(adresseLens(cleSerpApi, outils.adressePhoto(id)), settings.delaiLensMs), false);
    } catch (e) {
      incidents.push(`lens: ${resume(e, cleSerpApi)}`);
      return null;
    } finally {
      // La photo ne sert qu'à Lens : supprimée aussitôt.
      await stockage.delete(clePhoto(id)).catch(() => undefined);
    }
  };

  const trouves = await lens();
  const retenus = filtrer(filtrerGenre(trouves ?? [], d.genre), d.urlExclue).length;

  // null = recherche Shopping non faite ou en échec.
  let shopping: Proposition[] | null = null;
  if (retenus < settings.resultatsMin && cleSerpApi) {
    if (await quota.reserver()) {
      try {
        shopping = lireShopping(await appelerSerpApi(adresseShopping(cleSerpApi, rechercheTexte(d)), settings.delaiShoppingMs));
      } catch (e) {
        incidents.push(`shopping: ${resume(e, cleSerpApi)}`);
      }
    } else if (!incidents.includes('quota_atteint')) {
      incidents.push('quota_atteint');
    }
  } else if (!cleSerpApi && !incidents.includes('cle_serpapi_absente')) {
    incidents.push('cle_serpapi_absente');
  }

  if (trouves === null && shopping === null) {
    throw incidents.includes('quota_atteint') ? new QuotaAtteint() : new RechercheIndisponible(incidents);
  }

  const resultats = assemblerAlternatives(trouves ?? [], shopping ?? [], d);
  return incidents.length > 0 ? { resultats, incidents } : { resultats };
}
