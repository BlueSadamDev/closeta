/**
 * Lecture des réponses du relais (sans réseau : le client est dans src/relay/).
 */
import { settings } from './settings';

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

/** Recherches SerpApi du mois (route GET /quota du relais). */
export type Quota = { utilise: number; limite: number; mois: string };

/** Lit la réponse de GET /quota ; null si le relais n'a pas répondu ou si la réponse est illisible. */
export function lireQuota(statut: number | null, corps: unknown): Quota | null {
  if (statut !== 200 || typeof corps !== 'object' || corps === null) return null;
  const { utilise, limite, mois } = corps as Record<string, unknown>;
  const entier = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  if (!entier(utilise) || !entier(limite) || typeof mois !== 'string') return null;
  return { utilise, limite, mois };
}

/** `alerte` à partir de 80 % du seuil (réglable), `atteint` au seuil. */
export type NiveauQuota = 'normal' | 'alerte' | 'atteint';

export function niveauQuota(q: Quota): NiveauQuota {
  if (q.utilise >= q.limite) return 'atteint';
  if (q.utilise >= q.limite * settings.quotaAlerte) return 'alerte';
  return 'normal';
}
