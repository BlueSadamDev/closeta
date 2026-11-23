import { articleFictif } from '../__fixtures__/articles';
import { releveAEnregistrer } from '../releve';

const AJOUT = '2026-03-01T10:00:00.000Z';
const MODIF = '2026-04-01T10:00:00.000Z';

describe('relevés de prix', () => {
  it('ajout par lien avec un prix : relevé « ajout » à la date d’ajout', () => {
    const a = articleFictif({ id: 'x', origine: 'lien', prix: 420, dateAjout: AJOUT, dateMaj: AJOUT });
    expect(releveAEnregistrer(null, a, 'r1')).toEqual({
      id: 'r1',
      articleId: 'x',
      date: AJOUT,
      prix: 420,
      devise: 'EUR',
      disponibilite: 'inconnue',
      dispoTaille: 'inconnue',
      source: 'ajout',
    });
  });

  it('ajout par photo avec un prix : relevé « ajout »', () => {
    const a = articleFictif({ id: 'x', origine: 'photo', prix: 99 });
    expect(releveAEnregistrer(null, a, 'r1')?.source).toBe('ajout');
  });

  it('pas de relevé pour un ajout sans prix, ni pour un ajout à la main', () => {
    expect(releveAEnregistrer(null, articleFictif({ id: 'x', origine: 'lien', prix: null }), 'r1')).toBeNull();
    expect(releveAEnregistrer(null, articleFictif({ id: 'x', origine: 'manuel', prix: 50 }), 'r1')).toBeNull();
  });

  it('prix modifié à la main dans la Wishlist : relevé « manuel » à la date de modification', () => {
    const avant = articleFictif({ id: 'x', prix: 420 });
    const apres = { ...avant, prix: 380, dateMaj: MODIF };
    expect(releveAEnregistrer(avant, apres, 'r2')).toMatchObject({ prix: 380, date: MODIF, source: 'manuel' });
  });

  it('prix ajouté à une pièce qui n’en avait pas : relevé « manuel »', () => {
    const avant = articleFictif({ id: 'x', prix: null });
    expect(releveAEnregistrer(avant, { ...avant, prix: 60 }, 'r2')?.source).toBe('manuel');
  });

  it('pas de relevé si le prix ne change pas, s’il est effacé, ou pour une pièce du Vestiaire', () => {
    const avant = articleFictif({ id: 'x', prix: 420 });
    expect(releveAEnregistrer(avant, { ...avant, nom: 'Autre nom' }, 'r2')).toBeNull();
    expect(releveAEnregistrer(avant, { ...avant, prix: null }, 'r2')).toBeNull();
    const achetee = articleFictif({ id: 'y', prix: 90, statut: 'achete' });
    expect(releveAEnregistrer(achetee, { ...achetee, prix: 80 }, 'r2')).toBeNull();
  });
});
