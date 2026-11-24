/// <reference types="node" />
/** Fausse base Cloudflare D1 pour les tests : vraie base SQLite en mémoire (Node), avec les migrations du dépôt. */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import type { BaseD1, InstructionD1 } from '../src/catalogue';

const DOSSIER = new URL('../migrations/', import.meta.url);

export function baseD1(): BaseD1 & { db: DatabaseSync; enPanne: boolean } {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(DOSSIER).filter((n) => n.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, DOSSIER), 'utf8'));
  const base = {
    db,
    /** Vrai : chaque requête échoue (panne de D1). */
    enPanne: false,
    prepare(sql: string): InstructionD1 {
      const instruction = (valeurs: (string | number | null)[]): InstructionD1 => {
        const verifier = () => {
          if (base.enPanne) throw new Error('D1 indisponible');
          return db.prepare(sql);
        };
        return {
          bind: (...v) => instruction(v),
          first: async <T>() => (verifier().get(...valeurs) as T | undefined) ?? null,
          run: async () => verifier().run(...valeurs),
        };
      };
      return instruction([]);
    },
  };
  return base;
}

/** Tout le contenu de la base, en texte (pour vérifier qu'aucune donnée personnelle n'y est écrite). */
export function contenu(db: DatabaseSync): string {
  return ['produit', 'observation_prix', 'recherche'].map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all())).join('\n');
}
