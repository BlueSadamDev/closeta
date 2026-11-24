/**
 * Alternatives d'une pièce de la Wishlist (docs/SPEC.md, lot 3, étape 2) : demande envoyée au relais
 * /alternatives, lecture de sa réponse, écart de prix et formulaire pré-rempli. Logique pure, sans réseau.
 */
import type { Article } from './article';
import type { ChampManquant } from './lien';
import { lireProposition } from './photo';
import { enCentimes, prixPourSaisie } from './prix';
import { STATUT_MISE_A_JOUR } from './relais';
import { BROUILLON_VIDE, type Brouillon } from './validation';

/** Une pièce proche renvoyée par le relais ; null = non trouvé (jamais inventé). */
export type Alternative = {
  nom: string;
  marque: string | null;
  image: string | null;
  prix: number | null;
  devise: string | null;
  boutique: string | null;
  url: string;
};

export type EchecAlternatives =
  | 'jeton_absent'
  | 'jeton_refuse'
  | 'limite'
  | 'quota_atteint'
  | 'mise_a_jour_requise'
  | 'injoignable'
  | 'indisponible'
  | 'photo_refusee';

export type ResultatAlternatives = { ok: true; alternatives: Alternative[] } | { ok: false; raison: EchecAlternatives };

/** Nombre maximal d'alternatives affichées (docs/SPEC.md : au plus 5). */
export const ALTERNATIVES_MAX = 5;

/**
 * Image sur laquelle chercher : l'adresse de l'image de la boutique si elle existe (rien à envoyer),
 * sinon la photo rangée sur le téléphone, sinon aucune (la recherche se fait alors par le texte).
 */
export function imagePourRecherche(a: Pick<Article, 'imageSource' | 'imageLocale'>): { url: string } | { fichier: string } | null {
  if (a.imageSource && /^https:\/\//i.test(a.imageSource)) return { url: a.imageSource };
  if (a.imageLocale) return { fichier: a.imageLocale };
  return null;
}

/** Corps de la demande envoyée au relais. `photo` : JPEG en base64, seulement sans image de boutique. */
export function demandeAlternatives(a: Article, photo: string | null): Record<string, string | null> {
  const image = imagePourRecherche(a);
  return {
    ...(image && 'url' in image ? { image_url: image.url } : {}),
    ...(photo && !(image && 'url' in image) ? { photo } : {}),
    nom: a.nom,
    marque: a.marque,
    categorie: a.categorie,
    couleur: a.couleur,
    url_exclue: a.urlBoutique,
  };
}

/** Une alternative lue (ou relue depuis l'adresse d'un écran) ; null si elle est inutilisable. */
export function lireAlternative(v: unknown): Alternative | null {
  const p = lireProposition(v);
  if (!p) return null;
  const { alternative: _a, ...alternative } = p;
  return alternative;
}

/**
 * Lit la réponse du relais /alternatives.
 * @param statut code HTTP reçu, ou null si le relais n'a pas répondu (pas de réseau, délai dépassé).
 * Une liste vide est un résultat (« rien de proche »), pas un échec.
 */
export function lireAlternatives(statut: number | null, corps: unknown): ResultatAlternatives {
  if (statut === null) return { ok: false, raison: 'injoignable' };
  if (statut === 401) return { ok: false, raison: 'jeton_absent' };
  if (statut === 403) return { ok: false, raison: 'jeton_refuse' };
  if (statut === STATUT_MISE_A_JOUR) return { ok: false, raison: 'mise_a_jour_requise' };
  const c = typeof corps === 'object' && corps !== null ? (corps as Record<string, unknown>) : null;
  if (statut === 429) return { ok: false, raison: c?.erreur === 'quota_atteint' ? 'quota_atteint' : 'limite' };
  if (statut === 400) return { ok: false, raison: c?.erreur === 'photo_refusee' ? 'photo_refusee' : 'indisponible' };
  if (statut !== 200 || !c || !Array.isArray(c.resultats)) return { ok: false, raison: 'indisponible' };
  const vues = new Set<string>();
  const alternatives: Alternative[] = [];
  for (const brut of c.resultats) {
    const a = lireAlternative(brut);
    if (a && !vues.has(a.url)) {
      vues.add(a.url);
      alternatives.push(a);
    }
  }
  return { ok: true, alternatives: alternatives.slice(0, ALTERNATIVES_MAX) };
}

/** Prix de l'alternative en euros, ou null s'il manque ou s'il est dans une autre devise. */
const prixEnEuros = (a: Pick<Alternative, 'prix' | 'devise'>) => (a.devise === null || a.devise === 'EUR' ? a.prix : null);

export type EcartPrix = { sens: 'moins' | 'plus' | 'egal'; euros: number };

/**
 * Écart de prix entre l'alternative et la pièce : « 30 € de moins », « 12 € de plus », « Même prix ».
 * null s'il manque un des deux prix, ou si l'alternative n'est pas en euros : rien n'est deviné.
 */
export function ecartPrix(prixPiece: number | null, a: Pick<Alternative, 'prix' | 'devise'>): EcartPrix | null {
  const prix = prixEnEuros(a);
  if (prixPiece === null || prix === null) return null;
  const centimes = enCentimes(prix) - enCentimes(prixPiece);
  if (centimes === 0) return { sens: 'egal', euros: 0 };
  return { sens: centimes < 0 ? 'moins' : 'plus', euros: Math.abs(centimes) / 100 };
}

/**
 * Formulaire pré-rempli à partir de l'alternative choisie. Le type et la catégorie viennent
 * de la pièce d'origine (même genre de pièce) ; la couleur, elle, peut changer.
 */
export function preremplirDepuisAlternative(
  a: Alternative,
  origine: { type: Article['type'] | null; categorie: string | null },
): { brouillon: Brouillon; manquants: ChampManquant[] } {
  const prix = prixEnEuros(a);
  const brouillon: Brouillon = {
    ...BROUILLON_VIDE,
    nom: a.nom,
    marque: a.marque ?? '',
    type: origine.type,
    categorie: origine.categorie ?? '',
    prix: prixPourSaisie(prix),
    urlBoutique: a.url,
  };
  const manquants: ChampManquant[] = [];
  if (!a.marque) manquants.push('marque');
  if (prix === null) manquants.push('prix');
  if (!a.image) manquants.push('image');
  return { brouillon, manquants };
}

/** Relit l'alternative transmise au formulaire (texte JSON dans l'adresse de l'écran) ; abîmée = null. */
export function lireParametreAlternative(texte: string | undefined): Alternative | null {
  if (!texte) return null;
  try {
    return lireAlternative(JSON.parse(texte));
  } catch {
    return null;
  }
}
