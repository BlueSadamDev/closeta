/**
 * Lecture des réponses du relais (sans réseau : le client est dans src/relay/).
 */

/** Résultat du bouton « Tester la connexion » des Réglages. */
export type EtatConnexion = 'ok' | 'jeton_absent' | 'jeton_refuse' | 'limite' | 'injoignable' | 'inattendu';

/** Jeton tel qu'il sera envoyé : sans espaces autour ni retour à la ligne collé par erreur. */
export function nettoyerJeton(saisie: string): string {
  return saisie.trim();
}

/**
 * Le test envoie au relais une demande volontairement vide.
 * Le relais contrôle le jeton avant tout le reste : s'il répond « adresse refusée » (400),
 * c'est que le jeton a été accepté.
 *
 * @param statut code HTTP reçu, ou null si le relais n'a pas répondu (pas de réseau, délai dépassé).
 * @param corps corps JSON de la réponse, s'il a pu être lu.
 */
export function lireTestConnexion(statut: number | null, corps: unknown): EtatConnexion {
  if (statut === null) return 'injoignable';
  const code = typeof corps === 'object' && corps !== null ? (corps as { erreur?: unknown }).erreur : undefined;
  if (statut === 400 && (code === 'url_refusee' || code === 'requete_invalide')) return 'ok';
  if (statut === 401) return 'jeton_absent';
  if (statut === 403) return 'jeton_refuse';
  if (statut === 429) return 'limite';
  return 'inattendu';
}
