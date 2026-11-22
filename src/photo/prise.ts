/**
 * Prise de la photo (appareil photo ou galerie) et réduction avant l'envoi au relais.
 * La galerie passe par le sélecteur de photos d'Android : aucune permission demandée.
 * L'appareil photo demande la permission CAMERA au premier usage.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { reduction } from '@/domain/photo';
import { settings } from '@/domain/settings';

export type SourcePhoto = 'camera' | 'galerie';

export type Prise = { ok: true; uri: string } | { ok: false; raison: 'annule' | 'camera_refusee' | 'illisible' };

/** Ouvre l'appareil photo ou la galerie, puis renvoie la photo réduite (JPEG, 1024 px au plus). */
export async function prendrePhoto(source: SourcePhoto): Promise<Prise> {
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { ok: false, raison: 'camera_refusee' };
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
    const choix =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const photo = choix.canceled ? undefined : choix.assets[0];
    if (!photo) return { ok: false, raison: 'annule' };

    const travail = ImageManipulator.manipulate(photo.uri);
    const taille = reduction(photo.width, photo.height, settings.photoMaxDimension);
    if (taille) travail.resize(taille);
    const image = await travail.renderAsync();
    const reduite = await image.saveAsync({ format: SaveFormat.JPEG, compress: settings.photoCompression });
    return { ok: true, uri: reduite.uri };
  } catch {
    return { ok: false, raison: 'illisible' };
  }
}
