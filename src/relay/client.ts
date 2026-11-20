/**
 * Client du relais : seul endroit de l'app qui fait des appels réseau.
 */
import { lireExtraction, type ResultatExtraction } from '@/domain/lien';
import { lireTestConnexion, type EtatConnexion } from '@/domain/relais';
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
