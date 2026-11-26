/**
 * Prix et disponibilité actualisés (docs/SPEC.md, lot 3, étape 3) : quand relire la page boutique,
 * ce que la relecture change, baisse ou hausse depuis l'ajout, étiquette de la carte. Logique pure.
 */
import type { HistoriquePartage } from './lien';
import type { Article, Disponibilite } from './article';
import { enCentimes } from './prix';
import type { RelevePrix } from './releve';

/** Ce que le relais a lu sur la page boutique. */
export type Lecture = {
  prix: number | null;
  devise: string | null;
  disponibilite: Disponibilite;
  dispoTaille: Disponibilite;
  /** Historique partagé du relais ; absent ou null : le dernier connu est gardé. */
  historique?: HistoriquePartage | null;
};

/**
 * Vrai s'il faut relire la page : pièce de la Wishlist, avec un lien boutique https,
 * jamais vérifiée ou vérifiée il y a plus de `delaiH` heures.
 */
export function aRelire(a: Article, maintenant: Date, delaiH: number): boolean {
  if (a.statut !== 'souhaite' || !a.urlBoutique || !/^https:\/\//i.test(a.urlBoutique)) return false;
  if (!a.dateVerif) return true;
  const derniere = new Date(a.dateVerif).getTime();
  return Number.isNaN(derniere) || maintenant.getTime() - derniere > delaiH * 3600 * 1000;
}

/**
 * Applique une relecture réussie :
 * - le prix n'est remplacé que par un prix lu en euros (un prix absent ou dans une autre devise ne change rien) ;
 * - la disponibilité devient celle lue (la disponibilité de taille seulement si la pièce a une taille) ;
 * - la date de vérification est toujours mise à jour.
 * Un relevé (source « relais ») n'est créé que si le prix ou la disponibilité a changé.
 */
export function appliquerLecture(
  a: Article,
  l: Lecture,
  maintenant: Date,
  idReleve: string,
): { article: Article; releve: RelevePrix | null } {
  const date = maintenant.toISOString();
  const prixLu = l.prix !== null && (l.devise === null || l.devise === 'EUR') ? l.prix : null;
  const article: Article = {
    ...a,
    prix: prixLu ?? a.prix,
    disponibilite: l.disponibilite,
    dispoTaille: a.taille ? l.dispoTaille : 'inconnue',
    dateVerif: date,
    prixMinObserve: l.historique?.prixMin ?? a.prixMinObserve,
    datePrixMinObserve: l.historique?.date ?? a.datePrixMinObserve,
  };
  const change =
    article.prix !== a.prix || article.disponibilite !== a.disponibilite || article.dispoTaille !== a.dispoTaille;
  const releve: RelevePrix | null = change
    ? {
        id: idReleve,
        articleId: a.id,
        date,
        prix: article.prix,
        devise: article.prix === null ? null : 'EUR',
        disponibilite: article.disponibilite,
        dispoTaille: article.dispoTaille,
        source: 'relais',
      }
    : null;
  return { article, releve };
}

const MOIS_LONGS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/**
 * « Prix le plus bas observé : 79 € (octobre 2026) » : prix et mois (à l'heure du téléphone), pour une pièce
 * de la Wishlist dont le relais a donné l'historique partagé ; null sinon (rien n'est affiché).
 */
export function prixMinObserve(a: Pick<Article, 'statut' | 'prixMinObserve' | 'datePrixMinObserve'>): { euros: number; mois: string } | null {
  if (a.statut !== 'souhaite' || a.prixMinObserve === null || !a.datePrixMinObserve) return null;
  const date = new Date(a.datePrixMinObserve);
  if (Number.isNaN(date.getTime())) return null;
  return { euros: a.prixMinObserve, mois: `${MOIS_LONGS[date.getMonth()]} ${date.getFullYear()}` };
}

export type VariationPrix = { sens: 'baisse' | 'hausse'; euros: number };

/** Baisse ou hausse du prix actuel depuis l'ajout ; null s'il manque un prix ou s'il n'a pas bougé. */
export function variationPrix(a: Pick<Article, 'prix' | 'prixAjout'>): VariationPrix | null {
  if (a.prix === null || a.prixAjout === null) return null;
  const ecart = enCentimes(a.prix) - enCentimes(a.prixAjout);
  if (ecart === 0) return null;
  return { sens: ecart < 0 ? 'baisse' : 'hausse', euros: Math.abs(ecart) / 100 };
}

/**
 * Disponibilité à afficher sur la fiche : « En stock en M », « Épuisé en M », « Épuisé », ou rien.
 * La taille passe d'abord ; sans information sur la taille, seul « Épuisé » (global) est affiché.
 */
export function disponibiliteAffichee(
  a: Pick<Article, 'taille' | 'disponibilite' | 'dispoTaille'>,
): { etat: 'en_stock' | 'epuise'; taille: string | null } | null {
  if (a.taille && a.dispoTaille !== 'inconnue') return { etat: a.dispoTaille, taille: a.taille };
  if (a.disponibilite === 'epuise') return { etat: 'epuise', taille: null };
  return null;
}

/** Étiquette de la carte dans la Wishlist : « ÉPUISÉ » passe avant « BAISSE » ; rien pour le Vestiaire. */
export function etiquetteAlerte(a: Article): 'epuise' | 'baisse' | null {
  if (a.statut !== 'souhaite') return null;
  if (a.disponibilite === 'epuise' || a.dispoTaille === 'epuise') return 'epuise';
  return variationPrix(a)?.sens === 'baisse' ? 'baisse' : null;
}

/**
 * Bandeau « Épuisé en M. Voir des alternatives » en tête de fiche (docs/SPEC.md, lot 3, étape 4) :
 * pièce de la Wishlist épuisée, d'après ce que la fiche affiche (la taille passe d'abord).
 * Rien pour le Vestiaire, ni quand la disponibilité est inconnue ou en stock.
 * Renvoie la taille à citer (null : « Épuisé » sans taille), ou null s'il n'y a pas de bandeau.
 */
export function bandeauEpuise(
  a: Pick<Article, 'statut' | 'taille' | 'disponibilite' | 'dispoTaille'>,
): { taille: string | null } | null {
  if (a.statut !== 'souhaite') return null;
  const dispo = disponibiliteAffichee(a);
  return dispo?.etat === 'epuise' ? { taille: dispo.taille } : null;
}
