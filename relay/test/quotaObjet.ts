/// <reference types="node" />
/** Faux espace Durable Object pour les tests : un vrai `Quota`, sur une base SQLite en mémoire (Node). */
import { DatabaseSync } from 'node:sqlite';

import type { MagasinListable } from '../src/installations';
import { CLE_GLOBALE, type EspaceQuota, moisDe } from '../src/quota';
import { type EtatObjet, Quota } from '../src/quotaObjet';

/** Base SQLite en mémoire, avec la même forme d'appel que ctx.storage.sql de Cloudflare. */
export function baseSql() {
  const db = new DatabaseSync(':memory:');
  return {
    db,
    exec: (requete: string, ...valeurs: (string | number)[]) => {
      const lignes = db.prepare(requete).all(...valeurs) as Record<string, unknown>[];
      return { toArray: () => lignes };
    },
  };
}

/** État du Durable Object : comme chez Cloudflare, blockConcurrencyWhile met les autres demandes en attente. */
export function etatObjet(): EtatObjet & { sql: ReturnType<typeof baseSql> } {
  const sql = baseSql();
  let file: Promise<unknown> = Promise.resolve();
  return {
    sql,
    storage: { sql },
    blockConcurrencyWhile: <T>(action: () => Promise<T>) => {
      const suite = file.then(action);
      file = suite.catch(() => undefined);
      return suite;
    },
  };
}

/** Espace QUOTAS du Worker, avec un seul exemplaire de Quota, branché sur le faux KV. */
export function espaceQuota(kv: MagasinListable, maintenant?: () => Date) {
  const etat = etatObjet();
  const objet = new Quota(etat, { QUOTA: kv }, maintenant);
  const espace: EspaceQuota = { idFromName: (nom) => nom, get: () => objet };
  /** Recherches comptées ce mois dans une case (`global` par défaut). */
  const compte = (cle = CLE_GLOBALE, mois = moisDe(maintenant?.() ?? new Date())) => {
    const ligne = etat.sql.exec('SELECT utilise FROM compteur WHERE mois = ? AND cle = ?', mois, cle).toArray()[0];
    return typeof ligne?.utilise === 'number' ? ligne.utilise : 0;
  };
  return { espace, objet, compte, etat };
}
