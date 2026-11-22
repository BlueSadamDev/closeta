import { describe, expect, it } from 'vitest';

import { DESCRIPTION_VIDE, type Description } from '../src/ia';
import { classer, familleVue, mots, note } from '../src/pertinence';

// Cas réel reproduit avec des noms fictifs : la photo montre une doudoune portée avec une casquette.
const DOUDOUNE: Description = {
  type: 'vetement',
  categorie: 'Manteau',
  couleur: 'beige',
  matiere: 'fausse fourrure',
  marque: null,
  recherche: 'manteau doudoune beige femme fausse fourrure',
};

const r = (nom: string) => ({ nom });

describe('pertinence des correspondances Lens', () => {
  it('découpe les mots sans accents ni ponctuation', () => {
    expect(mots('Écharpe – Maison Exemple®')).toEqual(['echarpe', 'maison', 'exemple']);
    expect(mots(null)).toEqual([]);
  });

  it('retrouve la famille de la pièce vue par l’IA', () => {
    expect(familleVue(DOUDOUNE)).toContain('doudoune');
    expect(familleVue({ ...DESCRIPTION_VIDE, categorie: 'Baskets' })).toContain('sneakers');
    expect(familleVue(DESCRIPTION_VIDE)).toBeNull();
  });

  it('note plus haut un nom qui désigne le même genre de pièce, plus bas un accessoire', () => {
    const f = familleVue(DOUDOUNE);
    expect(note('Veste d’hiver beige – Boutique Exemple', DOUDOUNE, f)).toBe(4);
    expect(note('Casquette beige – Maison Exemple', DOUDOUNE, f)).toBe(-2);
    expect(note('Modèle Fictif beige – Maison Exemple', DOUDOUNE, f)).toBe(1);
  });

  it('fait passer la doudoune devant la page de la casquette, sans rien écarter', () => {
    const resultats = [
      r('Modèle Fictif beige – Maison Exemple'),
      r('Doudoune en maille – Marque Exemple'),
      r('Blouson réversible – Autre Exemple'),
      r('Veste d’hiver – bone/beige – Boutique Exemple'),
    ];
    expect(classer(resultats, DOUDOUNE).map((x) => x.nom)).toEqual([
      'Veste d’hiver – bone/beige – Boutique Exemple',
      'Doudoune en maille – Marque Exemple',
      'Blouson réversible – Autre Exemple',
      'Modèle Fictif beige – Maison Exemple',
    ]);
  });

  it('sans description de l’IA, garde l’ordre de Lens', () => {
    const resultats = [r('B'), r('A'), r('C')];
    expect(classer(resultats, DESCRIPTION_VIDE)).toEqual(resultats);
  });
});
