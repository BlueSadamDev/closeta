import { resumeDuFiltre } from '../filtres';
import { FILTRE_VIDE } from '../wishlist';

describe('résumé de la barre de filtres', () => {
  it('affiche « Tout » sans filtre, même avec une recherche', () => {
    expect(resumeDuFiltre(FILTRE_VIDE)).toBe('Tout');
    expect(resumeDuFiltre({ ...FILTRE_VIDE, recherche: 'laine' })).toBe('Tout');
  });

  it('liste les choix actifs dans l’ordre type, priorité, catégorie', () => {
    expect(resumeDuFiltre({ ...FILTRE_VIDE, type: 'vetement' })).toBe('Vêtements');
    expect(resumeDuFiltre({ ...FILTRE_VIDE, type: 'chaussures', priorite: 'forte', categorie: 'Mocassins' })).toBe(
      'Chaussures · Envie forte · Mocassins',
    );
    expect(resumeDuFiltre({ ...FILTRE_VIDE, categorie: 'Veste' })).toBe('Veste');
  });
});
