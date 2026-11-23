/**
 * Ajout par photo : taille de la photo envoyée, lecture de la réponse du relais /identify,
 * et préparation du formulaire pré-rempli. Logique pure, sans réseau.
 */
import type { TypeArticle } from './article';
import type { ChampManquant } from './lien';
import { prixPourSaisie } from './prix';
import { BROUILLON_VIDE, type Brouillon } from './validation';

/** Ce que l'IA a vu sur la photo ; null = non vu (jamais inventé). */
export type DescriptionPhoto = {
  type: TypeArticle | null;
  categorie: string | null;
  couleur: string | null;
  marque: string | null;
};

/** Une pièce proposée par le relais ; `alternative` = article proche, pas l'article exact. */
export type Proposition = {
  nom: string;
  marque: string | null;
  image: string | null;
  prix: number | null;
  devise: string | null;
  boutique: string | null;
  url: string;
  alternative: boolean;
};

export type EchecIdentification =
  | 'jeton_absent'
  | 'jeton_refuse'
  | 'limite'
  | 'quota_atteint'
  | 'injoignable'
  | 'indisponible'
  | 'photo_refusee';

export type ResultatIdentification =
  | { ok: true; description: DescriptionPhoto; propositions: Proposition[] }
  | { ok: false; raison: EchecIdentification };

export const DESCRIPTION_VIDE: DescriptionPhoto = { type: null, categorie: null, couleur: null, marque: null };

/** Nombre maximal de propositions affichées (docs/SPEC.md : 3 à 5). */
export const PROPOSITIONS_MAX = 5;

/**
 * Redimensionnement à demander pour que le plus grand côté ne dépasse pas `max` pixels.
 * Renvoie null si la photo est déjà assez petite.
 */
export function reduction(largeur: number, hauteur: number, max: number): { width: number } | { height: number } | null {
  if (!(largeur > 0) || !(hauteur > 0) || Math.max(largeur, hauteur) <= max) return null;
  return largeur >= hauteur ? { width: max } : { height: max };
}

export type Rectangle = { originX: number; originY: number; width: number; height: number };

/**
 * Partie de la photo à garder pour le format portrait 3:4 (Vestiaire) : le plus grand rectangle 3:4
 * centré, puis réduit de `marge` (part de sa largeur et de sa hauteur) sur chaque bord, comme le cadre
 * dessiné sur l'aperçu. En pixels entiers, toujours dans la photo. null si la taille est illisible.
 */
export function recadrage34(largeur: number, hauteur: number, marge = 0): Rectangle | null {
  if (!(largeur > 0) || !(hauteur > 0) || !(marge >= 0) || !(marge < 0.5)) return null;
  // Plus grand 3:4 centré : toute la hauteur si la photo est plus large que 3:4, sinon toute la largeur.
  const pleineHauteur = largeur * 4 >= hauteur * 3;
  const l = pleineHauteur ? (hauteur * 3) / 4 : largeur;
  const h = pleineHauteur ? hauteur : (largeur * 4) / 3;
  const width = Math.max(1, Math.floor(l * (1 - 2 * marge)));
  const height = Math.max(1, Math.min(Math.floor(h * (1 - 2 * marge)), Math.round((width * 4) / 3)));
  return {
    originX: Math.floor((largeur - width) / 2),
    originY: Math.floor((hauteur - height) / 2),
    width,
    height,
  };
}

const texte = (v: unknown, max = 200): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t.slice(0, max);
};
const https = (v: unknown): string | null => {
  const t = texte(v, 2048);
  return t && /^https:\/\/[^\s]+$/i.test(t) ? t : null;
};
const objet = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function lireProposition(v: unknown): Proposition | null {
  const o = objet(v);
  if (!o) return null;
  const nom = texte(o.nom);
  const url = https(o.url);
  if (!nom || !url) return null;
  const prix = typeof o.prix === 'number' && Number.isFinite(o.prix) && o.prix > 0 ? o.prix : null;
  return {
    nom,
    marque: texte(o.marque, 80),
    image: https(o.image),
    prix,
    devise: prix === null ? null : (texte(o.devise, 3)?.toUpperCase() ?? null),
    boutique: texte(o.boutique, 80),
    url,
    alternative: o.alternative === true,
  };
}

function lireDescription(v: unknown): DescriptionPhoto {
  const o = objet(v);
  if (!o) return DESCRIPTION_VIDE;
  return {
    type: o.type === 'vetement' || o.type === 'chaussures' ? o.type : null,
    categorie: texte(o.categorie, 40),
    couleur: texte(o.couleur, 40),
    marque: texte(o.marque, 80),
  };
}

/**
 * Lit la réponse du relais /identify.
 * @param statut code HTTP reçu, ou null si le relais n'a pas répondu (pas de réseau, délai dépassé).
 * @param corps corps JSON de la réponse, s'il a pu être lu.
 * Une liste vide est un résultat (« rien trouvé »), pas un échec.
 */
export function lireIdentification(statut: number | null, corps: unknown): ResultatIdentification {
  if (statut === null) return { ok: false, raison: 'injoignable' };
  if (statut === 401) return { ok: false, raison: 'jeton_absent' };
  if (statut === 403) return { ok: false, raison: 'jeton_refuse' };
  const c = objet(corps);
  // 429 : seuil mensuel de recherches atteint, ou trop de demandes en une minute.
  if (statut === 429) return { ok: false, raison: c?.erreur === 'quota_atteint' ? 'quota_atteint' : 'limite' };
  if (statut === 400) return { ok: false, raison: 'photo_refusee' };
  if (statut !== 200 || !c || !Array.isArray(c.resultats)) return { ok: false, raison: 'indisponible' };
  const vues = new Set<string>();
  const propositions: Proposition[] = [];
  for (const brut of c.resultats) {
    const p = lireProposition(brut);
    if (p && !vues.has(p.url)) {
      vues.add(p.url);
      propositions.push(p);
    }
  }
  return { ok: true, description: lireDescription(c.description), propositions: propositions.slice(0, PROPOSITIONS_MAX) };
}

/** Vrai si aucune proposition n'est l'article exact (la liste n'affiche que des alternatives). */
export const seulementDesAlternatives = (propositions: readonly Proposition[]) =>
  propositions.length > 0 && propositions.every((p) => p.alternative);

/** Formulaire à partir de ce que l'IA a vu, sans proposition choisie (« Saisir à la main » après une photo). */
export function brouillonDepuisDescription(description: DescriptionPhoto): Brouillon {
  return {
    ...BROUILLON_VIDE,
    marque: description.marque ?? '',
    type: description.type,
    categorie: description.categorie ?? '',
    couleur: description.couleur ?? '',
  };
}

/**
 * Formulaire pré-rempli à partir de la proposition choisie, complété par ce que l'IA a vu.
 * Un prix dans une autre devise que l'euro n'est pas repris : le champ attend des euros.
 */
export function preremplirDepuisProposition(
  p: Proposition,
  description: DescriptionPhoto,
): { brouillon: Brouillon; manquants: ChampManquant[] } {
  const prix = p.devise === null || p.devise === 'EUR' ? p.prix : null;
  // La marque vue sur la photo n'est pas reportée sur une autre pièce : seule celle de la proposition compte.
  const marque = p.marque;
  const brouillon: Brouillon = {
    ...brouillonDepuisDescription(description),
    nom: p.nom,
    marque: marque ?? '',
    prix: prixPourSaisie(prix),
    urlBoutique: p.url,
  };
  const manquants: ChampManquant[] = [];
  if (!marque) manquants.push('marque');
  if (prix === null) manquants.push('prix');
  return { brouillon, manquants };
}

const json = (texte: string | undefined): unknown => {
  if (!texte) return null;
  try {
    return JSON.parse(texte);
  } catch {
    return null;
  }
};

/**
 * Relit ce que l'écran « Par photo » transmet au formulaire (texte JSON dans l'adresse de l'écran).
 * Une donnée abîmée vaut « rien » : le formulaire s'ouvre alors simplement avec la photo.
 */
export function lireParametresPhoto(
  description: string | undefined,
  proposition: string | undefined,
): { description: DescriptionPhoto; proposition: Proposition | null } {
  return {
    description: lireDescription(json(description)),
    proposition: lireProposition(json(proposition)),
  };
}
