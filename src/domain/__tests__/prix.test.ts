import { formaterPrix, lirePrix, prixPourSaisie } from '../prix';

describe('formaterPrix', () => {
  it('sépare les milliers et colle « € » avec une espace insécable', () => {
    expect(formaterPrix(1485)).toBe('1 485 €');
  });
  it('affiche les centimes seulement quand il y en a', () => {
    expect(formaterPrix(129.9)).toBe('129,90 €');
    expect(formaterPrix(89)).toBe('89 €');
  });
  it('arrondit au centime', () => {
    expect(formaterPrix(0.1 + 0.2)).toBe('0,30 €');
  });
});

describe('lirePrix', () => {
  it.each([
    ['129,90', 129.9],
    ['1 485 €', 1485],
    ['89.5', 89.5],
    ['  42 ', 42],
  ])('lit « %s »', (saisie, attendu) => {
    expect(lirePrix(saisie)).toBe(attendu);
  });
  it('renvoie null pour un champ vide', () => {
    expect(lirePrix('  ')).toBeNull();
  });
  it.each(['abc', '12,345', '-5', '1,2,3'])('refuse « %s »', (saisie) => {
    expect(lirePrix(saisie)).toBe('invalide');
  });
});

describe('prixPourSaisie', () => {
  it('remet le prix au format de saisie', () => {
    expect(prixPourSaisie(129.9)).toBe('129,90');
    expect(prixPourSaisie(420)).toBe('420');
    expect(prixPourSaisie(null)).toBe('');
  });
});
