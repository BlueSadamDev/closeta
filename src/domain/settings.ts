/**
 * Réglages de l'app (délais, tailles, limites).
 * Toute valeur de ce type se range ici, jamais en dur dans le code.
 */
export const settings = {
  /** Nom du fichier de la base SQLite locale. */
  databaseName: 'closeta.db',
  /** Adresse du relais Cloudflare (pas un secret ; le jeton, lui, est saisi dans les Réglages). */
  relayUrl: 'https://closeta-relay.bluesadam-dev.workers.dev',
  /** Temps maximal d'attente d'une réponse du relais (docs/SPEC.md : 20 s). */
  relayTimeoutMs: 20_000,
  /** Nom sous lequel le jeton du relais est rangé dans le coffre du téléphone (expo-secure-store). */
  relayTokenKey: 'closeta.jeton-relais',
  /** Temps maximal pour copier sur le téléphone la photo d'une pièce ajoutée par lien. */
  imageDownloadTimeoutMs: 15_000,
  /** Dossier (dans le stockage de l'app) où sont rangées les photos des pièces. */
  imagesDirectory: 'images',
} as const;
