import type { Article } from '@/domain/article';
import type { RelevePrix } from '@/domain/releve';

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
  prix_ajout: number | null;
  disponibilite: Article['disponibilite'];
  dispo_taille: Article['dispoTaille'];
  date_verif: string | null;
  alternative_de: string | null;
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
  prixAjout: l.prix_ajout,
  disponibilite: l.disponibilite,
  dispoTaille: l.dispo_taille,
  dateVerif: l.date_verif,
  alternativeDe: l.alternative_de,
});

const COLONNES = [
  'id', 'nom', 'marque', 'type', 'categorie', 'taille', 'couleur', 'prix', 'devise', 'url_boutique',
  'image_locale', 'image_source', 'priorite', 'notes', 'statut', 'origine', 'est_alternative',
  'date_ajout', 'date_achat', 'date_maj', 'prix_ajout', 'disponibilite', 'dispo_taille', 'date_verif',
  'alternative_de',
] as const;

const valeurs = (a: Article): Valeur[] => [
  a.id, a.nom, a.marque, a.type, a.categorie, a.taille, a.couleur, a.prix, a.devise, a.urlBoutique,
  a.imageLocale, a.imageSource, a.priorite, a.notes, a.statut, a.origine, a.estAlternative ? 1 : 0,
  a.dateAjout, a.dateAchat, a.dateMaj, a.prixAjout, a.disponibilite, a.dispoTaille, a.dateVerif,
  a.alternativeDe,
];

/** Tous les articles de la Wishlist (statut souhaité). */
export async function lireWishlist(db: BaseArticles): Promise<Article[]> {
  const lignes = await db.getAllAsync<Ligne>("SELECT * FROM article WHERE statut = 'souhaite'", []);
  return lignes.map(versArticle);
}

/** Tous les articles du Vestiaire (statut acheté). */
export async function lireVestiaire(db: BaseArticles): Promise<Article[]> {
  const lignes = await db.getAllAsync<Ligne>("SELECT * FROM article WHERE statut = 'achete'", []);
  return lignes.map(versArticle);
}

export async function lireArticle(db: BaseArticles, id: string): Promise<Article | null> {
  const ligne = await db.getFirstAsync<Ligne>('SELECT * FROM article WHERE id = ?', [id]);
  return ligne ? versArticle(ligne) : null;
}

/**
 * Ajoute un nouvel article, ou remplace celui qui a le même identifiant.
 * `releve` : relevé de prix à ajouter à l'historique en même temps (voir releveAEnregistrer).
 */
export async function enregistrerArticle(db: BaseArticles, a: Article, releve: RelevePrix | null = null): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO article (${COLONNES.join(', ')}) VALUES (${COLONNES.map(() => '?').join(', ')})`,
    valeurs(a),
  );
  if (releve) await enregistrerReleve(db, releve);
}

/** Efface réellement l'article et son historique de prix (l'image locale est effacée par l'appelant : effacerImage). */
export async function supprimerArticle(db: BaseArticles, id: string): Promise<void> {
  await db.runAsync('DELETE FROM releve_prix WHERE article_id = ?', [id]);
  await db.runAsync('DELETE FROM article WHERE id = ?', [id]);
}

// --- Relevés de prix ---

type LigneReleve = {
  id: string;
  article_id: string;
  date: string;
  prix: number | null;
  devise: string | null;
  disponibilite: RelevePrix['disponibilite'];
  dispo_taille: RelevePrix['dispoTaille'];
  source: RelevePrix['source'];
};

export async function enregistrerReleve(db: BaseArticles, r: RelevePrix): Promise<void> {
  await db.runAsync(
    `INSERT INTO releve_prix (id, article_id, date, prix, devise, disponibilite, dispo_taille, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.id, r.articleId, r.date, r.prix, r.devise, r.disponibilite, r.dispoTaille, r.source],
  );
}

/** Historique des prix d'une pièce, du plus récent au plus ancien. */
export async function lireReleves(db: BaseArticles, articleId: string): Promise<RelevePrix[]> {
  const lignes = await db.getAllAsync<LigneReleve>(
    'SELECT * FROM releve_prix WHERE article_id = ? ORDER BY date DESC',
    [articleId],
  );
  return lignes.map((l) => ({
    id: l.id,
    articleId: l.article_id,
    date: l.date,
    prix: l.prix,
    devise: l.devise,
    disponibilite: l.disponibilite,
    dispoTaille: l.dispo_taille,
    source: l.source,
  }));
}
