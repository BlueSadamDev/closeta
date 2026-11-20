import * as SecureStore from 'expo-secure-store';

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
