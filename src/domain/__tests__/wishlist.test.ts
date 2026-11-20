import { marquerAchete } from '../article';
import { articleFictif, WISHLIST_FICTIVE } from '../__fixtures__/articles';
import {
  articlesDeLaWishlist,
  categoriesPresentes,
  FILTRE_VIDE,
  filtrer,
  indiceAplat,
  totalWishlist,
  trier,
} from '../wishlist';

const wishlist = articlesDeLaWishlist(WISHLIST_FICTIVE);
const ids = (articles: { id: string }[]) => articles.map((a) => a.id);

describe('Wishlist', () => {
  it('ne contient que les articles souhaités', () => {
    expect(ids(wishlist)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('additionne les prix connus et compte les pièces sans prix', () => {
    expect(totalWishlist(wishlist)).toEqual({ euros: 1485, sansPrix: 2, pieces: 5 });
  });

  it('a un total nul quand elle est vide', () => {
    expect(totalWishlist([])).toEqual({ euros: 0, sansPrix: 0, pieces: 0 });
  });
});

describe('filtres', () => {
  it('filtrent par type', () => {
    expect(ids(filtrer(wishlist, { ...FILTRE_VIDE, type: 'chaussures' }))).toEqual(['c', 'e']);
  });

  it('filtrent par priorité', () => {
    expect(ids(filtrer(wishlist, { ...FILTRE_VIDE, priorite: 'forte' }))).toEqual(['a', 'd']);
  });

  it('filtrent par catégorie sans tenir compte des majuscules', () => {
    expect(ids(filtrer(wishlist, { ...FILTRE_VIDE, categorie: 'Manteau' }))).toEqual(['d']);
  });

  it('se combinent', () => {
    expect(ids(filtrer(wishlist, { ...FILTRE_VIDE, type: 'vetement', priorite: 'forte', categorie: 'veste' }))).toEqual(['a']);
    expect(filtrer(wishlist, { ...FILTRE_VIDE, type: 'chaussures', priorite: 'forte' })).toEqual([]);
  });

  it('cherchent dans le nom, la marque, la catégorie et la couleur, sans accents', () => {
    expect(ids(filtrer(wishlist, { ...FILTRE_VIDE, recherche: 'ecru' }))).toEqual(['a']);
    expect(ids(filtrer(wishlist, { ...FILTRE_VIDE, recherche: 'atelier' }))).toEqual(['b']);
    expect(ids(filtrer(wishlist, { ...FILTRE_VIDE, recherche: 'cuir mocassins' }))).toEqual(['c']);
  });
});

describe('tri', () => {
  it('par date : plus récent d’abord', () => {
    expect(ids(trier(wishlist, 'date'))).toEqual(['d', 'b', 'a', 'c', 'e']);
  });

  it('par prix : moins cher d’abord, sans prix à la fin', () => {
    expect(ids(trier(wishlist, 'prix'))).toEqual(['b', 'a', 'c', 'd', 'e']);
  });

  it('par priorité : envie forte d’abord, puis plus récent', () => {
    expect(ids(trier(wishlist, 'priorite'))).toEqual(['d', 'a', 'b', 'e', 'c']);
  });

  it('ne modifie pas la liste d’origine', () => {
    const copie = [...wishlist];
    trier(wishlist, 'prix');
    expect(wishlist).toEqual(copie);
  });
});

describe('catégories présentes', () => {
  it('sont listées une seule fois, dans l’ordre alphabétique', () => {
    const liste = [...wishlist, articleFictif({ id: 'g', categorie: 'veste' })];
    expect(categoriesPresentes(liste)).toEqual(['Baskets', 'manteau', 'Mocassins', 'Pull', 'Veste']);
  });
});

describe('« Je l’ai acheté »', () => {
  it('passe l’article en acheté avec la date d’achat, sans rien effacer', () => {
    const maintenant = new Date('2026-04-01T12:00:00.000Z');
    const achete = marquerAchete(wishlist[0], maintenant);
    expect(achete).toEqual({
      ...wishlist[0],
      statut: 'achete',
      dateAchat: '2026-04-01T12:00:00.000Z',
      dateMaj: '2026-04-01T12:00:00.000Z',
    });
    expect(articlesDeLaWishlist([achete])).toEqual([]);
  });
});

describe('aplat sans photo', () => {
  it('donne toujours la même couleur au même article', () => {
    expect(indiceAplat('abc')).toBe(indiceAplat('abc'));
    expect([0, 1, 2]).toContain(indiceAplat('xyz'));
  });
});
