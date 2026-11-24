import { bornerDeplacement, bornerZoom } from '../zoom';

describe('bornerZoom', () => {
  it('garde le zoom entre 1 et le maximum', () => {
    expect(bornerZoom(2, 4)).toBe(2);
    expect(bornerZoom(0.4, 4)).toBe(1);
    expect(bornerZoom(9, 4)).toBe(4);
  });

  it('revient à 1 pour une valeur inutilisable', () => {
    expect(bornerZoom(Number.NaN, 4)).toBe(1);
    expect(bornerZoom(Infinity, 4)).toBe(1);
  });

  it('ne descend jamais sous 1, même avec un maximum mal réglé', () => {
    expect(bornerZoom(3, 0.5)).toBe(1);
  });
});

describe('bornerDeplacement', () => {
  it('interdit tout déplacement sans zoom', () => {
    expect(bornerDeplacement(120, 1, 400)).toBe(0);
    expect(bornerDeplacement(-50, 1, 400)).toBe(0);
  });

  it('laisse la photo agrandie bouger jusqu’à son bord, pas au-delà', () => {
    // Zoom 2 sur 400 px : la photo dépasse de 200 px de chaque côté.
    expect(bornerDeplacement(150, 2, 400)).toBe(150);
    expect(bornerDeplacement(260, 2, 400)).toBe(200);
    expect(bornerDeplacement(-260, 2, 400)).toBe(-200);
  });

  it('revient à 0 pour une valeur inutilisable', () => {
    expect(bornerDeplacement(Number.NaN, 2, 400)).toBe(0);
  });
});
