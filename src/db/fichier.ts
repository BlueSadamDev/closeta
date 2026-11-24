/**
 * Sauvegarde et restauration sur le téléphone (docs/SPEC.md, « Lot 3 », « Étape 11 ») :
 * lecture des photos, écriture du fichier, partage Android, choix d'un fichier, remplacement des données.
 * Le contenu du fichier est préparé et vérifié dans src/domain/sauvegarde.ts.
 *
 * Restauration, dans cet ordre, pour ne jamais rien perdre :
 * 1. les photos de la sauvegarde sont écrites dans un dossier à part ;
 * 2. la base est remplacée d'un seul bloc (si ça échoue, elle reste comme avant et le dossier à part est effacé) ;
 * 3. une marque « prête » est posée, puis les photos remplacent les anciennes.
 * Si l'app est interrompue pendant l'étape 3, elle la termine au démarrage suivant (terminerRestauration).
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { nomDuFichier } from '@/domain/cheminPhoto';
import { construireSauvegarde, ecrireSauvegarde, lireSauvegarde, nomDeSauvegarde, type Lecture, type Sauvegarde } from '@/domain/sauvegarde';
import { settings } from '@/domain/settings';
import { dossierImages } from '@/relay/image';

import { lireTout, remplacerTout, type BaseSauvegarde } from './sauvegarde';

const MARQUE_PRETE = '.prete';
const dossierRestauration = () => new Directory(Paths.document, settings.sauvegarde.dossierRestauration);

export type ResultatSauvegarde = 'partagee' | 'partage_indisponible' | 'echec';

/** Prépare le fichier de sauvegarde et le propose au partage Android (Drive, mail, fichiers…). */
export async function sauvegarder(db: BaseSauvegarde, maintenant: Date = new Date()): Promise<ResultatSauvegarde> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'partage_indisponible';
    const { articles, releves } = await lireTout(db);
    const photos: Record<string, string> = {};
    for (const a of articles) {
      if (!a.imageLocale) continue;
      try {
        const fichier = new File(a.imageLocale);
        if (fichier.exists) photos[nomDuFichier(a.imageLocale)] = await fichier.base64();
      } catch {
        // Photo illisible : la pièce est sauvegardée sans photo locale.
      }
    }
    const texte = ecrireSauvegarde(construireSauvegarde({ articles, releves, photos, maintenant }));
    const fichier = new File(Paths.cache, nomDeSauvegarde(maintenant));
    if (fichier.exists) fichier.delete();
    fichier.create();
    await fichier.write(texte);
    await Sharing.shareAsync(fichier.uri, { mimeType: settings.sauvegarde.typeMime });
    return 'partagee';
  } catch {
    return 'echec';
  }
}

/** Ouvre le sélecteur de fichiers d'Android, lit et vérifie le fichier choisi. null si rien n'est choisi. */
export async function choisirSauvegarde(): Promise<Lecture | null> {
  let fichier: File;
  try {
    const choix = await File.pickFileAsync({ mimeTypes: '*/*' });
    if (choix.canceled) return null;
    fichier = choix.result;
  } catch {
    return null;
  }
  try {
    return lireSauvegarde(await fichier.text());
  } catch {
    return { ok: false, raison: 'illisible' };
  }
}

/** Remplace toutes les données du téléphone par la sauvegarde (déjà vérifiée). Renvoie false si rien n'a changé. */
export async function remplacerParSauvegarde(db: BaseSauvegarde, s: Sauvegarde): Promise<boolean> {
  const attente = dossierRestauration();
  try {
    if (attente.exists) attente.delete();
    attente.create({ intermediates: true });
    for (const [nom, contenu] of Object.entries(s.photos)) {
      const photo = new File(attente, nom);
      photo.create();
      await photo.write(contenu, { encoding: 'base64' });
    }
    await remplacerTout(db, s.articles, s.releves);
  } catch {
    try {
      if (attente.exists) attente.delete();
    } catch {
      // Le dossier à part sera effacé au prochain démarrage.
    }
    return false;
  }
  new File(attente, MARQUE_PRETE).create();
  terminerRestauration();
  return true;
}

/**
 * Au démarrage (et à la fin d'une restauration) : si une restauration est prête, ses photos remplacent
 * les anciennes ; un dossier à part sans marque (restauration interrompue avant le remplacement de la base) est effacé.
 */
export function terminerRestauration(): void {
  try {
    const attente = dossierRestauration();
    if (!attente.exists) return;
    if (!new File(attente, MARQUE_PRETE).exists) {
      attente.delete();
      return;
    }
    const images = dossierImages();
    if (images.exists) images.delete();
    images.create({ intermediates: true });
    for (const element of attente.list()) {
      if (element instanceof File && element.name !== MARQUE_PRETE) element.moveSync(images);
    }
    attente.delete();
  } catch {
    // Réessayé au prochain démarrage : la marque reste tant que le dossier à part existe.
  }
}
