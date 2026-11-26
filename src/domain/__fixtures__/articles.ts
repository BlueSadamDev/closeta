import type { Article } from '../article';

/** Articles fictifs pour les tests (aucune vraie donnée). */
export function articleFictif(champs: Partial<Article> & Pick<Article, 'id'>): Article {
  return {
    nom: 'Article fictif',
    marque: null,
    type: 'vetement',
    categorie: null,
    taille: null,
    couleur: null,
    prix: null,
    devise: 'EUR',
    urlBoutique: null,
    imageLocale: null,
    imageSource: null,
    priorite: 'moyenne',
    notes: null,
    statut: 'souhaite',
    origine: 'manuel',
    estAlternative: false,
    dateAjout: '2026-01-01T10:00:00.000Z',
    dateAchat: null,
    dateMaj: '2026-01-01T10:00:00.000Z',
    prixAjout: null,
    disponibilite: 'inconnue',
    dispoTaille: 'inconnue',
    dateVerif: null,
    alternativeDe: null,
    prixMinObserve: null,
    datePrixMinObserve: null,
    ...champs,
  };
}

export const WISHLIST_FICTIVE: Article[] = [
  articleFictif({ id: 'a', nom: 'Veste en laine', marque: 'Maison Fictive', categorie: 'Veste', prix: 420, priorite: 'forte', couleur: 'Écru', dateAjout: '2026-03-01T10:00:00.000Z' }),
  articleFictif({ id: 'b', nom: 'Pull col roulé', marque: 'Atelier Test', categorie: 'Pull', prix: 129.9, dateAjout: '2026-03-05T10:00:00.000Z' }),
  articleFictif({ id: 'c', nom: 'Mocassins cuir', type: 'chaussures', categorie: 'Mocassins', prix: 935.1, priorite: 'un_jour', dateAjout: '2026-02-01T10:00:00.000Z' }),
  articleFictif({ id: 'd', nom: 'Manteau long', categorie: 'manteau', prix: null, priorite: 'forte', dateAjout: '2026-03-10T10:00:00.000Z' }),
  articleFictif({ id: 'e', nom: 'Baskets blanches', type: 'chaussures', categorie: 'Baskets', prix: null, dateAjout: '2026-01-15T10:00:00.000Z' }),
  articleFictif({ id: 'f', nom: 'Chemise achetée', categorie: 'Chemise', prix: 90, statut: 'achete', dateAjout: '2026-01-02T10:00:00.000Z' }),
];
