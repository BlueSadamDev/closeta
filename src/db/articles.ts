import type { Article } from '@/domain/article';

type Valeur = string | number | null;

/** Ce dont ce fichier a besoin de la base (fourni par expo-sqlite, ou par une base de test). */
export interface BaseArticles {
  runAsync(sql: string, params: Valeur[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: Valeur[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: Valeur[]): Promise<T | null>;
}

/** Une ligne de la table article, telle que SQLite la renvoie. */
type Ligne = {
  id: string;
  nom: string;
  marque: string | null;
  type: Article['type'];
  categorie: string | null;
  taille: string | null;
  couleur: string | null;
  prix: number | null;
  devise: string | null;
  url_boutique: string | null;
  image_locale: string | null;
  image_source: string | null;
  priorite: Article['priorite'];
  notes: string | null;
  statut: Article['statut'];
  origine: Article['origine'];
  est_alternative: number;
  date_ajout: string;
  date_achat: string | null;
  date_maj: string;
};

const versArticle = (l: Ligne): Article => ({
  id: l.id,
  nom: l.nom,
  marque: l.marque,
  type: l.type,
  categorie: l.categorie,
  taille: l.taille,
  couleur: l.couleur,
  prix: l.prix,
  devise: l.devise,
  urlBoutique: l.url_boutique,
  imageLocale: l.image_locale,
  imageSource: l.image_source,
  priorite: l.priorite,
  notes: l.notes,
  statut: l.statut,
  origine: l.origine,
  estAlternative: l.est_alternative === 1,
  dateAjout: l.date_ajout,
  dateAchat: l.date_achat,
  dateMaj: l.date_maj,
});

const COLONNES = [
  'id', 'nom', 'marque', 'type', 'categorie', 'taille', 'couleur', 'prix', 'devise', 'url_boutique',
  'image_locale', 'image_source', 'priorite', 'notes', 'statut', 'origine', 'est_alternative',
  'date_ajout', 'date_achat', 'date_maj',
] as const;

const valeurs = (a: Article): Valeur[] => [
  a.id, a.nom, a.marque, a.type, a.categorie, a.taille, a.couleur, a.prix, a.devise, a.urlBoutique,
  a.imageLocale, a.imageSource, a.priorite, a.notes, a.statut, a.origine, a.estAlternative ? 1 : 0,
  a.dateAjout, a.dateAchat, a.dateMaj,
];

/** Tous les articles de la Wishlist (statut souhaité). */
export async function lireWishlist(db: BaseArticles): Promise<Article[]> {
  const lignes = await db.getAllAsync<Ligne>("SELECT * FROM article WHERE statut = 'souhaite'", []);
  return lignes.map(versArticle);
}

export async function lireArticle(db: BaseArticles, id: string): Promise<Article | null> {
  const ligne = await db.getFirstAsync<Ligne>('SELECT * FROM article WHERE id = ?', [id]);
  return ligne ? versArticle(ligne) : null;
}

/** Ajoute un nouvel article, ou remplace celui qui a le même identifiant. */
export async function enregistrerArticle(db: BaseArticles, a: Article): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO article (${COLONNES.join(', ')}) VALUES (${COLONNES.map(() => '?').join(', ')})`,
    valeurs(a),
  );
}

/** Efface réellement l'article (l'image locale est effacée par l'appelant, quand il y en aura). */
export async function supprimerArticle(db: BaseArticles, id: string): Promise<void> {
  await db.runAsync('DELETE FROM article WHERE id = ?', [id]);
}
