import * as SecureStore from 'expo-secure-store';

import { adresseEnVigueur, lireAdresseRelais } from '@/domain/configuration';
import { settings } from '@/domain/settings';

/** Jeton du relais rangé dans le coffre du téléphone ; chaîne vide s'il n'y en a pas. */
export async function lireJeton(): Promise<string> {
  return (await SecureStore.getItemAsync(settings.relayTokenKey)) ?? '';
}

/** Range le jeton dans le coffre ; un jeton vide l'efface. */
export async function enregistrerJeton(jeton: string): Promise<void> {
  if (jeton) await SecureStore.setItemAsync(settings.relayTokenKey, jeton);
  else await SecureStore.deleteItemAsync(settings.relayTokenKey);
}

/** Adresse du relais : celle rangée sur le téléphone, sinon celle de settings.ts. */
export async function lireAdresse(): Promise<string> {
  return adresseEnVigueur(await SecureStore.getItemAsync(settings.relayUrlKey).catch(() => null));
}

/**
 * Range l'adresse du relais. L'adresse par défaut (ou une saisie vide) efface la valeur rangée :
 * le téléphone suit alors settings.ts. Une adresse non https est refusée (false).
 */
export async function enregistrerAdresse(saisie: string): Promise<boolean> {
  if (saisie.trim() === '') {
    await SecureStore.deleteItemAsync(settings.relayUrlKey);
    return true;
  }
  const lue = lireAdresseRelais(saisie);
  if (!lue.ok) return false;
  if (lue.adresse === settings.relayUrl) await SecureStore.deleteItemAsync(settings.relayUrlKey);
  else await SecureStore.setItemAsync(settings.relayUrlKey, lue.adresse);
  return true;
}

/** Jeton d'administration rangé dans le coffre ; chaîne vide s'il n'y en a pas. */
export async function lireJetonAdmin(): Promise<string> {
  return (await SecureStore.getItemAsync(settings.adminTokenKey)) ?? '';
}

/** Range le jeton d'administration ; un jeton vide l'efface (la section « Installations » disparaît). */
export async function enregistrerJetonAdmin(jeton: string): Promise<void> {
  if (jeton) await SecureStore.setItemAsync(settings.adminTokenKey, jeton);
  else await SecureStore.deleteItemAsync(settings.adminTokenKey);
}
