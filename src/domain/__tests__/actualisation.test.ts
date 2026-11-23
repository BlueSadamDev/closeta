import { articleFictif } from '../__fixtures__/articles';
import { appliquerLecture, aRelire, disponibiliteAffichee, etiquetteAlerte, variationPrix, type Lecture } from '../actualisation';

const MAINTENANT = new Date('2026-11-23T12:00:00.000Z');

/** Pièce fictive de la Wishlist, ajoutée à 420 €, vérifiée il y a deux jours. */
const PIECE = articleFictif({
  id: 'p',
  nom: 'Veste en laine',
  taille: 'M',
  prix: 420,
  prixAjout: 420,
  urlBoutique: 'https://boutique.exemple.test/veste',
  dateVerif: '2026-11-21T12:00:00.000Z',
});

const LECTURE: Lecture = { prix: 395, devise: 'EUR', disponibilite: 'en_stock', dispoTaille: 'epuise' };

describe('aRelire', () => {
  it('relit une pièce de la Wishlist vérifiée il y a plus de 24 h, ou jamais vérifiée', () => {
    expect(aRelire(PIECE, MAINTENANT, 24)).toBe(true);
    expect(aRelire({ ...PIECE, dateVerif: null }, MAINTENANT, 24)).toBe(true);
  });

  it('ne relit pas une pièce vérifiée récemment, sans lien https, ou du Vestiaire', () => {
    expect(aRelire({ ...PIECE, dateVerif: '2026-11-23T01:00:00.000Z' }, MAINTENANT, 24)).toBe(false);
    expect(aRelire({ ...PIECE, urlBoutique: null }, MAINTENANT, 24)).toBe(false);
    expect(aRelire({ ...PIECE, urlBoutique: 'http://boutique.exemple.test/veste' }, MAINTENANT, 24)).toBe(false);
    expect(aRelire({ ...PIECE, statut: 'achete' }, MAINTENANT, 24)).toBe(false);
  });
});

describe('appliquerLecture', () => {
  it('met à jour prix, disponibilité et date de vérification, avec un relevé « relais »', () => {
    const { article, releve } = appliquerLecture(PIECE, LECTURE, MAINTENANT, 'r1');
    expect(article).toMatchObject({ prix: 395, prixAjout: 420, disponibilite: 'en_stock', dispoTaille: 'epuise', dateVerif: MAINTENANT.toISOString() });
    expect(releve).toEqual({
      id: 'r1',
      articleId: 'p',
      date: MAINTENANT.toISOString(),
      prix: 395,
      devise: 'EUR',
      disponibilite: 'en_stock',
      dispoTaille: 'epuise',
      source: 'relais',
    });
  });

  it('rien n’a changé : date de vérification à jour, aucun relevé', () => {
    const avant = { ...PIECE, prix: 395, disponibilite: 'en_stock' as const, dispoTaille: 'epuise' as const };
    const { article, releve } = appliquerLecture(avant, LECTURE, MAINTENANT, 'r1');
    expect(article.dateVerif).toBe(MAINTENANT.toISOString());
    expect(releve).toBeNull();
  });

  it('garde le prix connu quand la page n’en donne pas, ou pas en euros', () => {
    expect(appliquerLecture(PIECE, { ...LECTURE, prix: null }, MAINTENANT, 'r').article.prix).toBe(420);
    expect(appliquerLecture(PIECE, { ...LECTURE, devise: 'USD' }, MAINTENANT, 'r').article.prix).toBe(420);
  });

  it('sans taille sur la pièce, la disponibilité de taille reste inconnue', () => {
    expect(appliquerLecture({ ...PIECE, taille: null }, LECTURE, MAINTENANT, 'r').article.dispoTaille).toBe('inconnue');
  });
});

describe('variationPrix', () => {
  it('baisse ou hausse depuis l’ajout, au centime près', () => {
    expect(variationPrix({ prix: 395, prixAjout: 420 })).toEqual({ sens: 'baisse', euros: 25 });
    expect(variationPrix({ prix: 141.9, prixAjout: 129.9 })).toEqual({ sens: 'hausse', euros: 12 });
  });
  it('rien quand le prix n’a pas bougé ou qu’un prix manque', () => {
    expect(variationPrix({ prix: 420, prixAjout: 420 })).toBeNull();
    expect(variationPrix({ prix: 420, prixAjout: null })).toBeNull();
    expect(variationPrix({ prix: null, prixAjout: 420 })).toBeNull();
  });
});

describe('disponibiliteAffichee', () => {
  it('la taille d’abord, sinon « Épuisé » seul, sinon rien', () => {
    expect(disponibiliteAffichee({ taille: 'M', disponibilite: 'en_stock', dispoTaille: 'epuise' })).toEqual({ etat: 'epuise', taille: 'M' });
    expect(disponibiliteAffichee({ taille: 'M', disponibilite: 'en_stock', dispoTaille: 'en_stock' })).toEqual({ etat: 'en_stock', taille: 'M' });
    expect(disponibiliteAffichee({ taille: 'M', disponibilite: 'epuise', dispoTaille: 'inconnue' })).toEqual({ etat: 'epuise', taille: null });
    expect(disponibiliteAffichee({ taille: null, disponibilite: 'en_stock', dispoTaille: 'inconnue' })).toBeNull();
    expect(disponibiliteAffichee({ taille: 'M', disponibilite: 'inconnue', dispoTaille: 'inconnue' })).toBeNull();
  });
});

describe('etiquetteAlerte', () => {
  it('« ÉPUISÉ » passe avant « BAISSE »', () => {
    expect(etiquetteAlerte({ ...PIECE, prix: 395, dispoTaille: 'epuise' })).toBe('epuise');
    expect(etiquetteAlerte({ ...PIECE, prix: 395 })).toBe('baisse');
    expect(etiquetteAlerte({ ...PIECE, disponibilite: 'epuise' })).toBe('epuise');
  });
  it('rien pour une hausse, un prix stable, ou une pièce du Vestiaire', () => {
    expect(etiquetteAlerte({ ...PIECE, prix: 450 })).toBeNull();
    expect(etiquetteAlerte(PIECE)).toBeNull();
    expect(etiquetteAlerte({ ...PIECE, prix: 395, statut: 'achete' })).toBeNull();
  });
});
