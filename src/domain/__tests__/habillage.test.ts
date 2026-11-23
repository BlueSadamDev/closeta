import { boiteSujet, placement, type Boite } from '../habillage';

/** Masque fictif : nombre de pixels de la pièce par ligne et par colonne, pour des rectangles donnés. */
function repartition(largeur: number, hauteur: number, rectangles: Boite[]) {
  const lignes = new Array<number>(hauteur).fill(0);
  const colonnes = new Array<number>(largeur).fill(0);
  for (const r of rectangles) {
    for (let y = r.y; y < r.y + r.hauteur; y++) lignes[y] += r.largeur;
    for (let x = r.x; x < r.x + r.largeur; x++) colonnes[x] += r.hauteur;
  }
  return { lignes, colonnes };
}

const SORTIE = { largeur: 1200, hauteur: 1600 };
const MARGES = { largeur: 0.1, hauteur: 0.075 };
const BRUIT = 0.005;
const PART_MIN = 0.02;

describe('boîte de la pièce détourée', () => {
  it('trouve exactement la pièce', () => {
    const { lignes, colonnes } = repartition(1200, 1600, [{ x: 300, y: 200, largeur: 500, hauteur: 900 }]);
    expect(boiteSujet(lignes, colonnes, BRUIT, PART_MIN)).toEqual({ x: 300, y: 200, largeur: 500, hauteur: 900 });
  });

  it('ignore une petite tache isolée loin de la pièce', () => {
    const { lignes, colonnes } = repartition(1200, 1600, [
      { x: 300, y: 200, largeur: 500, hauteur: 900 },
      { x: 1150, y: 1550, largeur: 8, hauteur: 8 },
    ]);
    expect(boiteSujet(lignes, colonnes, BRUIT, PART_MIN)).toEqual({ x: 300, y: 200, largeur: 500, hauteur: 900 });
  });

  it('garde un détail fin mais réel, comme le crochet d’un cintre', () => {
    const { lignes, colonnes } = repartition(1200, 1600, [
      { x: 300, y: 300, largeur: 500, hauteur: 900 },
      { x: 545, y: 200, largeur: 10, hauteur: 100 },
    ]);
    expect(boiteSujet(lignes, colonnes, BRUIT, PART_MIN)?.y).toBe(200);
  });

  it('renonce si rien n’est détecté ou si la pièce est minuscule', () => {
    const vide = repartition(1200, 1600, []);
    expect(boiteSujet(vide.lignes, vide.colonnes, BRUIT, PART_MIN)).toBeNull();
    const minuscule = repartition(1200, 1600, [{ x: 10, y: 10, largeur: 40, hauteur: 40 }]);
    expect(boiteSujet(minuscule.lignes, minuscule.colonnes, BRUIT, PART_MIN)).toBeNull();
  });
});

describe('placement de la pièce sur le fond', () => {
  const centree = (d: Boite) => {
    const gauche = d.x;
    const droite = SORTIE.largeur - (d.x + d.largeur);
    const haut = d.y;
    const bas = SORTIE.hauteur - (d.y + d.hauteur);
    return Math.abs(gauche - droite) <= 1 && Math.abs(haut - bas) <= 1;
  };

  it('centre la pièce horizontalement et verticalement, quelle que soit sa place dans la photo', () => {
    const boites: Boite[] = [
      { x: 0, y: 0, largeur: 300, hauteur: 900 }, // collée en haut à gauche
      { x: 850, y: 1100, largeur: 350, hauteur: 500 }, // en bas à droite
      { x: 100, y: 700, largeur: 1000, hauteur: 400 }, // large et basse
      { x: 590, y: 100, largeur: 21, hauteur: 1401 }, // très fine, tailles impaires
    ];
    for (const b of boites) expect(centree(placement(b, SORTIE, MARGES).destination)).toBe(true);
  });

  it('respecte les marges et ne déforme pas la pièce', () => {
    for (const b of [
      { x: 0, y: 0, largeur: 300, hauteur: 900 },
      { x: 100, y: 700, largeur: 1000, hauteur: 400 },
      { x: 0, y: 0, largeur: 1200, hauteur: 1600 },
    ]) {
      const d = placement(b, SORTIE, MARGES).destination;
      expect(d.x).toBeGreaterThanOrEqual(120);
      expect(d.y).toBeGreaterThanOrEqual(120);
      expect(d.largeur).toBeLessThanOrEqual(960);
      expect(d.hauteur).toBeLessThanOrEqual(1360);
      expect(Math.abs(d.largeur / d.hauteur - b.largeur / b.hauteur)).toBeLessThan(0.01);
      // La pièce remplit la zone dans au moins un sens.
      expect(d.largeur >= 959 || d.hauteur >= 1359).toBe(true);
    }
  });

  it('agrandit une petite pièce jusqu’à la zone utile', () => {
    const d = placement({ x: 500, y: 600, largeur: 150, hauteur: 200 }, SORTIE, MARGES).destination;
    expect(d).toEqual({ x: 120, y: 160, largeur: 960, hauteur: 1280 });
  });
});
