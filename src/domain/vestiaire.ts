import type { Article, Origine } from './article';
import { comparerMarques, trier } from './wishlist';

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

export type TriVestiaire = 'achat' | 'prix' | 'marque';
export const TRIS_VESTIAIRE: readonly TriVestiaire[] = ['achat', 'prix', 'marque'];

/**
 * achat : plus récent d'abord ; prix : moins cher d'abord, sans prix à la fin (même règle que la Wishlist) ;
 * marque : alphabétique, sans marque à la fin, puis achat le plus récent d'abord.
 */
export function trierVestiaire(articles: readonly Article[], tri: TriVestiaire): Article[] {
  if (tri === 'achat') return trierParAchat(articles);
  if (tri === 'marque') return trierParAchat(articles).sort(comparerMarques);
  return trier(articles, 'prix');
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

const deux = (n: number) => String(n).padStart(2, '0');

/** « 14/11/2026 » pour le champ « Date d'achat », à l'heure du téléphone ; '' si la date manque. */
export function dateAchatPourSaisie(dateIso: string | null): string {
  const date = dateIso ? new Date(dateIso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${deux(date.getDate())}/${deux(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Lit la date d'achat saisie (JJ/MM/AAAA, séparée par / . ou -) : null si le champ est vide,
 * 'invalide' si la date n'existe pas ou est à venir. La date est rangée à midi, heure du téléphone,
 * pour ne jamais changer de jour ni de mois selon le fuseau.
 */
export function lireDateAchat(saisie: string, maintenant: Date): string | null | 'invalide' {
  const texte = saisie.trim();
  if (texte === '') return null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte);
  if (!m) return 'invalide';
  const [jour, mois, annee] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(annee, mois - 1, jour, 12);
  if (date.getFullYear() !== annee || date.getMonth() !== mois - 1 || date.getDate() !== jour) return 'invalide';
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), 12);
  if (date.getTime() > aujourdhui.getTime()) return 'invalide';
  return date.toISOString();
}

/** Où va une nouvelle pièce : la Wishlist, ou directement le Vestiaire. */
export type Destination = 'wishlist' | 'vestiaire';

/**
 * Statut et date de vérification d'une nouvelle pièce.
 * Vestiaire : statut acheté, jamais relu auprès de la boutique (docs/SPEC.md, « Étape 6 »).
 * Wishlist : souhaitée ; un ajout par lien vient de lire la page boutique.
 */
export function etatDeDepart(
  destination: Destination,
  origine: Origine,
  maintenant: string,
): Pick<Article, 'statut' | 'dateVerif'> {
  if (destination === 'vestiaire') return { statut: 'achete', dateVerif: null };
  return { statut: 'souhaite', dateVerif: origine === 'lien' ? maintenant : null };
}
