import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { BaseArticles } from '../articles';
import type { BaseMigrable } from '../migrate';

/** Base SQLite en mémoire qui imite l'interface d'expo-sqlite, pour les tests. */
export function baseDeTest(): BaseMigrable & BaseArticles & { brute: DatabaseSync } {
  const brute = new DatabaseSync(':memory:');
  return {
    brute,
    execAsync: async (sql) => {
      brute.exec(sql);
    },
    runAsync: async (sql, params) => brute.prepare(sql).run(...(params as SQLInputValue[])),
    getAllAsync: async <T,>(sql: string, params: (string | number | null)[] = []) =>
      brute.prepare(sql).all(...(params as SQLInputValue[])) as T[],
    getFirstAsync: async <T,>(sql: string, params: (string | number | null)[] = []) =>
      (brute.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined) ?? null,
  };
}
