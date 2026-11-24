/**
 * Photo agrandie d'une fiche (docs/SPEC.md, « Étape 12 ») : bornes du zoom au pincement et du déplacement.
 * Fonctions pures, appelées aussi pendant le geste (d'où la directive « worklet »).
 */

/** Zoom gardé entre 1 (photo entière) et le maximum. */
export function bornerZoom(zoom: number, zoomMax: number): number {
  'worklet';
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(Math.max(zoom, 1), Math.max(zoomMax, 1));
}

/**
 * Déplacement gardé pour que la photo agrandie ne quitte jamais l'écran : au zoom z, la photo dépasse
 * de (z - 1) × dimension / 2 de chaque côté ; à zoom 1, aucun déplacement.
 */
export function bornerDeplacement(deplacement: number, zoom: number, dimension: number): number {
  'worklet';
  if (!Number.isFinite(deplacement)) return 0;
  const marge = Math.max(0, ((zoom - 1) * dimension) / 2);
  if (marge === 0) return 0;
  return Math.min(Math.max(deplacement, -marge), marge);
}
