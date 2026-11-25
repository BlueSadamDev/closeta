import { settings } from './settings';

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

/* ---------- Dernière version publiée (GET /v1/version, docs/SPEC.md, « Lot 4 », « Étape 7 ») ---------- */

/** Réponse de GET /v1/version : null partout si aucune release n'est connue ou si GitHub ne répond pas. */
export type VersionPubliee = { derniere: string | null; url: string | null };

export const VERSION_INCONNUE: VersionPubliee = { derniere: null, url: null };

/** Dépôt GitHub « propriétaire/nom » (variable DEPOT_RELEASES) ; null s'il est mal formé. */
export function lireDepot(texte: string | undefined): string | null {
  const propre = (texte ?? '').trim();
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(propre) ? propre : null;
}

/**
 * Lit l'adresse vers laquelle GitHub renvoie « …/releases/latest » (« …/releases/tag/v1.2.0 »).
 * Seule une étiquette `vX.Y.Z` (ou `X.Y.Z`) du même dépôt est acceptée.
 */
export function lireRedirection(depot: string, location: string | null): VersionPubliee {
  if (!location) return VERSION_INCONNUE;
  let adresse: URL;
  try {
    adresse = new URL(location, 'https://github.com');
  } catch {
    return VERSION_INCONNUE;
  }
  const attendu = `/${depot}/releases/tag/`.toLowerCase();
  if (adresse.protocol !== 'https:' || adresse.hostname !== 'github.com') return VERSION_INCONNUE;
  if (!adresse.pathname.toLowerCase().startsWith(attendu)) return VERSION_INCONNUE;
  const etiquette = decodeURIComponent(adresse.pathname.slice(attendu.length));
  const version = etiquette.replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) return VERSION_INCONNUE;
  return { derniere: version, url: `https://github.com/${depot}/releases/tag/${encodeURIComponent(etiquette)}` };
}

/** Accès au réseau (fetch), remplaçable dans les tests. */
export type Telechargeur = (adresse: string, options: RequestInit) => Promise<Response>;

/**
 * Dernière release du dépôt, lue sur la page publique « …/releases/latest » (sans l'API GitHub,
 * dont la limite de requêtes est partagée entre les serveurs de Cloudflare). Ne lève jamais d'exception.
 */
export async function lireDerniereRelease(depot: string, telecharger: Telechargeur): Promise<VersionPubliee | null> {
  try {
    const reponse = await telecharger(`https://github.com/${depot}/releases/latest`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(settings.delaiVersionMs),
      headers: { 'user-agent': settings.userAgentVersion },
    });
    // Sans release, GitHub renvoie vers la liste des releases : aucune version connue (réponse gardée).
    if (reponse.status >= 300 && reponse.status < 400) return lireRedirection(depot, reponse.headers.get('location'));
    // Dépôt introuvable : aucune version. Autre réponse : GitHub indisponible (rien n'est gardé).
    return reponse.status === 404 ? VERSION_INCONNUE : null;
  } catch {
    return null;
  }
}
