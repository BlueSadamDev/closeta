import { BROUILLON_VIDE, validerBrouillon } from '../validation';

describe('validation du formulaire', () => {
  it('exige un nom et un type', () => {
    expect(validerBrouillon(BROUILLON_VIDE)).toEqual({
      ok: false,
      erreurs: { nom: 'nomManquant', type: 'typeManquant' },
    });
  });

  it('accepte un article avec seulement nom et type, les autres champs vides deviennent manquants', () => {
    const r = validerBrouillon({ ...BROUILLON_VIDE, nom: '  Veste  ', type: 'vetement', marque: ' ' });
    expect(r).toEqual({
      ok: true,
      champs: {
        nom: 'Veste',
        marque: null,
        type: 'vetement',
        categorie: null,
        taille: null,
        couleur: null,
        prix: null,
        urlBoutique: null,
        priorite: 'moyenne',
        notes: null,
        dateAchat: null,
      },
    });
  });

  it('lit le prix saisi', () => {
    const r = validerBrouillon({ ...BROUILLON_VIDE, nom: 'Pull', type: 'vetement', prix: '129,90' });
    expect(r.ok && r.champs.prix).toBe(129.9);
  });

  it('signale un prix ou un lien mal formé', () => {
    const r = validerBrouillon({ ...BROUILLON_VIDE, nom: 'Pull', type: 'vetement', prix: 'cher', urlBoutique: 'boutique' });
    expect(r).toEqual({ ok: false, erreurs: { prix: 'prixInvalide', urlBoutique: 'lienInvalide' } });
  });

  it('accepte un lien complet', () => {
    const r = validerBrouillon({ ...BROUILLON_VIDE, nom: 'Pull', type: 'vetement', urlBoutique: 'https://boutique.example/pull' });
    expect(r.ok && r.champs.urlBoutique).toBe('https://boutique.example/pull');
  });

  it('lit la date d’achat facultative du Vestiaire, refuse une date mal écrite ou à venir', () => {
    const maintenant = new Date(2026, 10, 23, 9);
    const base = { ...BROUILLON_VIDE, nom: 'Pull', type: 'vetement' as const };
    const vide = validerBrouillon(base, maintenant);
    expect(vide.ok && vide.champs.dateAchat).toBeNull();
    const datee = validerBrouillon({ ...base, dateAchat: '14/11/2026' }, maintenant);
    expect(datee.ok && datee.champs.dateAchat).toBe(new Date(2026, 10, 14, 12).toISOString());
    expect(validerBrouillon({ ...base, dateAchat: '24/11/2026' }, maintenant)).toEqual({
      ok: false,
      erreurs: { dateAchat: 'dateInvalide' },
    });
  });
});
