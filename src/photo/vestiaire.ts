/**
 * Photos du Vestiaire : format portrait 3:4, 1200 × 1600 px (docs/SPEC.md, « Lot 3 », « Étape 7 »).
 * La photo gardée sur le téléphone est en 1200 × 1600 ; le relais reçoit une copie réduite (1024 px au plus).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { recadrage34, reduction } from '@/domain/photo';
import { settings } from '@/domain/settings';

import type { Prise } from './prise';

/**
 * Recadre la photo au format 3:4 (centrée, moins la marge du cadre de la prise de vue),
 * puis la met en 1200 × 1600 px, JPEG.
 */
export async function recadrerPourVestiaire(uri: string, largeur: number, hauteur: number, marge: number): Promise<Prise> {
  try {
    const rect = recadrage34(largeur, hauteur, marge);
    if (!rect) return { ok: false, raison: 'illisible' };
    const image = await ImageManipulator.manipulate(uri)
      .crop(rect)
      .resize({ width: settings.photoVestiaire.largeur, height: settings.photoVestiaire.hauteur })
      .renderAsync();
    const finale = await image.saveAsync({ format: SaveFormat.JPEG, compress: settings.photoVestiaireCompression });
    return { ok: true, uri: finale.uri };
  } catch {
    return { ok: false, raison: 'illisible' };
  }
}

/**
 * Galerie : le sélecteur de photos d'Android, puis son outil de recadrage, cadre réglable bloqué en 3:4.
 * Aucune permission demandée.
 */
export async function choisirPourVestiaire(): Promise<Prise> {
  try {
    const choix = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
      exif: false,
    });
    const photo = choix.canceled ? undefined : choix.assets[0];
    if (!photo) return { ok: false, raison: 'annule' };
    return recadrerPourVestiaire(photo.uri, photo.width, photo.height, 0);
  } catch {
    return { ok: false, raison: 'illisible' };
  }
}

/** Copie réduite (1024 px au plus, JPEG) à envoyer au relais /identify ; la photo d'origine est gardée. */
export async function copiePourRelais(uri: string): Promise<string> {
  try {
    const image = await ImageManipulator.manipulate(uri).renderAsync();
    const taille = reduction(image.width, image.height, settings.photoMaxDimension);
    const finale = taille ? await ImageManipulator.manipulate(image).resize(taille).renderAsync() : image;
    const enregistree = await finale.saveAsync({ format: SaveFormat.JPEG, compress: settings.photoCompression });
    return enregistree.uri;
  } catch {
    return uri;
  }
}
