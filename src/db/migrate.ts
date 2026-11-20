import { MIGRATIONS, type Migration } from './migrations';

/**
 * Ce dont la mise à jour de la base a besoin. La base expo-sqlite de l'app le fournit ;
 * les tests utilisent une base SQLite en mémoire.
 */
export interface BaseMigrable {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
}

/** Numéro de la dernière migration appliquée (0 pour une base neuve). */
export async function versionDeLaBase(db: BaseMigrable): Promise<number> {
  const ligne = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return ligne?.user_version ?? 0;
}

/**
 * Applique, dans l'ordre, les migrations pas encore passées.
 * Chaque migration est faite d'un bloc : si elle échoue, la base reste dans l'état d'avant.
 * Renvoie la version finale de la base.
 */
export async function migrer(
  db: BaseMigrable,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  let version = await versionDeLaBase(db);

  for (const migration of migrations) {
    if (migration.version <= version) continue;
    await db.execAsync('BEGIN');
    try {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      await db.execAsync('COMMIT');
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw e;
    }
    version = migration.version;
  }

  return version;
}
