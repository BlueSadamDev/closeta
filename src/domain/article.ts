/**
 * Un article de la wishlist (ou, plus tard, du vestiaire).
 * Modèle : docs/SPEC.md, « Modèle de données ». Les noms suivent la base, en camelCase.
 */
export type TypeArticle = 'vetement' | 'chaussures';
export type Priorite = 'forte' | 'moyenne' | 'un_jour';
export type Statut = 'souhaite' | 'achete' | 'abandonne';
export type Origine = 'manuel' | 'lien' | 'photo';

export type Article = {
  id: string;
  nom: string;
  marque: string | null;
  type: TypeArticle;
  categorie: string | null;
  taille: string | null;
  couleur: string | null;
  /** Prix en euros, null s'il reste à compléter. */
  prix: number | null;
  devise: string | null;
  urlBoutique: string | null;
  imageLocale: string | null;
  imageSource: string | null;
  priorite: Priorite;
  notes: string | null;
  statut: Statut;
  origine: Origine;
  estAlternative: boolean;
  /** Dates au format ISO (ex. 2026-11-20T08:00:00.000Z). */
  dateAjout: string;
  dateAchat: string | null;
  dateMaj: string;
};

export const PRIORITES: readonly Priorite[] = ['forte', 'moyenne', 'un_jour'];

/** Catégories proposées selon le type (on peut aussi en saisir une autre). */
export const CATEGORIES: Record<TypeArticle, readonly string[]> = {
  vetement: ['Haut', 'Chemise', 'Pull', 'Maille', 'Pantalon', 'Jean', 'Veste', 'Manteau'],
  chaussures: ['Baskets', 'Mocassins', 'Derbies', 'Bottines', 'Sandales'],
};

/** « Je l'ai acheté » : l'article passe en acheté, rien n'est supprimé. */
export function marquerAchete(article: Article, maintenant: Date): Article {
  const date = maintenant.toISOString();
  return { ...article, statut: 'achete', dateAchat: date, dateMaj: date };
}

/** « Remettre dans la Wishlist » : l'article redevient souhaité et perd sa date d'achat. */
export function remettreEnWishlist(article: Article, maintenant: Date): Article {
  return { ...article, statut: 'souhaite', dateAchat: null, dateMaj: maintenant.toISOString() };
}
