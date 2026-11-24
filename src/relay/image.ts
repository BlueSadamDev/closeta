/**
 * Copie sur le téléphone de la photo d'une pièce (docs/SPEC.md : « images copiées dans le stockage de l'app »).
 * Le téléchargement est un appel réseau : il vit donc ici, avec le client du relais,
 * comme le reste de la gestion du dossier des photos.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { settings } from '@/domain/settings';

/** Dossier des photos des pièces ; la base n'y garde que les noms de fichier (domain/cheminPhoto). */
export const dossierImages = () => new Directory(Paths.document, settings.imagesDirectory);

/**
 * Télécharge l'image et renvoie son chemin local, ou null si la copie échoue ou prend trop de temps.
 * L'article garde alors seulement l'adresse de l'image d'origine.
 */
export async function copierImage(source: string, idArticle: string): Promise<string | null> {
  try {
    const dossier = dossierImages();
    if (!dossier.exists) dossier.create({ intermediates: true });
    const destination = new File(dossier, idArticle);
    if (destination.exists) destination.delete();
    const delai = new Promise<null>((resoudre) => setTimeout(() => resoudre(null), settings.imageDownloadTimeoutMs));
    const fichier = await Promise.race([File.downloadFileAsync(source, destination), delai]);
    return fichier ? fichier.uri : null;
  } catch {
    return null;
  }
}

/**
 * Range dans le stockage de l'app la photo prise par l'utilisateur.
 * `nomFichier` : l'identifiant de l'article, suivi d'un suffixe quand la photo en remplace une autre
 * (un nouveau nom évite que le téléphone affiche l'ancienne photo gardée en mémoire).
 * Renvoie son chemin, ou null si la copie échoue.
 */
export async function rangerPhoto(source: string, nomFichier: string): Promise<string | null> {
  try {
    const dossier = dossierImages();
    if (!dossier.exists) dossier.create({ intermediates: true });
    const destination = new File(dossier, nomFichier);
    if (destination.exists) destination.delete();
    await new File(source).copy(destination);
    return destination.uri;
  } catch {
    return null;
  }
}

/**
 * Efface la copie locale de l'image d'un article (sans effet s'il n'y en a pas).
 * On passe par l'identifiant : une copie arrivée après le délai est effacée elle aussi ;
 * et par le chemin enregistré, pour une photo remplacée (rangée sous un autre nom).
 */
export function effacerImage(idArticle: string, imageLocale?: string | null): void {
  try {
    const fichier = new File(dossierImages(), idArticle);
    if (fichier.exists) fichier.delete();
  } catch {
    // Une image déjà absente ne doit pas empêcher la suppression de la pièce.
  }
  if (imageLocale) effacerFichier(imageLocale);
}

/** Efface une photo rangée dans le dossier des photos de l'app (jamais ailleurs). */
export function effacerFichier(uri: string): void {
  try {
    const fichier = new File(uri);
    if (fichier.uri.startsWith(dossierImages().uri) && fichier.exists) fichier.delete();
  } catch {
    // Photo déjà absente : rien à faire.
  }
}
