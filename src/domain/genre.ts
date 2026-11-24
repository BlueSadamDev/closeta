/**
 * Genre des recherches d'alternatives, choisi dans les Réglages (docs/SPEC.md, lot 3, étape 12).
 * Rangé sur le téléphone seulement ; « mixte » (par défaut) n'envoie rien au relais.
 */
export const GENRES = ['femme', 'homme', 'mixte'] as const;
export type GenreRecherche = (typeof GENRES)[number];

/** Valeur rangée sur le téléphone → genre ; absente ou inconnue = mixte. */
export function lireGenreRecherche(v: string | null | undefined): GenreRecherche {
  return GENRES.find((g) => g === v) ?? 'mixte';
}

/** Ce qui part au relais : « femme » ou « homme », rien pour mixte. */
export function genrePourRelais(g: GenreRecherche): 'femme' | 'homme' | null {
  return g === 'mixte' ? null : g;
}
