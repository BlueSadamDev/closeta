/**
 * Ajout par lien : lecture du lien saisi ou partagé, lecture de la réponse du relais /extract,
 * et préparation du formulaire pré-rempli. Logique pure, sans réseau.
 */
import type { Disponibilite } from './article';
import { prixPourSaisie } from './prix';
import { STATUT_MISE_A_JOUR } from './relais';
import { BROUILLON_VIDE, type Brouillon } from './validation';

/** Données lues sur la page de la boutique ; null = non trouvé (jamais inventé). */
export type Extraction = {
  nom: string | null;
  marque: string | null;
  image: string | null;
  prix: number | null;
  devise: string | null;
  url: string;
  /** Disponibilité publiée par la boutique (globale, et pour la taille demandée) ; `inconnue` sinon. */
  disponibilite: Disponibilite;
  dispoTaille: Disponibilite;
};

/** Raisons pour lesquelles le relais n'a rien rendu d'utilisable. */
export type EchecExtraction =
  | 'jeton_absent'
  | 'jeton_refuse'
  | 'limite'
  | 'mise_a_jour_requise'
  | 'injoignable'
  | 'illisible';

export type ResultatExtraction = { ok: true; extraction: Extraction } | { ok: false; raison: EchecExtraction };

/** Ce que le formulaire peut signaler comme manquant après une extraction. */
export type ChampManquant = 'nom' | 'marque' | 'prix' | 'image';

const PONCTUATION_FINALE = /[.,;:!?)\]}»"'’]+$/;

/**
 * Premier lien web trouvé dans un texte (« Regarde ça : https://… »).
 * Renvoie null s'il n'y en a pas.
 */
export function trouverLien(texte: string | null | undefined): string | null {
  if (!texte) return null;
  const trouve = texte.match(/https?:\/\/[^\s<>"«»]+/i);
  if (!trouve) return null;
  const lien = trouve[0].replace(PONCTUATION_FINALE, '');
  return estLienWeb(lien) ? lien : null;
}

/** Vrai si le texte est un lien web complet (http ou https, avec un nom de site). */
export function estLienWeb(texte: string): boolean {
  try {
    const url = new URL(texte.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** Nom du site à afficher (« boutique.example »), sans « www. ». */
export function nomDuSite(lien: string): string {
  try {
    return new URL(lien).hostname.replace(/^www\./i, '');
  } catch {
    return lien;
  }
}

const texteOuNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const dispo = (v: unknown): Disponibilite => (v === 'en_stock' || v === 'epuise' ? v : 'inconnue');

/**
 * Lit la réponse du relais /extract.
 * @param statut code HTTP reçu, ou null si le relais n'a pas répondu (pas de réseau, délai dépassé).
 * @param corps corps JSON de la réponse, s'il a pu être lu.
 * @param lienDemande lien envoyé, gardé si la réponse n'en contient pas.
 */
export function lireExtraction(statut: number | null, corps: unknown, lienDemande: string): ResultatExtraction {
  if (statut === null) return { ok: false, raison: 'injoignable' };
  if (statut === 401) return { ok: false, raison: 'jeton_absent' };
  if (statut === 403) return { ok: false, raison: 'jeton_refuse' };
  if (statut === 429) return { ok: false, raison: 'limite' };
  if (statut === STATUT_MISE_A_JOUR) return { ok: false, raison: 'mise_a_jour_requise' };
  if (statut !== 200 || typeof corps !== 'object' || corps === null) return { ok: false, raison: 'illisible' };

  const c = corps as Record<string, unknown>;
  const image = texteOuNull(c.image);
  const prix = typeof c.prix === 'number' && Number.isFinite(c.prix) && c.prix > 0 ? c.prix : null;
  const extraction: Extraction = {
    nom: texteOuNull(c.nom),
    marque: texteOuNull(c.marque),
    image: image && /^https:\/\//i.test(image) ? image : null,
    prix,
    devise: texteOuNull(c.devise)?.toUpperCase() ?? null,
    url: texteOuNull(c.url) ?? lienDemande,
    disponibilite: dispo(c.disponibilite),
    dispoTaille: dispo(c.dispo_taille),
  };
  // Une page dont on n'a rien tiré compte comme illisible.
  if (!extraction.nom && !extraction.marque && !extraction.image && extraction.prix === null) {
    return { ok: false, raison: 'illisible' };
  }
  return { ok: true, extraction };
}

/**
 * Formulaire pré-rempli à partir d'une extraction réussie, et liste des champs à compléter.
 * Un prix dans une autre devise que l'euro n'est pas repris : le champ attend des euros.
 */
export function preremplir(extraction: Extraction): { brouillon: Brouillon; image: string | null; manquants: ChampManquant[] } {
  const enEuros = extraction.devise === null || extraction.devise === 'EUR';
  const prix = enEuros ? extraction.prix : null;
  const brouillon: Brouillon = {
    ...BROUILLON_VIDE,
    nom: extraction.nom ?? '',
    marque: extraction.marque ?? '',
    prix: prixPourSaisie(prix),
    urlBoutique: extraction.url,
  };
  const manquants: ChampManquant[] = [];
  if (!extraction.nom) manquants.push('nom');
  if (!extraction.marque) manquants.push('marque');
  if (prix === null) manquants.push('prix');
  if (!extraction.image) manquants.push('image');
  return { brouillon, image: extraction.image, manquants };
}

/** Formulaire quand l'extraction a échoué : vide, avec le lien conservé. */
export function brouillonDepuisLien(lien: string): Brouillon {
  return { ...BROUILLON_VIDE, urlBoutique: lien };
}

/** « a », « a et b », « a, b et c ». */
export function listeFrancaise(elements: readonly string[]): string {
  if (elements.length <= 1) return elements.join('');
  return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`;
}
