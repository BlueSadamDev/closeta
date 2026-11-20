/** Réglages du relais : délais et limites, jamais en dur ailleurs. */
export const settings = {
  /** Temps maximal pour lire une page de boutique (l'app attend 20 s au total). */
  delaiPageMs: 12_000,
  /** Taille maximale lue d'une page (au-delà, on s'arrête : les données produit sont dans l'en-tête). */
  tailleMaxPage: 3_000_000,
  /** Nombre maximal de redirections suivies. */
  redirectionsMax: 5,
  /** Pays et devise demandés aux boutiques qui adaptent le prix au pays (sinon : dollars selon le serveur). */
  cookieLocalisation: 'localization=FR; cart_currency=EUR',
  /** Identité envoyée aux boutiques : celle d'un navigateur mobile courant. */
  userAgent:
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
} as const;
