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
  /** Nom de l'unique exemplaire du Durable Object `Quota` (toutes les installations y sont comptées). */
  nomObjetQuota: 'global',
  /** Juridictions acceptées pour JURIDICTION_DONNEES (wrangler.toml) : exemplaire du Durable Object dans l'UE. */
  juridictions: ['eu'],
  /** Mois gardés dans le compteur : le mois en cours et le précédent ; les plus anciens sont effacés. */
  moisQuotaGardes: 2,

  // --- Dernière version publiée (GET /v1/version) ---
  /** Durée pendant laquelle la dernière version lue sur GitHub est gardée (KV) avant d'être relue. */
  dureeVersionS: 3600,
  /** Temps maximal pour interroger GitHub. */
  delaiVersionMs: 5_000,
  /** Identité envoyée à GitHub (pas celle d'un navigateur : c'est un programme qui demande). */
  userAgentVersion: 'ClosetA-relais',

  // --- Codes d'invitation ---
  /** Préfixe fixe des codes (`CLST-7K4Q-9M2P`) ; suivi de caractères tirés au hasard. */
  prefixeCodeInvitation: 'CLST',
  /** Nombre de caractères tirés au hasard (8 sur 32 possibles : 40 bits). */
  longueurCodeInvitation: 8,
  /** Durée de validité d'un code d'invitation, effacé ensuite (ou dès son utilisation). */
  dureeInvitationMs: 7 * 24 * 3600_000,

  // --- Catalogue partagé (Cloudflare D1) ---
  /** Historique partagé : montré à partir de 2 observations du prix (docs/SPEC.md, « Lot 4 », « Étape 3 »). */
  observationsHistoriqueMin: 2,
  /** Une page produit lue il y a moins de 24 h est servie depuis le catalogue, sans la relire. */
  dureePageMs: 24 * 3600_000,
  /** Durée de validité d'un résultat de recherche, par type (ensuite purgé la nuit). */
  dureesRecherche: {
    shopping: 7 * 24 * 3600_000,
    lens_image: 30 * 24 * 3600_000,
    lens_photo: 30 * 24 * 3600_000,
  },
  /** Paramètres de suivi retirés de l'adresse d'une page (les autres sont gardés : taille, couleur…). */
  parametresSuivi: [
    'gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'yclid', 'ttclid', 'twclid', 'igshid',
    'mc_cid', 'mc_eid', '_ga', '_gl', 'srsltid', 'epik',
  ],
  /** Préfixes de paramètres de suivi (utm_source, utm_medium…). */
  prefixesSuivi: ['utm_'],
  /**
   * Liste blanche (décision de confidentialité du 24 novembre 2026) : seuls ces paramètres, qui désignent la
   * pièce (référence, taille, couleur, variante), entrent dans le catalogue. Une adresse qui garde un autre
   * paramètre (session, client, affiliation…) est lue normalement, mais rien n'est mis au catalogue.
   */
  parametresProduit: [
    'id', 'pid', 'productid', 'product_id', 'product', 'sku', 'ref', 'reference', 'article', 'item', 'model',
    'style', 'code', 'variant', 'variante', 'variation', 'variation_id', 'color', 'colour', 'couleur', 'coloris',
    'size', 'taille', 'pointure',
  ],

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
