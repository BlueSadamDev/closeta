/**
 * Client du relais : seul endroit de l'app qui fait des appels réseau.
 */
import { File, UploadType } from 'expo-file-system';

import { lireExtraction, type ResultatExtraction } from '@/domain/lien';
import { lireIdentification, type ResultatIdentification } from '@/domain/photo';
import { lireQuota, lireTestConnexion, type EtatConnexion, type Quota } from '@/domain/relais';
import { settings } from '@/domain/settings';

/** Envoie au relais une demande vide pour vérifier que le jeton est accepté. */
export async function testerConnexion(jeton: string): Promise<EtatConnexion> {
  if (!jeton) return 'jeton_absent';
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(`${settings.relayUrl}/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
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
    const reponse = await fetch(`${settings.relayUrl}/quota`, {
      headers: { Authorization: `Bearer ${jeton}` },
      signal: arret.signal,
    });
    return lireQuota(reponse.status, await reponse.json().catch(() => null));
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Demande au relais de lire la page d'une boutique (nom, marque, image, prix). Ne lève jamais d'exception. */
export async function extraire(lien: string, jeton: string): Promise<ResultatExtraction> {
  if (!jeton) return { ok: false, raison: 'jeton_absent' };
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), settings.relayTimeoutMs);
  try {
    const reponse = await fetch(`${settings.relayUrl}/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: lien }),
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
    const envoi = new File(photo).createUploadTask(`${settings.relayUrl}/identify`, {
      httpMethod: 'POST',
      uploadType: UploadType.BINARY_CONTENT,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'image/jpeg' },
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
