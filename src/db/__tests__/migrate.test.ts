import { migrer, versionDeLaBase } from '../migrate';
import { MIGRATIONS } from '../migrations';
import { baseDeTest } from '../__fixtures__/baseDeTest';

const CHAMPS_DE_LA_SPEC = [
  'id', 'nom', 'marque', 'type', 'categorie', 'taille', 'couleur', 'prix', 'devise',
  'url_boutique', 'image_locale', 'image_source', 'priorite', 'notes', 'statut', 'origine',
  'est_alternative', 'date_ajout', 'date_achat', 'date_maj',
];

const ARTICLE_FICTIF = `INSERT INTO article (id, nom, type, origine, date_ajout, date_maj)
  VALUES ('a1', 'Veste fictive', 'vetement', 'manuel', '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z')`;

describe('migrations de la base', () => {
  it('sont numérotées 1, 2, 3… sans trou', () => {
    MIGRATIONS.forEach((m, i) => expect(m.version).toBe(i + 1));
  });

  it('amènent une base neuve à la dernière version', async () => {
    const db = baseDeTest();
    expect(await versionDeLaBase(db)).toBe(0);
    expect(await migrer(db)).toBe(MIGRATIONS.length);
    expect(await versionDeLaBase(db)).toBe(MIGRATIONS.length);
  });

  it('créent la table article avec exactement les champs de la spec', async () => {
    const db = baseDeTest();
    await migrer(db);
    const colonnes = db.brute.prepare('PRAGMA table_info(article)').all() as { name: string }[];
    expect(colonnes.map((c) => c.name)).toEqual(CHAMPS_DE_LA_SPEC);
  });

  it('appliquent les valeurs par défaut de la spec', async () => {
    const db = baseDeTest();
    await migrer(db);
    db.brute.exec(ARTICLE_FICTIF);
    expect(db.brute.prepare('SELECT priorite, statut, devise, est_alternative FROM article').get()).toEqual({
      priorite: 'moyenne',
      statut: 'souhaite',
      devise: 'EUR',
      est_alternative: 0,
    });
  });

  it('refusent un statut, un type ou une priorité hors liste', async () => {
    const db = baseDeTest();
    await migrer(db);
    db.brute.exec(ARTICLE_FICTIF);
    expect(() => db.brute.exec("UPDATE article SET statut = 'perdu'")).toThrow();
    expect(() => db.brute.exec("UPDATE article SET type = 'sac'")).toThrow();
    expect(() => db.brute.exec("UPDATE article SET priorite = 'urgente'")).toThrow();
  });

  it('ne refont rien sur une base déjà à jour et gardent les données', async () => {
    const db = baseDeTest();
    await migrer(db);
    db.brute.exec(ARTICLE_FICTIF);
    await migrer(db);
    expect(db.brute.prepare('SELECT COUNT(*) AS n FROM article').get()).toEqual({ n: 1 });
  });

  it('laissent la base intacte si une migration échoue', async () => {
    const db = baseDeTest();
    await migrer(db);
    const fautive = [...MIGRATIONS, { version: MIGRATIONS.length + 1, description: 'fautive', sql: 'CREATE TABLE x (a); SYNTAXE FAUSSE;' }];
    await expect(migrer(db, fautive)).rejects.toThrow();
    expect(await versionDeLaBase(db)).toBe(MIGRATIONS.length);
    expect(db.brute.prepare("SELECT name FROM sqlite_master WHERE name = 'x'").get()).toBeUndefined();
  });
});
