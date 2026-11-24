/**
 * Client du relais : seul endroit de l'app qui fait des appels réseau.
 */
import { File, UploadType } from 'expo-file-system';

import { demandeAlternatives, lireAlternatives, type ResultatAlternatives } from '@/domain/alternatives';
import type { Article } from '@/domain/article';
import { lireExtraction, type ResultatExtraction } from '@/domain/lien';
import { lireIdentification, type ResultatIdentification } from '@/domain/photo';
import { adresseRelais, entetesRelais, lireQuota, lireTestConnexion, type EtatConnexion, type Quota } from '@/domain/relais';
import { settings } from '@/domain/settings';

import { identite } from './installation';

/** Adresse complète d'une route du relais (« /extract » → « …/v1/extract »). */
const adresse = (route: string) => adresseRelais(settings.relayUrl, route);

/** Envoie au relais une demande vide pour vérifier que le jeton est accepté. */
export async function testerConnexion(jeton: string): Promise<EtatConnexion> {
  if (!jeton) return 'jeton_absent';
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(adresse('/extract'), {
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
    const reponse = await fetch(adresse('/quota'), {
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

/**
 * Demande au relais de lire la page d'une boutique (nom, marque, image, prix, disponibilité).
 * `taille` : taille de la pièce, pour sa disponibilité. Ne lève jamais d'exception.
 */
export async function extraire(lien: string, jeton: string, taille: string | null = null): Promise<ResultatExtraction> {
  if (!jeton) return { ok: false, raison: 'jeton_absent' };
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(adresse('/extract'), {
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
    const envoi = new File(photo).createUploadTask(adresse('/identify'), {
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
    const reponse = await fetch(adresse('/alternatives'), {
      method: 'POST',
      headers: entetesRelais(await identite(jeton), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(demandeAlternatives(article, photo)),
      signal: arret.signal,
    });
    return lireAlternatives(reponse.status, await reponse.json().catch(() => null));
  } catch {
    return lireAlternatives(null, null);
  } finally {
    clearTimeout(minuteur);
  }
}
