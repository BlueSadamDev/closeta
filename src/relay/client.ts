/**
 * Client du relais : seul endroit de l'app qui fait des appels réseau.
 */
import { File, UploadType } from 'expo-file-system';

import { demandeAlternatives, lireAlternatives, type ResultatAlternatives } from '@/domain/alternatives';
import { genrePourRelais } from '@/domain/genre';
import type { Article } from '@/domain/article';
import { lireExtraction, type ResultatExtraction } from '@/domain/lien';
import { lireVersionPubliee as lireReponseVersion, type VersionPubliee } from '@/domain/miseAJour';
import { lireIdentification, type ResultatIdentification } from '@/domain/photo';
import {
  lireCreationInstallation,
  lireListeInstallations,
  lireRevocation,
  type EchecAdmin,
  type Installation,
} from '@/domain/configuration';
import {
  lireAnnulationInvitation,
  lireCreationInvitation,
  lireListeInvitations,
  lireUtilisationInvitation,
  type EchecUtilisation,
  type InvitationEnAttente,
} from '@/domain/invitation';
import { adresseRelais, entetesRelais, lireQuota, lireTestConnexion, type EtatConnexion, type Quota } from '@/domain/relais';
import { settings } from '@/domain/settings';

import { lireGenre } from './genre';
import { identite } from './installation';
import { lireAdresse } from './jeton';

/**
 * Adresse complète d'une route du relais (« /extract » → « …/v1/extract »).
 * `base` : adresse du relais à utiliser ; par défaut celle rangée sur le téléphone (ou celle de settings.ts).
 */
const adresse = async (route: string, base?: string) => adresseRelais(base ?? (await lireAdresse()), route);

/**
 * Envoie au relais une demande vide pour vérifier que le jeton est accepté.
 * `base` : adresse à tester (celle saisie dans les Réglages) ; par défaut celle rangée.
 */
export async function testerConnexion(jeton: string, base?: string): Promise<EtatConnexion> {
  if (!jeton) return 'jeton_absent';
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(await adresse('/extract', base), {
      method: 'POST',
      headers: entetesRelais(await identite(jeton), { 'Content-Type': 'application/json' }),
      body: '{}',
      signal: arret.signal,
    });
    const corps: unknown = await reponse.json().catch(() => null);
    return lireTestConnexion(reponse.status, corps);
  } catch {
    return lireTestConnexion(null, null);
  } finally {
    clearTimeout(minuteur);
  }
}

/** Recherches SerpApi du mois. Ne lève jamais d'exception : null si le relais ne répond pas. */
export async function lireQuotaRelais(jeton: string): Promise<Quota | null> {
  if (!jeton) return null;
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(await adresse('/quota'), {
      headers: entetesRelais(await identite(jeton)),
      signal: arret.signal,
    });
    return lireQuota(reponse.status, await reponse.json().catch(() => null));
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Dernière version publiée en release (GET /v1/version). Ne lève jamais d'exception : null si rien à lire. */
export async function lireVersionPubliee(jeton: string): Promise<VersionPubliee | null> {
  if (!jeton) return null;
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(await adresse('/version'), {
      headers: entetesRelais(await identite(jeton)),
      signal: arret.signal,
    });
    return lireReponseVersion(reponse.status, await reponse.json().catch(() => null));
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Demande au relais de lire la page d'une boutique (nom, marque, image, prix, disponibilité).
 * `taille` : taille de la pièce, pour sa disponibilité. Ne lève jamais d'exception.
 */
export async function extraire(lien: string, jeton: string, taille: string | null = null): Promise<ResultatExtraction> {
  if (!jeton) return { ok: false, raison: 'jeton_absent' };
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(await adresse('/extract'), {
      method: 'POST',
      headers: entetesRelais(await identite(jeton), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(taille ? { url: lien, taille } : { url: lien }),
      signal: arret.signal,
    });
    const corps: unknown = await reponse.json().catch(() => null);
    return lireExtraction(reponse.status, corps, lien);
  } catch {
    return lireExtraction(null, null, lien);
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Envoie la photo (JPEG déjà réduite, sur le téléphone) au relais /identify.
 * Ne lève jamais d'exception : un échec est renvoyé comme résultat.
 */
export async function identifier(photo: string, jeton: string): Promise<ResultatIdentification> {
  if (!jeton) return { ok: false, raison: 'jeton_absent' };
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  try {
    const genre = genrePourRelais(await lireGenre());
    const route = genre ? `/identify?genre=${genre}` : '/identify';
    const envoi = new File(photo).createUploadTask(await adresse(route), {
      httpMethod: 'POST',
      uploadType: UploadType.BINARY_CONTENT,
      headers: entetesRelais(await identite(jeton), { 'Content-Type': 'image/jpeg' }),
    });
    minuteur = setTimeout(() => envoi.cancel(), settings.identifyTimeoutMs);
    const reponse = await envoi.uploadAsync();
    let corps: unknown = null;
    try {
      corps = JSON.parse(reponse.body);
    } catch {
      corps = null;
    }
    return lireIdentification(reponse.status, corps);
  } catch {
    return lireIdentification(null, null);
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Demande au relais /alternatives des pièces qui ressemblent à `article`.
 * `photo` : la photo du téléphone en base64 (JPEG), utile seulement si la pièce n'a pas d'image de boutique.
 * Ne lève jamais d'exception : un échec est renvoyé comme résultat.
 */
export async function chercherAlternatives(article: Article, photo: string | null, jeton: string): Promise<ResultatAlternatives> {
  if (!jeton) return { ok: false, raison: 'jeton_absent' };
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.alternativesTimeoutMs);
  try {
    const reponse = await fetch(await adresse('/alternatives'), {
      method: 'POST',
      headers: entetesRelais(await identite(jeton), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(demandeAlternatives(article, photo, await lireGenre())),
      signal: arret.signal,
    });
    return lireAlternatives(reponse.status, await reponse.json().catch(() => null));
  } catch {
    return lireAlternatives(null, null);
  } finally {
    clearTimeout(minuteur);
  }
}

/* ---------- Administration (section « Installations » des Réglages, jeton d'administration) ---------- */

/** Demande d'administration ; renvoie le statut et le corps, ou null si le relais ne répond pas. */
async function demandeAdmin(
  jetonAdmin: string,
  methode: 'GET' | 'POST' | 'DELETE',
  route: string,
  corps?: unknown,
): Promise<{ statut: number; corps: unknown } | null> {
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(await adresse(route), {
      method: methode,
      headers: entetesRelais(
        await identite(jetonAdmin),
        corps === undefined ? {} : { 'Content-Type': 'application/json' },
      ),
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: arret.signal,
    });
    return { statut: reponse.status, corps: await reponse.json().catch(() => null) };
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

type Echec = { ok: false; raison: EchecAdmin };

/** Liste des installations du relais, avec les recherches du mois de chacune. Ne lève jamais d'exception. */
export async function listerInstallations(jetonAdmin: string): Promise<{ ok: true; installations: Installation[] } | Echec> {
  if (!jetonAdmin) return { ok: false, raison: 'jeton_absent' };
  const r = await demandeAdmin(jetonAdmin, 'GET', '/admin/installations');
  return lireListeInstallations(r?.statut ?? null, r?.corps ?? null);
}

/** Crée l'installation d'un nouveau téléphone ; son jeton n'est donné qu'ici. Ne lève jamais d'exception. */
export async function ajouterInstallation(
  jetonAdmin: string,
  nom: string,
): Promise<{ ok: true; installation: Installation; jeton: string } | Echec> {
  if (!jetonAdmin) return { ok: false, raison: 'jeton_absent' };
  const r = await demandeAdmin(jetonAdmin, 'POST', '/admin/installations', { nom });
  return lireCreationInstallation(r?.statut ?? null, r?.corps ?? null);
}

/** Révoque une installation : son jeton est refusé en moins d'une minute. Ne lève jamais d'exception. */
export async function revoquerInstallation(jetonAdmin: string, id: string): Promise<{ ok: true } | Echec> {
  if (!jetonAdmin) return { ok: false, raison: 'jeton_absent' };
  const r = await demandeAdmin(jetonAdmin, 'DELETE', `/admin/installations/${encodeURIComponent(id)}`);
  return lireRevocation(r?.statut ?? null);
}

/* ---------- Invitations (docs/SPEC.md, « Lot 4 », « Étape 6 ») ---------- */

/** Invitations en attente (nom, expiration) ; le relais ne garde pas les codes. Ne lève jamais d'exception. */
export async function listerInvitations(jetonAdmin: string): Promise<{ ok: true; invitations: InvitationEnAttente[] } | Echec> {
  if (!jetonAdmin) return { ok: false, raison: 'jeton_absent' };
  const r = await demandeAdmin(jetonAdmin, 'GET', '/admin/invitations');
  return lireListeInvitations(r?.statut ?? null, r?.corps ?? null);
}

/** Crée une invitation ; son code n'est donné qu'ici, une seule fois. Ne lève jamais d'exception. */
export async function inviter(
  jetonAdmin: string,
  nom: string,
): Promise<{ ok: true; invitation: InvitationEnAttente; code: string } | Echec> {
  if (!jetonAdmin) return { ok: false, raison: 'jeton_absent' };
  const r = await demandeAdmin(jetonAdmin, 'POST', '/admin/invitations', { nom });
  return lireCreationInvitation(r?.statut ?? null, r?.corps ?? null);
}

/** Annule une invitation en attente : son code ne fonctionne plus. Ne lève jamais d'exception. */
export async function annulerInvitation(jetonAdmin: string, id: string): Promise<{ ok: true } | Echec> {
  if (!jetonAdmin) return { ok: false, raison: 'jeton_absent' };
  const r = await demandeAdmin(jetonAdmin, 'DELETE', `/admin/invitations/${encodeURIComponent(id)}`);
  return lireAnnulationInvitation(r?.statut ?? null);
}

/**
 * Utilise un code d'invitation auprès du relais `relais` : sans jeton, et sans l'identifiant de ce
 * téléphone (le relais crée lui-même l'installation). Renvoie le jeton, donné une seule fois.
 * Ne lève jamais d'exception.
 */
export async function utiliserInvitation(
  relais: string,
  code: string,
): Promise<{ ok: true; jeton: string } | { ok: false; raison: EchecUtilisation }> {
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(adresseRelais(relais, '/invitations/utiliser'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: arret.signal,
    });
    return lireUtilisationInvitation(reponse.status, await reponse.json().catch(() => null));
  } catch {
    return lireUtilisationInvitation(null, null);
  } finally {
    clearTimeout(minuteur);
  }
}
