/**
 * Relevés de prix : l'historique du prix d'une pièce de la Wishlist.
 * Un relevé = une lecture du prix (à l'ajout, par le relais, ou modifié à la main).
 * Règles : docs/SPEC.md, « Lot 3 », « Modèle de données ».
 */
import type { Article, Disponibilite } from './article';

/** D'où vient le relevé : ajout par lien ou photo, relecture par le relais, modification à la main. */
export type SourceReleve = 'ajout' | 'relais' | 'manuel';

export type RelevePrix = {
  id: string;
  articleId: string;
  /** Date au format ISO. */
  date: string;
  prix: number | null;
  devise: string | null;
  disponibilite: Disponibilite;
  dispoTaille: Disponibilite;
  source: SourceReleve;
};

/**
 * Le relevé à créer quand on enregistre une pièce, ou null s'il n'y en a pas.
 * - Ajout par lien ou par photo, avec un prix : relevé « ajout ».
 * - Prix modifié à la main sur une pièce de la Wishlist : relevé « manuel ».
 * Pas de relevé sans prix, ni pour un ajout à la main, ni pour une pièce du Vestiaire (prix payé).
 */
export function releveAEnregistrer(avant: Article | null, apres: Article, id: string): RelevePrix | null {
  if (apres.prix === null) return null;
  const source: SourceReleve | null = !avant
    ? apres.origine === 'manuel'
      ? null
      : 'ajout'
    : apres.statut === 'souhaite' && avant.prix !== apres.prix
      ? 'manuel'
      : null;
  if (!source) return null;
  return {
    id,
    articleId: apres.id,
    date: avant ? apres.dateMaj : apres.dateAjout,
    prix: apres.prix,
    devise: apres.devise,
    disponibilite: apres.disponibilite,
    dispoTaille: apres.dispoTaille,
    source,
  };
}
