/**
 * Genre choisi dans les Réglages de l'app (« Je cherche pour »), appliqué aux recherches d'alternatives
 * (docs/SPEC.md, lot 3, étape 12). Absent = mixte : aucun filtre.
 * - Google Shopping : « femme » ou « homme » ajouté à la recherche écrite.
 * - Résultats : ceux dont le nom désigne l'autre genre sont écartés.
 */
import type { Proposition } from './recherche';

export type Genre = 'femme' | 'homme';

export class GenreInvalide extends Error {
  constructor() {
    super('requete_invalide');
  }
}

/** Absent ou vide = mixte (null) ; « femme » ou « homme » ; toute autre valeur est refusée. */
export function lireGenre(v: unknown): Genre | null {
  if (v === undefined || v === null || v === '' || v === 'mixte') return null;
  if (v === 'femme' || v === 'homme') return v;
  throw new GenreInvalide();
}

const simplifie = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Mots qui désignent chaque genre dans le nom d'un article (français et anglais). */
const MOTS: Record<Genre, RegExp> = {
  femme: /\b(femmes?|women'?s?|woman'?s?|ladies|lady|filles?|girls?)\b/,
  homme: /\b(hommes?|men'?s?|man'?s?|garcons?|boys?)\b/,
};

const AUTRE: Record<Genre, Genre> = { femme: 'homme', homme: 'femme' };

/** Ajoute le genre à la recherche écrite, sauf si elle le précise déjà. */
export function rechercheAvecGenre(recherche: string, genre: Genre | null): string {
  if (!genre || MOTS[genre].test(simplifie(recherche))) return recherche;
  return `${recherche} ${genre}`;
}

/** Écarte les résultats dont le nom désigne l'autre genre ; un nom qui cite les deux (« unisexe ») est gardé. */
export function filtrerGenre<T extends Pick<Proposition, 'nom'>>(propositions: T[], genre: Genre | null): T[] {
  if (!genre) return propositions;
  return propositions.filter((p) => {
    const nom = simplifie(p.nom);
    return !MOTS[AUTRE[genre]].test(nom) || MOTS[genre].test(nom);
  });
}
