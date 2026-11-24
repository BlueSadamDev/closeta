import * as SecureStore from 'expo-secure-store';

import { lireGenreRecherche, type GenreRecherche } from '@/domain/genre';
import { settings } from '@/domain/settings';

/** Genre des recherches d'alternatives rangé sur le téléphone ; mixte s'il n'y en a pas. */
export async function lireGenre(): Promise<GenreRecherche> {
  return lireGenreRecherche(await SecureStore.getItemAsync(settings.genreRechercheKey).catch(() => null));
}

/** Range le genre ; mixte efface la valeur rangée (retour au réglage par défaut). */
export async function enregistrerGenre(genre: GenreRecherche): Promise<void> {
  if (genre === 'mixte') await SecureStore.deleteItemAsync(settings.genreRechercheKey);
  else await SecureStore.setItemAsync(settings.genreRechercheKey, genre);
}
