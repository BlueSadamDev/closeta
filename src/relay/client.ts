/**
 * Client du relais : seul endroit de l'app qui fait des appels réseau.
 */
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
