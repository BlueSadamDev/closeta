/**
 * Lecture des réponses du relais (sans réseau : le client est dans src/relay/).
 */
import { settings } from './settings';

/** Résultat du bouton « Tester la connexion » des Réglages. */
export type EtatConnexion =
  | 'ok'
  | 'jeton_absent'
  | 'jeton_refuse'
  | 'limite'
  | 'mise_a_jour_requise'
  | 'injoignable'
  | 'inattendu';

/** Le relais répond 426 quand l'app est plus ancienne que la version minimale qu'il exige. */
export const STATUT_MISE_A_JOUR = 426;

/** Adresse d'une route du relais (« /extract » → « https://…/v1/extract »). */
export function adresseRelais(base: string, route: string): string {
  return `${base.replace(/\/+$/, '')}${settings.relayPrefixe}${route}`;
}

/** Identifiant d'installation : un UUID (créé au premier lancement, rangé dans le coffre). */
export function identifiantInstallationValide(texte: string | null | undefined): texte is string {
  return typeof texte === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(texte);
}

/** Identité envoyée avec chaque demande au relais. */
export type Identite = { jeton: string; installation: string | null; version: string | null };

/** En-têtes communs à toutes les demandes : jeton, identifiant d'installation et version de l'app. */
export function entetesRelais(identite: Identite, autres: Record<string, string> = {}): Record<string, string> {
  const entetes: Record<string, string> = { Authorization: `Bearer ${identite.jeton}`, ...autres };
  if (identifiantInstallationValide(identite.installation)) entetes['X-ClosetA-Installation'] = identite.installation;
  if (identite.version) entetes['X-ClosetA-Version'] = identite.version;
  return entetes;
}

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
  if (statut === STATUT_MISE_A_JOUR) return 'mise_a_jour_requise';
  return 'inattendu';
}

/**
 * Recherches SerpApi du mois (route GET /quota du relais).
 * `utilise` et `limite` : compteur global (la limite dure, celui qu'on affiche).
 * `installation` : compteur propre à ce téléphone, absent avec un relais d'avant l'étape 9.
 */
export type Quota = {
  utilise: number;
  limite: number;
  mois: string;
  installation: { utilise: number; limite: number } | null;
};

const entier = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

function lireCompteur(c: unknown): { utilise: number; limite: number } | null {
  if (typeof c !== 'object' || c === null) return null;
  const { utilise, limite } = c as Record<string, unknown>;
  return entier(utilise) && entier(limite) ? { utilise, limite } : null;
}

/**
 * Lit la réponse de GET /quota : `{ installation: { utilise, limite }, global: { utilise, limite }, mois }`,
 * ou l'ancien format `{ utilise, limite, mois }` (relais pas encore mis à jour).
 * null si le relais n'a pas répondu ou si la réponse est illisible.
 */
export function lireQuota(statut: number | null, corps: unknown): Quota | null {
  if (statut !== 200 || typeof corps !== 'object' || corps === null) return null;
  const c = corps as Record<string, unknown>;
  if (typeof c.mois !== 'string') return null;
  if ('global' in c) {
    const global = lireCompteur(c.global);
    if (!global) return null;
    return { ...global, mois: c.mois, installation: lireCompteur(c.installation) };
  }
  const ancien = lireCompteur(c);
  return ancien ? { ...ancien, mois: c.mois, installation: null } : null;
}

/** `alerte` à partir de 80 % du seuil (réglable), `atteint` au seuil. */
export type NiveauQuota = 'normal' | 'alerte' | 'atteint';

function niveau(utilise: number, limite: number): NiveauQuota {
  if (utilise >= limite) return 'atteint';
  if (utilise >= limite * settings.quotaAlerte) return 'alerte';
  return 'normal';
}

/** Niveau du compteur global, ou `atteint` si le seuil propre à ce téléphone est atteint. */
export function niveauQuota(q: Quota): NiveauQuota {
  const global = niveau(q.utilise, q.limite);
  if (q.installation && niveau(q.installation.utilise, q.installation.limite) === 'atteint') return 'atteint';
  return global;
}
