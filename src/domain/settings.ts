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
  /** Ajout par photo : plus grand côté de la photo envoyée au relais (docs/SPEC.md : 1024 px). */
  photoMaxDimension: 1024,
  /** Qualité JPEG de la photo envoyée (0 à 1) : légère à envoyer, assez nette pour la recherche. */
  photoCompression: 0.8,
  /** Photo d'une pièce du Vestiaire : format portrait 3:4, 1200 × 1600 px (docs/SPEC.md, « Lot 3 », « Étape 7 »). */
  photoVestiaire: { largeur: 1200, hauteur: 1600 },
  /** Qualité JPEG de la photo du Vestiaire, gardée sur le téléphone : plus nette que la copie envoyée. */
  photoVestiaireCompression: 0.9,
  /** Prise de vue guidée : marge entre le bord de l'aperçu et le cadre 3:4, en part de la largeur et de la hauteur. */
  cadreMarge: 0.06,
  /** Temps maximal d'attente de /identify (IA puis recherches Google enchaînées). */
  identifyTimeoutMs: 30_000,
  /** Temps maximal d'attente de /alternatives (Google Lens puis Google Shopping enchaînés). */
  alternativesTimeoutMs: 30_000,
  /** Recherches SerpApi du mois : mise en garde dans les Réglages à partir de 80 % du seuil. */
  quotaAlerte: 0.8,
} as const;
