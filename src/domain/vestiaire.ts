import type { Article } from './article';
import { trier } from './wishlist';

/** Seuls les articles achetés sont dans le Vestiaire. */
export const articlesDuVestiaire = (articles: readonly Article[]) =>
  articles.filter((a) => a.statut === 'achete');

/** Ordre par défaut du Vestiaire : date d'achat, la plus récente d'abord (sans date à la fin). */
export function trierParAchat(articles: readonly Article[]): Article[] {
  return [...articles].sort((a, b) => {
    if (a.dateAchat === b.dateAchat) return b.dateAjout.localeCompare(a.dateAjout);
    if (a.dateAchat === null) return 1;
    if (b.dateAchat === null) return -1;
    return b.dateAchat.localeCompare(a.dateAchat);
  });
}

export type TriVestiaire = 'achat' | 'prix';
export const TRIS_VESTIAIRE: readonly TriVestiaire[] = ['achat', 'prix'];

/** achat : plus récent d'abord ; prix : moins cher d'abord, sans prix à la fin (même règle que la Wishlist). */
export function trierVestiaire(articles: readonly Article[], tri: TriVestiaire): Article[] {
  return tri === 'achat' ? trierParAchat(articles) : trier(articles, 'prix');
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

const MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
] as const;

/** « nov. 2026 », à l'heure du téléphone ; null si la date manque ou est illisible. */
export function moisAchat(dateIso: string | null): string | null {
  const date = dateIso ? new Date(dateIso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${MOIS_COURTS[date.getMonth()]} ${date.getFullYear()}`;
}

/** « 22 novembre 2026 » (« 1er » le premier du mois), à l'heure du téléphone ; null si la date manque. */
export function dateAchatLongue(dateIso: string | null): string | null {
  const date = dateIso ? new Date(dateIso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const jour = date.getDate() === 1 ? '1er' : String(date.getDate());
  return `${jour} ${MOIS[date.getMonth()]} ${date.getFullYear()}`;
}
