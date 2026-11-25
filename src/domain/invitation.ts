/**
 * Codes d'invitation (docs/SPEC.md, « Lot 4 », « Étape 6 ») : lien `closeta://invitation`, lecture du code
 * saisi, et lecture des réponses du relais. Logique pure : le réseau est dans src/relay/client.ts.
 * Contrairement au QR de configuration, le lien d'invitation ne contient aucun jeton.
 */
import { echecAdmin, lireAdresseRelais, parametresLien, type EchecAdmin } from './configuration';
import { settings } from './settings';

const { prefixe: PREFIXE_CODE, longueur: LONGUEUR_CODE, alphabet: ALPHABET } = settings.codeInvitation;
const PREFIXE_LIEN = `${settings.lienInvitation}?`;

/**
 * Code saisi ou reçu, remis en forme (`CLST-7K4Q-9M2P`) ; null s'il est mal formé.
 * Accepte minuscules, espaces et tirets, avec ou sans le préfixe `CLST`.
 */
export function normaliserCode(saisie: string | null | undefined): string | null {
  let propre = (saisie ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (propre.length === LONGUEUR_CODE) propre = PREFIXE_CODE + propre;
  if (propre.length !== PREFIXE_CODE.length + LONGUEUR_CODE || !propre.startsWith(PREFIXE_CODE)) return null;
  const tires = propre.slice(PREFIXE_CODE.length);
  if (![...tires].every((c) => ALPHABET.includes(c))) return null;
  return [PREFIXE_CODE, tires.slice(0, 4), tires.slice(4)].join('-');
}

/** Contenu d'un lien d'invitation : l'adresse du relais et le code. */
export type LienInvitation = { relais: string; code: string };

/** Raisons d'un lien refusé : pas un lien d'invitation, adresse non https, code mal formé. */
export type LectureInvitation = ({ ok: true } & LienInvitation) | { ok: false; raison: 'etranger' | 'adresse' | 'code' };

/** « closeta://invitation?relais=<adresse>&code=<code> » (valeurs encodées). */
export function lienInvitation(l: LienInvitation): string {
  return `${PREFIXE_LIEN}relais=${encodeURIComponent(l.relais)}&code=${encodeURIComponent(l.code)}`;
}

/** Vérifie l'adresse et le code d'une invitation (lien ouvert, QR scanné ou code saisi). */
export function verifierInvitation(relais: unknown, code: unknown): LectureInvitation {
  const adresse = lireAdresseRelais(typeof relais === 'string' ? relais : null);
  if (!adresse.ok) return { ok: false, raison: 'adresse' };
  const propre = normaliserCode(typeof code === 'string' ? code : null);
  if (!propre) return { ok: false, raison: 'code' };
  return { ok: true, relais: adresse.adresse, code: propre };
}

/** Lit le texte d'un QR scanné. Tout ce qui ne commence pas par « closeta://invitation? » est étranger. */
export function lireLienInvitation(texte: string | null | undefined): LectureInvitation {
  const valeurs = parametresLien(texte, PREFIXE_LIEN);
  if (!valeurs) return { ok: false, raison: 'etranger' };
  return verifierInvitation(valeurs.relais, valeurs.code);
}

/* ---------- Réponses du relais ---------- */

/** Invitation en attente, telle que la liste la montre (jamais le code : le relais ne le garde pas). */
export type InvitationEnAttente = { id: string; nom: string; expireLe: string };

const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function lireInvitation(v: unknown): InvitationEnAttente | null {
  if (!objet(v)) return null;
  const { id, nom, expire_le } = v;
  if (typeof id !== 'string' || !id || typeof nom !== 'string' || typeof expire_le !== 'string') return null;
  return { id, nom, expireLe: expire_le };
}

/** Réponse de GET /v1/admin/invitations : `{ invitations: [...] }`. */
export function lireListeInvitations(
  statut: number | null,
  corps: unknown,
): { ok: true; invitations: InvitationEnAttente[] } | { ok: false; raison: EchecAdmin } {
  if (statut !== 200) return { ok: false, raison: echecAdmin(statut) };
  if (!objet(corps) || !Array.isArray(corps.invitations)) return { ok: false, raison: 'inattendu' };
  const invitations = corps.invitations.map(lireInvitation).filter((i): i is InvitationEnAttente => i !== null);
  return { ok: true, invitations };
}

/** Réponse de POST /v1/admin/invitations : `{ invitation, code }` (le code n'est donné qu'une fois). */
export function lireCreationInvitation(
  statut: number | null,
  corps: unknown,
): { ok: true; invitation: InvitationEnAttente; code: string } | { ok: false; raison: EchecAdmin } {
  if (statut !== 201) return { ok: false, raison: echecAdmin(statut) };
  if (!objet(corps)) return { ok: false, raison: 'inattendu' };
  const invitation = lireInvitation(corps.invitation);
  const code = normaliserCode(typeof corps.code === 'string' ? corps.code : null);
  if (!invitation || !code) return { ok: false, raison: 'inattendu' };
  return { ok: true, invitation, code };
}

/** Réponse de DELETE /v1/admin/invitations/{id}. */
export function lireAnnulationInvitation(statut: number | null): { ok: true } | { ok: false; raison: EchecAdmin } {
  return statut === 200 ? { ok: true } : { ok: false, raison: echecAdmin(statut) };
}

/** Échecs de l'utilisation d'un code : déjà utilisé, annulé ou expiré (le relais ne dit pas lequel). */
export type EchecUtilisation = 'invalide' | 'limite' | 'injoignable' | 'inattendu';

/** Réponse de POST /v1/invitations/utiliser : `{ installation, jeton }` (le jeton n'est donné qu'une fois). */
export function lireUtilisationInvitation(
  statut: number | null,
  corps: unknown,
): { ok: true; jeton: string } | { ok: false; raison: EchecUtilisation } {
  if (statut === null) return { ok: false, raison: 'injoignable' };
  if (statut === 400 || statut === 404) return { ok: false, raison: 'invalide' };
  if (statut === 429) return { ok: false, raison: 'limite' };
  const jeton = statut === 201 && objet(corps) && typeof corps.jeton === 'string' ? corps.jeton.trim() : '';
  return jeton ? { ok: true, jeton } : { ok: false, raison: 'inattendu' };
}
