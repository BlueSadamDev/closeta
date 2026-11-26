/**
 * Recherche en ligne, indépendante du fournisseur (docs/SPEC.md, « Lot 4 », « Étape 4 ») : forme commune
 * des résultats et interface `FournisseurRecherche`. Seul src/serpapi.ts connaît SerpApi.
 * Un champ introuvable vaut null : rien n'est inventé.
 */
import { settings } from './settings';

export type Proposition = {
  nom: string;
  marque: string | null;
  image: string | null;
  prix: number | null;
  devise: string | null;
  boutique: string | null;
  url: string;
  /** Vrai si c'est un article proche (Google Shopping), pas l'article exact. */
  alternative: boolean;
};

const DEVISES: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', 'CHF': 'CHF' };

/** Devise d'un prix : code à 3 lettres, ou symbole présent dans le texte du prix. */
export function lireDevise(code: unknown, texte: unknown): string | null {
  if (typeof code === 'string') {
    const c = code.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(c)) return c;
    if (DEVISES[code.trim()]) return DEVISES[code.trim()];
  }
  if (typeof texte === 'string') {
    for (const [symbole, iso] of Object.entries(DEVISES)) if (texte.includes(symbole)) return iso;
    const m = texte.match(/\b(EUR|USD|GBP|CHF)\b/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export const siteIgnore = (url: string) => {
  const hote = new URL(url).hostname.toLowerCase();
  // « pinterest. » couvre pinterest.fr, pinterest.com… ; les autres valent pour le site et ses sous-domaines.
  return settings.sitesIgnores.some((s) => (s.endsWith('.') ? hote.includes(s) : hote === s || hote.endsWith(`.${s}`)));
};

export const prixDevant = (propositions: Proposition[]) => [
  ...propositions.filter((p) => p.prix !== null),
  ...propositions.filter((p) => p.prix === null),
];

/**
 * Fournisseur de recherche : Google Lens (recherche visuelle d'une image, par son adresse publique) et
 * Google Shopping (recherche écrite, qui porte déjà le genre choisi). Chaque appel lève une erreur dont le
 * message ne contient aucun secret (clé d'API masquée).
 */
export interface FournisseurRecherche {
  /** Nom du fournisseur (variable RECHERCHE_FOURNISSEUR). */
  readonly nom: string;
  /** `prixDabord` : pièces avec un prix devant ; sinon, ordre de ressemblance de Lens. */
  lens(image: string, prixDabord: boolean): Promise<Proposition[]>;
  shopping(requete: string): Promise<Proposition[]>;
}

