import type { Article, Priorite, TypeArticle } from './article';
import { enCentimes } from './prix';

export type Filtre = {
  type: TypeArticle | null;
  priorite: Priorite | null;
  categorie: string | null;
  recherche: string;
};

export const FILTRE_VIDE: Filtre = { type: null, priorite: null, categorie: null, recherche: '' };

export type Tri = 'date' | 'prix' | 'priorite';
export const TRIS: readonly Tri[] = ['date', 'prix', 'priorite'];

/** Seuls les articles souhaités sont dans la Wishlist. */
export const articlesDeLaWishlist = (articles: readonly Article[]) =>
  articles.filter((a) => a.statut === 'souhaite');

/** Total des prix connus, et nombre de pièces sans prix (exclues du total). */
export function totalWishlist(articles: readonly Article[]) {
  let centimes = 0;
  let sansPrix = 0;
  for (const a of articles) {
    if (a.prix === null) sansPrix += 1;
    else centimes += enCentimes(a.prix);
  }
  return { euros: centimes / 100, sansPrix, pieces: articles.length };
}

/** Met en minuscules et retire les accents, pour comparer « Écharpe » et « echarpe ». */
export const normaliser = (texte: string) =>
  texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function correspondALaRecherche(a: Article, recherche: string) {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  const contenu = normaliser([a.nom, a.marque, a.categorie, a.couleur, a.notes].filter(Boolean).join(' '));
  return mots.every((mot) => contenu.includes(mot));
}

/** Applique tous les filtres en même temps (ils se combinent). */
export function filtrer(articles: readonly Article[], filtre: Filtre): Article[] {
  return articles.filter(
    (a) =>
      (filtre.type === null || a.type === filtre.type) &&
      (filtre.priorite === null || a.priorite === filtre.priorite) &&
      (filtre.categorie === null ||
        (a.categorie !== null && normaliser(a.categorie) === normaliser(filtre.categorie))) &&
      correspondALaRecherche(a, filtre.recherche),
  );
}

const RANG_PRIORITE: Record<Priorite, number> = { forte: 0, moyenne: 1, un_jour: 2 };
const plusRecentDabord = (a: Article, b: Article) => b.dateAjout.localeCompare(a.dateAjout);

/**
 * Trie sans modifier la liste d'origine.
 * date : plus récent d'abord ; prix : moins cher d'abord, sans prix à la fin ;
 * priorité : envie forte d'abord, puis plus récent.
 */
export function trier(articles: readonly Article[], tri: Tri): Article[] {
  const copie = [...articles];
  if (tri === 'date') return copie.sort(plusRecentDabord);
  if (tri === 'priorite') {
    return copie.sort((a, b) => RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite] || plusRecentDabord(a, b));
  }
  return copie.sort((a, b) => {
    if (a.prix === null && b.prix === null) return plusRecentDabord(a, b);
    if (a.prix === null) return 1;
    if (b.prix === null) return -1;
    return a.prix - b.prix || plusRecentDabord(a, b);
  });
}

/** Catégories présentes dans la liste, sans doublon (« veste » et « Veste » comptent une fois), triées. */
export function categoriesPresentes(articles: readonly Article[]): string[] {
  const vues = new Map<string, string>();
  for (const a of articles) {
    if (a.categorie && !vues.has(normaliser(a.categorie))) vues.set(normaliser(a.categorie), a.categorie);
  }
  return [...vues.values()].sort((a, b) => normaliser(a).localeCompare(normaliser(b)));
}

/** Couleur d'aplat (photo1 à photo3) quand l'article n'a pas de photo : toujours la même pour un article. */
export function indiceAplat(id: string): 0 | 1 | 2 {
  let somme = 0;
  for (const car of id) somme = (somme + car.charCodeAt(0)) % 3;
  return somme as 0 | 1 | 2;
}

export type Vue = 'grille' | 'categories';
export const VUES: readonly Vue[] = ['grille', 'categories'];

export type Section = {
  /** Nom de la catégorie tel que saisi ; null pour les pièces sans catégorie. */
  categorie: string | null;
  articles: Article[];
  total: ReturnType<typeof totalWishlist>;
};

/**
 * Vue par catégorie : une section par catégorie (« veste » et « Veste » ensemble),
 * dans l'ordre alphabétique, puis les pièces sans catégorie à la fin.
 * L'ordre des pièces dans chaque section reste celui de la liste reçue (donc le tri choisi).
 */
export function regrouperParCategorie(articles: readonly Article[]): Section[] {
  const groupes = new Map<string, Article[]>();
  const sansCategorie: Article[] = [];
  for (const a of articles) {
    const cle = a.categorie ? normaliser(a.categorie) : '';
    if (!cle) {
      sansCategorie.push(a);
      continue;
    }
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(a);
    else groupes.set(cle, [a]);
  }
  const sections: Section[] = categoriesPresentes(articles).map((categorie) => {
    const contenu = groupes.get(normaliser(categorie)) ?? [];
    return { categorie, articles: contenu, total: totalWishlist(contenu) };
  }).filter((s) => s.articles.length > 0);
  if (sansCategorie.length > 0) {
    sections.push({ categorie: null, articles: sansCategorie, total: totalWishlist(sansCategorie) });
  }
  return sections;
}

/** Range les pièces par deux, pour afficher les sections sur 2 colonnes. */
export function parPaires<T>(liste: readonly T[]): T[][] {
  const paires: T[][] = [];
  for (let i = 0; i < liste.length; i += 2) paires.push(liste.slice(i, i + 2));
  return paires;
}
