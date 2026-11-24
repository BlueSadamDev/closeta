import type { SQLiteDatabase } from 'expo-sqlite';

import { definirDossierPhotos } from '@/domain/cheminPhoto';
import { dossierImages } from '@/relay/image';

import { terminerRestauration } from './fichier';
import { migrer } from './migrate';

/**
 * Préparation de la base au démarrage de l'app (appelée par SQLiteProvider) :
 * dossier des photos de ce téléphone (la base n'y garde que les noms), fin d'une restauration interrompue,
 * mode d'écriture plus sûr et plus rapide (WAL), puis migrations.
 */
export async function preparerBase(db: SQLiteDatabase): Promise<void> {
  definirDossierPhotos(dossierImages().uri);
  terminerRestauration();
  await db.execAsync('PRAGMA journal_mode = WAL');
  await migrer(db);
}
