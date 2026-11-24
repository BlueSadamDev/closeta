/**
 * Habillage des photos du Vestiaire : la pièce détourée est centrée sur un fond uni
 * (docs/SPEC.md, « Lot 3 », « Étape 8 »). Logique pure : le détourage lui-même se fait sur le téléphone.
 */

export type Boite = { x: number; y: number; largeur: number; hauteur: number };

/** Ce qu'il faut dessiner : la boîte de la pièce dans la photo détourée, et sa place dans l'image finale. */
export type Placement = { source: Boite; destination: Boite };

/**
 * Bornes [début, fin] d'une répartition de pixels. Les groupes de lignes (ou de colonnes) séparés
 * du reste par une zone vide, et qui pèsent moins de `bruit` du total, sont écartés : ce sont des taches
 * laissées par le détourage. Une partie fine mais rattachée à la pièce (crochet de cintre) est gardée.
 * null si la répartition est vide.
 */
function bornes(compte: readonly number[], bruit: number): [number, number] | null {
  const groupes: { debut: number; fin: number; masse: number }[] = [];
  compte.forEach((n, i) => {
    if (!(n > 0)) return;
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.fin === i - 1) {
      dernier.fin = i;
      dernier.masse += n;
    } else groupes.push({ debut: i, fin: i, masse: n });
  });
  const total = groupes.reduce((s, g) => s + g.masse, 0);
  const gardes = groupes.filter((g) => g.masse >= total * bruit);
  if (gardes.length === 0) return null;
  return [gardes[0].debut, gardes[gardes.length - 1].fin];
}

/**
 * Boîte de la pièce à partir du nombre de pixels de la pièce par ligne et par colonne.
 * null si rien n'est détecté, ou si la pièce occupe moins de `partMinimale` de la photo
 * (détourage raté : on garde alors la photo d'origine).
 */
export function boiteSujet(
  lignes: readonly number[],
  colonnes: readonly number[],
  bruit: number,
  partMinimale: number,
): Boite | null {
  const v = bornes(lignes, bruit);
  const h = bornes(colonnes, bruit);
  if (!v || !h) return null;
  const pixels = lignes.reduce((s, n) => s + (n > 0 ? n : 0), 0);
  if (pixels < partMinimale * lignes.length * colonnes.length) return null;
  return { x: h[0], y: v[0], largeur: h[1] - h[0] + 1, hauteur: v[1] - v[0] + 1 };
}

/**
 * Place la pièce dans l'image finale : agrandie ou réduite sans déformation pour tenir dans la zone
 * laissée par les marges (part de la largeur et de la hauteur sur chaque bord), puis **centrée**
 * horizontalement et verticalement. En pixels entiers.
 */
export function placement(
  boite: Boite,
  sortie: { largeur: number; hauteur: number },
  marges: { largeur: number; hauteur: number },
): Placement {
  const maxL = sortie.largeur * (1 - 2 * marges.largeur);
  const maxH = sortie.hauteur * (1 - 2 * marges.hauteur);
  const echelle = Math.min(maxL / boite.largeur, maxH / boite.hauteur);
  const largeur = Math.max(1, Math.min(Math.round(boite.largeur * echelle), Math.floor(maxL)));
  const hauteur = Math.max(1, Math.min(Math.round(boite.hauteur * echelle), Math.floor(maxH)));
  return {
    source: boite,
    destination: {
      x: Math.round((sortie.largeur - largeur) / 2),
      y: Math.round((sortie.hauteur - hauteur) / 2),
      largeur,
      hauteur,
    },
  };
}
