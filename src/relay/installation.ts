/**
 * Identifiant d'installation : un UUID créé au premier lancement, rangé dans le coffre du téléphone.
 * Envoyé au relais avec chaque demande (X-ClosetA-Installation), avec la version de l'app.
 */
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { identifiantInstallationValide, type Identite } from '@/domain/relais';
import { settings } from '@/domain/settings';

let enCours: Promise<string | null> | null = null;

async function lireOuCreer(): Promise<string | null> {
  const existant = await SecureStore.getItemAsync(settings.installationKey);
  if (identifiantInstallationValide(existant)) return existant;
  const nouveau = randomUUID();
  await SecureStore.setItemAsync(settings.installationKey, nouveau);
  return nouveau;
}

/** Identifiant de ce téléphone, créé s'il n'existe pas encore. Null si le coffre est inaccessible. */
export function identifiantInstallation(): Promise<string | null> {
  enCours ??= lireOuCreer().catch(() => {
    enCours = null;
    return null;
  });
  return enCours;
}

/** Version de l'app (app.json), envoyée au relais. */
export const versionApp = (): string | null => Constants.expoConfig?.version ?? null;

/** Jeton, identifiant d'installation et version : ce qui accompagne chaque demande au relais. */
export async function identite(jeton: string): Promise<Identite> {
  return { jeton, installation: await identifiantInstallation(), version: versionApp() };
}
