/**
 * Réglages de l'app (délais, tailles, limites).
 * Toute valeur de ce type se range ici, jamais en dur dans le code.
 */
export const settings = {
  /** Nom du fichier de la base SQLite locale. */
  databaseName: 'closeta.db',
  /** Adresse du relais Cloudflare (pas un secret ; le jeton, lui, est saisi dans les Réglages). */
  relayUrl: 'https://closeta-relay.bluesadam-dev.workers.dev',
  /** Version des routes du relais (« /v1/extract »). */
  relayPrefixe: '/v1',
  /** Temps maximal d'attente d'une réponse du relais (docs/SPEC.md : 20 s). */
  relayTimeoutMs: 20_000,
  /** Nom sous lequel le jeton du relais est rangé dans le coffre du téléphone (expo-secure-store). */
  relayTokenKey: 'closeta.jeton-relais',
  /** Clé du coffre où est rangée l'adresse du relais saisie dans les Réglages (sinon : relayUrl). */
  relayUrlKey: 'closeta.adresse-relais',
  /** Clé du coffre où est rangé le jeton d'administration (section « Installations » des Réglages). */
  adminTokenKey: 'closeta.jeton-admin',
  /** Début du lien d'un QR de configuration : closeta://config?relais=<adresse>&jeton=<jeton>. */
  lienConfiguration: 'closeta://config',
  /** Longueur maximale du nom d'un téléphone ajouté (la même que celle du relais). */
  nomInstallationMax: 40,
  /** Lecteur de QR : délai avant de relire un code refusé (évite de répéter le message en boucle). */
  scanPauseMs: 1_500,
  /** Clé du coffre du téléphone où est rangé l'identifiant d'installation. */
  installationKey: 'closeta.installation',
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
  /**
   * Habillage des photos du Vestiaire (docs/SPEC.md, « Étape 8 ») : pièce détourée sur le téléphone (ML Kit),
   * centrée sur le fond `photo3` du thème, avec une ombre légère.
   */
  habillage: {
    /** Marge autour de la pièce, en part de la largeur et de la hauteur sur chaque bord (zone utile 960 × 1360). */
    marges: { largeur: 0.1, hauteur: 0.075 },
    /** Taches détachées de la pièce, écartées si elles pèsent moins de cette part des pixels détourés. */
    bruit: 0.005,
    /** En dessous de cette part de la photo, le détourage est jugé raté : la photo d'origine est gardée. */
    partMinimale: 0.02,
    /** Confiance minimale (0 à 1) pour compter un pixel dans la pièce. */
    confiance: 0.5,
    /** Ombre portée : décalage en px, opacité (0 à 1), flou (réduction de l'image de l'ombre). */
    ombre: { dx: 8, dy: 14, opacite: 0.18, flou: 12 },
    /** Temps maximal du détourage (le modèle de Google peut se télécharger au premier usage). */
    delaiMs: 30_000,
  },
  /** Prise de vue guidée : marge entre le bord de l'aperçu et le cadre 3:4, en part de la largeur et de la hauteur. */
  cadreMarge: 0.06,
  /** Temps maximal d'attente de /identify (IA puis recherches Google enchaînées). */
  identifyTimeoutMs: 30_000,
  /** Temps maximal d'attente de /alternatives (Google Lens puis Google Shopping enchaînés). */
  alternativesTimeoutMs: 30_000,
  /** Relecture du prix et de la disponibilité à l'ouverture d'une fiche, si la dernière date de plus de 24 h. */
  relectureDelaiH: 24,
  /** Recherches SerpApi du mois : mise en garde dans les Réglages à partir de 80 % du seuil. */
  quotaAlerte: 0.8,
  /** Sauvegarde (Réglages) : fichier closeta-AAAA-MM-JJ.closeta, écrit dans le cache avant le partage. */
  sauvegarde: {
    prefixe: 'closeta-',
    extension: '.closeta',
    /** Type annoncé au partage Android (le contenu est du JSON). */
    typeMime: 'application/json',
    /** Dossier (dans le stockage de l'app) où les photos restaurées attendent la fin du remplacement. */
    dossierRestauration: 'images-restauration',
  },
} as const;
