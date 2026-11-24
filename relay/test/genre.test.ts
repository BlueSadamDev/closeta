import { describe, expect, it } from 'vitest';

import { filtrerGenre, lireGenre, rechercheAvecGenre } from '../src/genre';

const pieces = (...noms: string[]) => noms.map((nom) => ({ nom }));

describe('genre des recherches', () => {
  it('lit le choix des Réglages', () => {
    expect(lireGenre('femme')).toBe('femme');
    expect(lireGenre('homme')).toBe('homme');
    expect(lireGenre(undefined)).toBeNull();
    expect(lireGenre(null)).toBeNull();
    expect(lireGenre('')).toBeNull();
    expect(lireGenre('mixte')).toBeNull();
    expect(() => lireGenre('Femme')).toThrow('requete_invalide');
    expect(() => lireGenre(1)).toThrow('requete_invalide');
  });

  it('ajoute le genre à la recherche, sauf s’il y est déjà ou si le choix est mixte', () => {
    expect(rechercheAvecGenre('Veste velours', 'femme')).toBe('Veste velours femme');
    expect(rechercheAvecGenre('Veste velours', 'homme')).toBe('Veste velours homme');
    expect(rechercheAvecGenre('Veste velours femme', 'femme')).toBe('Veste velours femme');
    expect(rechercheAvecGenre('Women’s jacket', 'femme')).toBe('Women’s jacket');
    expect(rechercheAvecGenre('Veste velours', null)).toBe('Veste velours');
  });

  it('pour « femme », écarte les pièces nommées pour homme', () => {
    const r = filtrerGenre(pieces('Veste velours homme', 'Men’s jacket', 'Mens jacket', 'Veste femme', 'Women jacket', 'Veste camel', 'Basket garçon'), 'femme');
    expect(r.map((p) => p.nom)).toEqual(['Veste femme', 'Women jacket', 'Veste camel']);
  });

  it('pour « homme », écarte les pièces nommées pour femme', () => {
    const r = filtrerGenre(pieces('Robe femme', 'Women’s coat', 'Ladies boots', 'Veste homme', 'Veste camel', 'Pull fille'), 'homme');
    expect(r.map((p) => p.nom)).toEqual(['Veste homme', 'Veste camel']);
  });

  it('garde les pièces qui citent les deux genres et ne filtre rien en mixte', () => {
    expect(filtrerGenre(pieces('Basket homme femme'), 'femme')).toHaveLength(1);
    expect(filtrerGenre(pieces('Veste homme', 'Robe femme'), null)).toHaveLength(2);
  });

  it('ne confond pas « women » avec « men »', () => {
    expect(filtrerGenre(pieces('Women jacket'), 'femme')).toHaveLength(1);
    expect(filtrerGenre(pieces('Women jacket'), 'homme')).toHaveLength(0);
  });
});
