/**
 * Vérifie qu'une adresse est une page web publique en https.
 * Refuse les adresses IP, localhost et les noms de réseau local,
 * pour qu'on ne puisse pas se servir du relais pour sonder un réseau privé.
 * Renvoie l'URL lue, ou null si elle est refusée.
 */
export function urlPublique(brute: unknown): URL | null {
  if (typeof brute !== 'string' || brute.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(brute.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port !== '' && url.port !== '443') return null;

  // Le lecteur d'URL normalise les IP écrites autrement (0x7f.1, 2130706433…) en 127.0.0.1.
  const hote = url.hostname.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hote)) return null; // IPv4
  if (hote.includes(':') || hote.startsWith('[')) return null; // IPv6
  if (!hote.includes('.')) return null; // nom sans domaine (machine locale)
  if (/(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|corp)$/.test(hote)) return null;

  return url;
}
