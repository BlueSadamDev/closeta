/** Réglages du relais : délais et limites, jamais en dur ailleurs. */
export const settings = {
  /** Temps maximal pour lire une page de boutique (l'app attend 20 s au total). */
  delaiPageMs: 12_000,
  /** Taille maximale lue d'une page (au-delà, on s'arrête : les données produit sont dans l'en-tête). */
  tailleMaxPage: 3_000_000,
  /** Longueur maximale de la taille envoyée à /extract (« M », « 42 », « 9,5 UK »). */
  tailleMaxTaille: 20,
  /** Nombre maximal de redirections suivies. */
  redirectionsMax: 5,
  /** Pays et devise demandés aux boutiques qui adaptent le prix au pays (sinon : dollars selon le serveur). */
  cookieLocalisation: 'localization=FR; cart_currency=EUR',
  /** Identité envoyée aux boutiques : celle d'un navigateur mobile courant. */
  userAgent:
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',

  // --- Compteur SerpApi ---
  /** Seuil mensuel si wrangler.toml n'en donne pas (variable SERPAPI_LIMITE_MOIS). */
  limiteSerpApiDefaut: 250,
  /** Le mois du compteur suit l'heure de Paris (remise à zéro le 1er à minuit). */
  fuseauQuota: 'Europe/Paris',
  /** Durée de vie d'une case mensuelle dans KV : 40 jours, puis effacée d'elle-même. */
  dureeCaseQuotaS: 40 * 24 * 3600,

  // --- Installations ---
  /** Longueur maximale du nom d'une installation (« Téléphone de Léa »). */
  nomInstallationMax: 40,

  // --- /identify (ajout par photo) ---
  /** Poids maximal de la photo reçue (l'app l'envoie réduite à 1024 px, bien en dessous). */
  tailleMaxPhoto: 2_000_000,
  /** Modèle d'IA de Cloudflare Workers AI qui décrit la photo (gratuit dans le quota quotidien). */
  modeleIA: '@cf/google/gemma-4-26b-a4b-it',
  /**
   * Temps maximal accordé à l'IA, à Google Lens et à Google Shopping (l'app attend 30 s au total).
   * IA et Lens travaillent en même temps ; Shopping vient après, d'où 20 + 8 = 28 s au pire.
   */
  delaiIAMs: 20_000,
  delaiLensMs: 15_000,
  delaiShoppingMs: 8_000,
  /** /alternatives : taille maximale de la demande (photo en base64 comprise, un tiers plus lourde que le JPEG). */
  tailleMaxDemandeAlternatives: 2_800_000,
  /** Nombre de résultats renvoyés à l'app : au moins 3 quand c'est possible, au plus 5. */
  resultatsMin: 3,
  resultatsMax: 5,
  /** Pays et langue des recherches Google (prix en euros). */
  pays: 'fr',
  langue: 'fr',
  /** Sites qui ne vendent pas de vêtements (réseaux sociaux, banques d'images) : leurs correspondances Lens sont ignorées. */
  sitesIgnores: [
    'pinterest.', 'instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'reddit.com',
    'x.com', 'twitter.com', 'wikipedia.org', 'tumblr.com', 'flickr.com',
    'stock.adobe.com', 'shutterstock.com', 'istockphoto.com', 'gettyimages.', 'freepik.com', 'magnific.com',
    'dreamstime.com', 'alamy.', 'vecteezy.com', '123rf.com', 'depositphotos.com', 'pngtree.com', 'canva.com',
  ],
} as const;
