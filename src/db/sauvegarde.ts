/**
 * Sauvegarde et restauration côté base (docs/SPEC.md, « Lot 3 », « Étape 11 »).
 * Le fichier lui-même est préparé et vérifié dans src/domain/sauvegarde.ts.
 */
import type { Article } from '@/domain/article';
import type { RelevePrix } from '@/domain/releve';

import {
  COLONNES,
  enregistrerReleve,
  valeurs,
  versArticle,
  versReleve,
  type BaseArticles,
  type Ligne,
  type LigneReleve,
} from './articles';

export interface BaseSauvegarde extends BaseArticles {
  execAsync(sql: string): Promise<void>;
}

/** Toutes les pièces (Wishlist, Vestiaire, abandonnées) et tous les relevés de prix. */
export async function lireTout(db: BaseArticles): Promise<{ articles: Article[]; releves: RelevePrix[] }> {
  const articles = await db.getAllAsync<Ligne>('SELECT * FROM article ORDER BY date_ajout, id', []);
  const releves = await db.getAllAsync<LigneReleve>('SELECT * FROM releve_prix ORDER BY date, id', []);
  return { articles: articles.map(versArticle), releves: releves.map(versReleve) };
}

/**
 * Remplace toutes les données du téléphone par celles d'une sauvegarde, d'un seul bloc :
 * si une écriture échoue, la base reste exactement comme avant.
 * Les traces de suppression sont effacées : elles décrivaient les données remplacées.
 */
export async function remplacerTout(db: BaseSauvegarde, articles: readonly Article[], releves: readonly RelevePrix[]): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync('DELETE FROM releve_prix; DELETE FROM article; DELETE FROM suppression;');
    for (const a of articles) {
      await db.runAsync(
        `INSERT INTO article (${COLONNES.join(', ')}) VALUES (${COLONNES.map(() => '?').join(', ')})`,
        valeurs(a),
      );
    }
    for (const r of releves) await enregistrerReleve(db, r);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
