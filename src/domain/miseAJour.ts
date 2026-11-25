/**
 * Vérification de mise à jour (docs/SPEC.md, « Lot 4 », « Étape 7 ») : comparaison des versions,
 * lecture de la réponse du relais (GET /v1/version) et rythme des vérifications (au plus une par jour).
 * Logique pure : le réseau et le coffre du téléphone sont dans src/relay/.
 */
import { settings } from './settings';

/** « 1.2.0 » → [1, 2, 0] ; null si ce n'est pas une version X.Y.Z. */
function lireVersion(texte: string | null | undefined): number[] | null {
  const propre = (texte ?? '').trim();
  return /^\d+\.\d+\.\d+$/.test(propre) ? propre.split('.').map(Number) : null;
}

/** Vrai si `derniere` est strictement plus récente que `installee` ; faux si l'une est illisible. */
export function versionPlusRecente(installee: string | null | undefined, derniere: string | null | undefined): boolean {
  const a = lireVersion(installee);
  const b = lireVersion(derniere);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] > a[i];
  return false;
}

/** Dernière version publiée, avec l'adresse de sa release (page GitHub, ouverte dans le navigateur). */
export type VersionPubliee = { derniere: string; url: string };

const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Réponse de GET /v1/version ; null si le relais ne répond pas, ne connaît aucune version ou répond mal. */
export function lireVersionPubliee(statut: number | null, corps: unknown): VersionPubliee | null {
  if (statut !== 200 || !objet(corps)) return null;
  const { derniere, url } = corps;
  if (typeof derniere !== 'string' || !lireVersion(derniere)) return null;
  if (typeof url !== 'string' || !url.startsWith('https://github.com/')) return null;
  return { derniere, url };
}

/** Ce que le téléphone garde entre deux vérifications (coffre du téléphone). */
export type EtatMiseAJour = {
  /** Date de la dernière vérification réussie (ISO). */
  verifieLe: string | null;
  derniere: string | null;
  url: string | null;
  /** Version dont l'annonce a été masquée (croix du bandeau) : elle ne revient qu'avec la suivante. */
  masquee: string | null;
};

export const ETAT_VIDE: EtatMiseAJour = { verifieLe: null, derniere: null, url: null, masquee: null };

const texteOuNull = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);

/** Relit l'état gardé ; un texte absent ou illisible donne l'état vide. */
export function lireEtatMiseAJour(texte: string | null | undefined): EtatMiseAJour {
  if (!texte) return ETAT_VIDE;
  try {
    const e: unknown = JSON.parse(texte);
    if (!objet(e)) return ETAT_VIDE;
    return { verifieLe: texteOuNull(e.verifieLe), derniere: texteOuNull(e.derniere), url: texteOuNull(e.url), masquee: texteOuNull(e.masquee) };
  } catch {
    return ETAT_VIDE;
  }
}

/** Vrai s'il faut interroger le relais : jamais vérifié, ou dernière vérification il y a 24 h ou plus. */
export function aVerifier(etat: EtatMiseAJour, maintenant: Date): boolean {
  if (!etat.verifieLe) return true;
  const depuis = maintenant.getTime() - new Date(etat.verifieLe).getTime();
  // Date illisible ou dans le futur (horloge du téléphone changée) : on revérifie.
  return !Number.isFinite(depuis) || depuis < 0 || depuis >= settings.delaiVerificationMiseAJourMs;
}

/** État après une vérification réussie (la version masquée est gardée). */
export function apresVerification(etat: EtatMiseAJour, lue: VersionPubliee, maintenant: Date): EtatMiseAJour {
  return { ...etat, verifieLe: maintenant.toISOString(), derniere: lue.derniere, url: lue.url };
}

/**
 * Nouvelle version à proposer : plus récente que la version installée et, pour le bandeau, pas masquée.
 * `avecMasquee` : vrai pour les Réglages, qui l'indiquent même après la croix du bandeau.
 */
export function versionAProposer(
  etat: EtatMiseAJour,
  installee: string | null | undefined,
  avecMasquee = false,
): VersionPubliee | null {
  if (!etat.derniere || !etat.url || !versionPlusRecente(installee, etat.derniere)) return null;
  if (!avecMasquee && etat.masquee === etat.derniere) return null;
  return { derniere: etat.derniere, url: etat.url };
}
