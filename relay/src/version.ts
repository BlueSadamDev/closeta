/**
 * Compatibilité entre l'app et le relais.
 * L'app envoie sa version dans X-ClosetA-Version (« 1.2.0 »). Si VERSION_APP_MIN est réglée,
 * une app plus ancienne (ou qui n'envoie pas sa version, comme les APK d'avant l'étape 9)
 * reçoit « mise_a_jour_requise » (HTTP 426).
 */

/** « 1.2.0 » → [1, 2, 0] ; null si illisible. */
export function lireVersion(texte: string | null | undefined): number[] | null {
  const propre = (texte ?? '').trim();
  if (!/^\d+(\.\d+){0,3}$/.test(propre)) return null;
  return propre.split('.').map(Number);
}

/** Comparaison champ par champ, les champs absents valent 0 (« 1.2 » = « 1.2.0 »). */
function comparer(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ecart = (a[i] ?? 0) - (b[i] ?? 0);
    if (ecart !== 0) return ecart;
  }
  return 0;
}

/** Vrai si l'app doit être mise à jour. VERSION_APP_MIN vide ou illisible : aucune exigence. */
export function miseAJourRequise(versionApp: string | null, versionMin: string | undefined): boolean {
  const min = lireVersion(versionMin);
  if (!min) return false;
  const app = lireVersion(versionApp);
  return !app || comparer(app, min) < 0;
}
