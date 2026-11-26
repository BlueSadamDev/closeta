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

/**
 * Espace QUOTAS du Worker, branché sur le faux KV : un exemplaire sans juridiction (`objet`), et un
 * exemplaire « eu » (`eu`), créé à la première demande `jurisdiction('eu')`, comme chez Cloudflare.
 */
export function espaceQuota(kv: MagasinListable, maintenant?: () => Date) {
  const etat = etatObjet();
  let objetEu: { objet: Quota; etat: ReturnType<typeof etatObjet> } | null = null;
  const espace: EspaceQuota = {
    idFromName: (nom) => nom,
    get: () => objet,
    jurisdiction: (juridiction) => ({
      idFromName: (nom) => `${juridiction}:${nom}`,
      get: () => {
        if (!objetEu) {
          const e = { ...etatObjet(), id: { jurisdiction: juridiction } };
          objetEu = { objet: new Quota(e, { QUOTA: kv, QUOTAS: espace }, maintenant), etat: e };
        }
        return objetEu.objet;
      },
    }),
  };
  const objet = new Quota(etat, { QUOTA: kv, QUOTAS: espace }, maintenant);
  /** Recherches comptées ce mois dans une case (`global` par défaut), dans un exemplaire donné. */
  const compteDans = (e: ReturnType<typeof etatObjet>, cle: string, mois: string) => {
    const ligne = e.sql.exec('SELECT utilise FROM compteur WHERE mois = ? AND cle = ?', mois, cle).toArray()[0];
    return typeof ligne?.utilise === 'number' ? ligne.utilise : 0;
  };
  const moisCourant = () => moisDe(maintenant?.() ?? new Date());
  const compte = (cle = CLE_GLOBALE, mois = moisCourant()) => compteDans(etat, cle, mois);
  const compteEu = (cle = CLE_GLOBALE, mois = moisCourant()) => (objetEu ? compteDans(objetEu.etat, cle, mois) : 0);
  return { espace, objet, compte, compteEu, etat, eu: () => objetEu };
}
