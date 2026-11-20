/**
 * Copie sur le téléphone de la photo d'une pièce (docs/SPEC.md : « images copiées dans le stockage de l'app »).
 * Le téléchargement est un appel réseau : il vit donc ici, avec le client du relais.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { settings } from '@/domain/settings';

const dossierImages = () => new Directory(Paths.document, settings.imagesDirectory);

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
 * Efface la copie locale de l'image d'un article (sans effet s'il n'y en a pas).
 * On passe par l'identifiant : une copie arrivée après le délai est effacée elle aussi.
 */
export function effacerImage(idArticle: string): void {
  try {
    const fichier = new File(dossierImages(), idArticle);
    if (fichier.exists) fichier.delete();
  } catch {
    // Une image déjà absente ne doit pas empêcher la suppression de la pièce.
  }
}
