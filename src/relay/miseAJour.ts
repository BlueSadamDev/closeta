/**
 * Vérification de mise à jour (docs/SPEC.md, « Lot 4 », « Étape 7 ») : au plus une demande par jour
 * au relais ; l'état (date de vérification, dernière version, version masquée) est rangé dans le coffre.
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import {
  apresVerification,
  aVerifier,
  lireEtatMiseAJour,
  versionAProposer,
  type EtatMiseAJour,
  type VersionPubliee,
} from '@/domain/miseAJour';
import { settings } from '@/domain/settings';

import { lireVersionPubliee } from './client';
import { lireJeton } from './jeton';

const versionInstallee = () => Constants.expoConfig?.version ?? null;

async function lireEtat(): Promise<EtatMiseAJour> {
  return lireEtatMiseAJour(await SecureStore.getItemAsync(settings.miseAJourKey).catch(() => null));
}

async function enregistrerEtat(etat: EtatMiseAJour): Promise<void> {
  await SecureStore.setItemAsync(settings.miseAJourKey, JSON.stringify(etat)).catch(() => undefined);
}

/**
 * Nouvelle version à annoncer dans le bandeau, ou null. Interroge le relais seulement si la dernière
 * vérification réussie date de 24 h ou plus ; sinon, se contente de l'état gardé. Ne lève jamais d'exception.
 */
export async function verifierMiseAJour(maintenant: Date = new Date()): Promise<VersionPubliee | null> {
  let etat = await lireEtat();
  if (aVerifier(etat, maintenant)) {
    const jeton = await lireJeton().catch(() => '');
    const lue = jeton ? await lireVersionPubliee(jeton) : null;
    if (lue) {
      etat = apresVerification(etat, lue, maintenant);
      await enregistrerEtat(etat);
    }
  }
  return versionAProposer(etat, versionInstallee());
}

/** Nouvelle version connue, pour les Réglages (même après la croix du bandeau). Sans appel au relais. */
export async function versionDisponible(): Promise<VersionPubliee | null> {
  return versionAProposer(await lireEtat(), versionInstallee(), true);
}

/** Croix du bandeau : cette version n'est plus annoncée ; la suivante le sera. */
export async function masquerMiseAJour(version: string): Promise<void> {
  await enregistrerEtat({ ...(await lireEtat()), masquee: version });
}
