import { marquerAchete } from '../article';
import { articleFictif, WISHLIST_FICTIVE } from '../__fixtures__/articles';
import { totalWishlist } from '../wishlist';
import { articlesDuVestiaire, dateAchatLongue, moisAchat, trierParAchat } from '../vestiaire';

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
