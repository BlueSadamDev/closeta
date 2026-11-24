/**
 * Configuration du relais : adresse modifiable, QR de configuration et installations
 * (docs/SPEC.md, « Lot 3 », « Étape 10 »). Logique pure : le réseau et le coffre sont dans src/relay/.
 */
import { settings } from './settings';

/** Adresse du relais vérifiée : https uniquement, sans identifiants, requête ni ancre. */
export type LectureAdresse = { ok: true; adresse: string } | { ok: false };

/**
 * Lit une adresse de relais saisie ou scannée. Garde l'adresse sans « / » final
 * (« https://relais.exemple.dev/ » → « https://relais.exemple.dev »).
 */
export function lireAdresseRelais(saisie: string | null | undefined): LectureAdresse {
  const propre = (saisie ?? '').trim().replace(/\/+$/, '');
  // https://hôte[:port][/chemin] : pas d'espace, pas de « @ » (identifiants), pas de « ? » ni « # ».
  const motif = /^https:\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?(\/[^\s?#@]*)?$/i;
  if (!motif.test(propre)) return { ok: false };
  return { ok: true, adresse: propre };
}

/** Adresse à utiliser : celle rangée sur le téléphone si elle est valide, sinon celle de settings.ts. */
export function adresseEnVigueur(rangee: string | null | undefined): string {
  const lue = lireAdresseRelais(rangee);
  return lue.ok ? lue.adresse : settings.relayUrl;
}

/** Contenu d'un QR de configuration : l'adresse du relais et le jeton d'un téléphone. */
export type Configuration = { relais: string; jeton: string };

/** Raisons d'un QR refusé : pas un QR ClosetA, adresse non https, jeton vide. */
export type LectureConfiguration =
  | ({ ok: true } & Configuration)
  | { ok: false; raison: 'etranger' | 'adresse' | 'jeton' };

const PREFIXE = `${settings.lienConfiguration}?`;

/** « closeta://config?relais=<adresse>&jeton=<jeton> » (valeurs encodées pour une adresse). */
export function lienConfiguration(c: Configuration): string {
  return `${PREFIXE}relais=${encodeURIComponent(c.relais)}&jeton=${encodeURIComponent(c.jeton)}`;
}

function decoder(valeur: string): string | null {
  try {
    return decodeURIComponent(valeur.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

/** Vérifie l'adresse et le jeton d'une configuration (QR scanné ou lien closeta://config ouvert). */
export function verifierConfiguration(relais: unknown, jeton: unknown): LectureConfiguration {
  const adresse = lireAdresseRelais(typeof relais === 'string' ? relais : null);
  if (!adresse.ok) return { ok: false, raison: 'adresse' };
  const propre = typeof jeton === 'string' ? jeton.trim() : '';
  if (!propre) return { ok: false, raison: 'jeton' };
  return { ok: true, relais: adresse.adresse, jeton: propre };
}

/** Lit le texte d'un QR scanné. Tout ce qui ne commence pas par « closeta://config? » est étranger. */
export function lireLienConfiguration(texte: string | null | undefined): LectureConfiguration {
  const brut = (texte ?? '').trim();
  if (brut.slice(0, PREFIXE.length).toLowerCase() !== PREFIXE) return { ok: false, raison: 'etranger' };
  const valeurs: Record<string, string> = {};
  for (const morceau of brut.slice(PREFIXE.length).split('&')) {
    const egal = morceau.indexOf('=');
    if (egal <= 0) continue;
    const cle = decoder(morceau.slice(0, egal));
    const valeur = decoder(morceau.slice(egal + 1));
    if (cle && valeur !== null && !(cle in valeurs)) valeurs[cle] = valeur;
  }
  return verifierConfiguration(valeurs.relais, valeurs.jeton);
}

/** Adresse raccourcie pour l'affichage (« relais.exemple.dev ») : l'hôte, sans « https:// ». */
export function hoteRelais(adresse: string): string {
  return adresse.replace(/^https:\/\//i, '').replace(/\/.*$/, '');
}

/* ---------- Installations (routes /v1/admin/installations du relais) ---------- */

/** Une installation telle que la liste la montre. `creeLe` : null pour la « Principale » (ancien jeton). */
export type Installation = { id: string; nom: string; creeLe: string | null; actif: boolean; utilise: number };

/** Échecs possibles d'une demande d'administration. */
export type EchecAdmin = 'jeton_absent' | 'jeton_refuse' | 'limite' | 'injoignable' | 'inattendu';

function echecAdmin(statut: number | null): EchecAdmin {
  if (statut === null) return 'injoignable';
  if (statut === 401) return 'jeton_absent';
  if (statut === 403) return 'jeton_refuse';
  if (statut === 429) return 'limite';
  return 'inattendu';
}

const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function lireInstallation(v: unknown): Installation | null {
  if (!objet(v)) return null;
  const { id, nom, cree_le, actif, utilise } = v;
  if (typeof id !== 'string' || !id || typeof nom !== 'string' || typeof actif !== 'boolean') return null;
  return {
    id,
    nom,
    creeLe: typeof cree_le === 'string' ? cree_le : null,
    actif,
    utilise: typeof utilise === 'number' && Number.isInteger(utilise) && utilise >= 0 ? utilise : 0,
  };
}

/** Réponse de GET /v1/admin/installations : `{ installations: [...], mois }`. */
export function lireListeInstallations(
  statut: number | null,
  corps: unknown,
): { ok: true; installations: Installation[] } | { ok: false; raison: EchecAdmin } {
  if (statut !== 200) return { ok: false, raison: echecAdmin(statut) };
  if (!objet(corps) || !Array.isArray(corps.installations)) return { ok: false, raison: 'inattendu' };
  const installations = corps.installations.map(lireInstallation).filter((i): i is Installation => i !== null);
  return { ok: true, installations };
}

/** Réponse de POST /v1/admin/installations : `{ installation, jeton }` (le jeton n'est donné qu'une fois). */
export function lireCreationInstallation(
  statut: number | null,
  corps: unknown,
): { ok: true; installation: Installation; jeton: string } | { ok: false; raison: EchecAdmin } {
  if (statut !== 201) return { ok: false, raison: echecAdmin(statut) };
  if (!objet(corps)) return { ok: false, raison: 'inattendu' };
  const installation = lireInstallation(corps.installation);
  const jeton = typeof corps.jeton === 'string' ? corps.jeton.trim() : '';
  if (!installation || !jeton) return { ok: false, raison: 'inattendu' };
  return { ok: true, installation, jeton };
}

/** Réponse de DELETE /v1/admin/installations/{id}. */
export function lireRevocation(statut: number | null): { ok: true } | { ok: false; raison: EchecAdmin } {
  return statut === 200 ? { ok: true } : { ok: false, raison: echecAdmin(statut) };
}

/** Nom d'un nouveau téléphone : non vide, raccourci comme le fait le relais. null si vide. */
export function lireNomInstallation(saisie: string): string | null {
  const propre = saisie.trim().slice(0, settings.nomInstallationMax);
  return propre === '' ? null : propre;
}
