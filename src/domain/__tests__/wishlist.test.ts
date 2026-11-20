import { marquerAchete } from '../article';
import { articleFictif, WISHLIST_FICTIVE } from '../__fixtures__/articles';
import {
  articlesDeLaWishlist,
  categoriesPresentes,
  FILTRE_VIDE,
  filtrer,
  indiceAplat,
  parPaires,
  regrouperParCategorie,
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

describe('vue par catégorie', () => {
  const resume = (articles: Parameters<typeof regrouperParCategorie>[0]) =>
    regrouperParCategorie(articles).map((s) => [s.categorie, ids(s.articles)]);

  it('fait une section par catégorie, dans l’ordre alphabétique', () => {
    expect(resume(wishlist)).toEqual([
      ['Baskets', ['e']],
      ['manteau', ['d']],
      ['Mocassins', ['c']],
      ['Pull', ['b']],
      ['Veste', ['a']],
    ]);
  });

  it('regroupe les pièces sans catégorie à la fin', () => {
    const liste = [
      articleFictif({ id: 'x', categorie: null }),
      articleFictif({ id: 'y', categorie: 'Veste' }),
      articleFictif({ id: 'z', categorie: '' }),
    ];
    expect(resume(liste)).toEqual([
      ['Veste', ['y']],
      [null, ['x', 'z']],
    ]);
  });

  it('met « veste » et « Veste » dans la même section, en gardant l’ordre du tri', () => {
    const liste = [
      articleFictif({ id: 'x', categorie: 'veste' }),
      articleFictif({ id: 'y', categorie: 'Pull' }),
      articleFictif({ id: 'z', categorie: 'Veste' }),
    ];
    expect(resume(liste)).toEqual([
      ['Pull', ['y']],
      ['veste', ['x', 'z']],
    ]);
  });

  it('calcule un sous-total par section, sans les pièces sans prix', () => {
    const liste = [
      articleFictif({ id: 'x', categorie: 'Veste', prix: 420 }),
      articleFictif({ id: 'y', categorie: 'Veste', prix: null }),
      articleFictif({ id: 'z', categorie: 'Veste', prix: 129.9 }),
    ];
    expect(regrouperParCategorie(liste)[0].total).toEqual({ euros: 549.9, sansPrix: 1, pieces: 3 });
  });

  it('ne crée aucune section pour une liste vide', () => {
    expect(regrouperParCategorie([])).toEqual([]);
  });

  it('range les pièces par deux, la dernière seule si le nombre est impair', () => {
    expect(parPaires(['a', 'b', 'c'])).toEqual([['a', 'b'], ['c']]);
    expect(parPaires([])).toEqual([]);
  });
});
