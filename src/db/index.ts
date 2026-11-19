import type { SQLiteDatabase } from 'expo-sqlite';

import { migrer } from './migrate';

/**
 * Préparation de la base au démarrage de l'app (appelée par SQLiteProvider) :
 * mode d'écriture plus sûr et plus rapide (WAL), puis migrations.
 */
export async function preparerBase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await migrer(db);
}
