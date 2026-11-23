import { migrer, versionDeLaBase } from '../migrate';
import { MIGRATIONS } from '../migrations';
import { baseDeTest } from '../__fixtures__/baseDeTest';

const CHAMPS_DE_LA_SPEC = [
  'id', 'nom', 'marque', 'type', 'categorie', 'taille', 'couleur', 'prix', 'devise',
  'url_boutique', 'image_locale', 'image_source', 'priorite', 'notes', 'statut', 'origine',
  'est_alternative', 'date_ajout', 'date_achat', 'date_maj',
  // Lot 3 (migration 2)
  'prix_ajout', 'disponibilite', 'dispo_taille', 'date_verif', 'alternative_de',
];

const CHAMPS_RELEVE = ['id', 'article_id', 'date', 'prix', 'devise', 'disponibilite', 'dispo_taille', 'source'];

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

describe('migration 2 : historique des prix', () => {
  /** Base fictive restée en version 1, avec trois pièces. */
  async function baseEnVersion1() {
    const db = baseDeTest();
    await migrer(db, MIGRATIONS.slice(0, 1));
    db.brute.exec(`
      INSERT INTO article (id, nom, type, origine, prix, devise, statut, date_ajout, date_maj) VALUES
        ('w1', 'Veste fictive', 'vetement', 'lien', 420, 'EUR', 'souhaite', '2026-03-01T10:00:00Z', '2026-03-02T10:00:00Z'),
        ('w2', 'Pull sans prix', 'vetement', 'manuel', NULL, 'EUR', 'souhaite', '2026-03-05T10:00:00Z', '2026-03-05T10:00:00Z'),
        ('v1', 'Chemise achetée', 'vetement', 'manuel', 90, 'EUR', 'achete', '2026-01-02T10:00:00Z', '2026-02-01T10:00:00Z');
    `);
    return db;
  }

  it('crée la table releve_prix avec exactement les champs de la spec', async () => {
    const db = baseDeTest();
    await migrer(db);
    const colonnes = db.brute.prepare('PRAGMA table_info(releve_prix)').all() as { name: string }[];
    expect(colonnes.map((c) => c.name)).toEqual(CHAMPS_RELEVE);
  });

  it('reprend le prix actuel comme prix d’ajout, pour toutes les pièces', async () => {
    const db = await baseEnVersion1();
    await migrer(db);
    expect(db.brute.prepare('SELECT id, prix_ajout, disponibilite, dispo_taille, date_verif, alternative_de FROM article ORDER BY id').all()).toEqual([
      { id: 'v1', prix_ajout: 90, disponibilite: 'inconnue', dispo_taille: 'inconnue', date_verif: null, alternative_de: null },
      { id: 'w1', prix_ajout: 420, disponibilite: 'inconnue', dispo_taille: 'inconnue', date_verif: null, alternative_de: null },
      { id: 'w2', prix_ajout: null, disponibilite: 'inconnue', dispo_taille: 'inconnue', date_verif: null, alternative_de: null },
    ]);
  });

  it('crée un relevé initial seulement pour les pièces de la Wishlist qui ont un prix', async () => {
    const db = await baseEnVersion1();
    await migrer(db);
    const releves = db.brute.prepare('SELECT * FROM releve_prix').all() as Record<string, unknown>[];
    expect(releves).toHaveLength(1);
    expect(releves[0]).toMatchObject({
      article_id: 'w1',
      date: '2026-03-01T10:00:00Z',
      prix: 420,
      devise: 'EUR',
      disponibilite: 'inconnue',
      dispo_taille: 'inconnue',
      source: 'ajout',
    });
    expect(releves[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('refuse une source ou une disponibilité hors liste', async () => {
    const db = await baseEnVersion1();
    await migrer(db);
    expect(() => db.brute.exec("UPDATE releve_prix SET source = 'devine'")).toThrow();
    expect(() => db.brute.exec("UPDATE article SET disponibilite = 'bientot'")).toThrow();
  });
});
