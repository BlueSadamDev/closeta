import { marquerAchete } from '../article';
import { articleFictif, WISHLIST_FICTIVE } from '../__fixtures__/articles';
import { FILTRE_VIDE, filtrer, regrouperParCategorie, totalWishlist } from '../wishlist';
import { articlesDuVestiaire, dateAchatLongue, moisAchat, trierParAchat, trierVestiaire } from '../vestiaire';

const ids = (articles: { id: string }[]) => articles.map((a) => a.id);

describe('Vestiaire', () => {
  it('ne contient que les articles achetés', () => {
    expect(ids(articlesDuVestiaire(WISHLIST_FICTIVE))).toEqual(['f']);
  });

  it('accueille une pièce dès « Je l’ai acheté »', () => {
    const achetee = marquerAchete(WISHLIST_FICTIVE[0], new Date('2026-04-01T12:00:00.000Z'));
    expect(ids(articlesDuVestiaire([...WISHLIST_FICTIVE, achetee]))).toEqual(['f', 'a']);
  });

  it('ignore les pièces abandonnées', () => {
    expect(articlesDuVestiaire([articleFictif({ id: 'z', statut: 'abandonne' })])).toEqual([]);
  });

  it('a un total qui exclut et signale les pièces sans prix', () => {
    const vestiaire = [
      articleFictif({ id: 'x', statut: 'achete', prix: 90 }),
      articleFictif({ id: 'y', statut: 'achete', prix: null }),
      articleFictif({ id: 'w', statut: 'achete', prix: 129.9 }),
    ];
    expect(totalWishlist(vestiaire)).toEqual({ euros: 219.9, sansPrix: 1, pieces: 3 });
  });

  it('range les pièces par date d’achat, la plus récente d’abord, sans date à la fin', () => {
    const vestiaire = [
      articleFictif({ id: 'ancien', statut: 'achete', dateAchat: '2026-02-10T12:00:00.000Z' }),
      articleFictif({ id: 'sans', statut: 'achete', dateAchat: null }),
      articleFictif({ id: 'recent', statut: 'achete', dateAchat: '2026-05-10T12:00:00.000Z' }),
    ];
    expect(ids(trierParAchat(vestiaire))).toEqual(['recent', 'ancien', 'sans']);
    expect(ids(vestiaire)).toEqual(['ancien', 'sans', 'recent']);
  });
});

const VESTIAIRE_FICTIF = [
  articleFictif({ id: 'v1', statut: 'achete', nom: 'Veste en lin', categorie: 'Veste', prix: 300, couleur: 'Écru', dateAchat: '2026-03-10T12:00:00.000Z' }),
  articleFictif({ id: 'v2', statut: 'achete', nom: 'Derbies', type: 'chaussures', categorie: 'Derbies', prix: 250, dateAchat: '2026-06-10T12:00:00.000Z' }),
  articleFictif({ id: 'v3', statut: 'achete', nom: 'Veste en laine', categorie: 'veste', prix: null, dateAchat: '2026-05-10T12:00:00.000Z' }),
  articleFictif({ id: 'v4', statut: 'achete', nom: 'Pull marine', categorie: null, prix: 90, dateAchat: '2026-01-10T12:00:00.000Z' }),
];

describe('filtres et tri du Vestiaire', () => {
  it('trie par achat récent ou par prix, sans prix à la fin', () => {
    expect(ids(trierVestiaire(VESTIAIRE_FICTIF, 'achat'))).toEqual(['v2', 'v3', 'v1', 'v4']);
    expect(ids(trierVestiaire(VESTIAIRE_FICTIF, 'prix'))).toEqual(['v4', 'v2', 'v1', 'v3']);
  });

  it('combine type, catégorie et recherche', () => {
    expect(ids(filtrer(VESTIAIRE_FICTIF, { ...FILTRE_VIDE, type: 'chaussures' }))).toEqual(['v2']);
    expect(ids(filtrer(VESTIAIRE_FICTIF, { ...FILTRE_VIDE, categorie: 'Veste' }))).toEqual(['v1', 'v3']);
    expect(ids(filtrer(VESTIAIRE_FICTIF, { ...FILTRE_VIDE, categorie: 'Veste', recherche: 'ecru' }))).toEqual(['v1']);
    expect(filtrer(VESTIAIRE_FICTIF, { ...FILTRE_VIDE, type: 'chaussures', categorie: 'Veste' })).toEqual([]);
  });

  it('regroupe par catégorie avec sous-totaux, dans l’ordre du tri choisi', () => {
    const sections = regrouperParCategorie(trierVestiaire(VESTIAIRE_FICTIF, 'achat'));
    expect(sections.map((s) => [s.categorie, ids(s.articles), s.total.euros, s.total.sansPrix])).toEqual([
      ['Derbies', ['v2'], 250, 0],
      ['veste', ['v3', 'v1'], 300, 1],
      [null, ['v4'], 90, 0],
    ]);
  });
});

describe('dates d’achat', () => {
  it('écrit le mois d’achat en abrégé', () => {
    expect(moisAchat('2026-11-15T12:00:00.000Z')).toBe('nov. 2026');
    expect(moisAchat('2026-05-15T12:00:00.000Z')).toBe('mai 2026');
  });

  it('écrit la date d’achat en entier, avec « 1er » le premier du mois', () => {
    expect(dateAchatLongue('2026-11-22T12:00:00.000Z')).toBe('22 novembre 2026');
    expect(dateAchatLongue('2026-08-01T12:00:00.000Z')).toBe('1er août 2026');
  });

  it('ne fabrique pas de date quand elle manque ou est illisible', () => {
    expect(moisAchat(null)).toBeNull();
    expect(dateAchatLongue('pas une date')).toBeNull();
  });
});
