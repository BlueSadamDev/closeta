/**
 * Migrations de la base : chaque migration fait évoluer la structure d'un cran.
 * Règle : ne jamais modifier une migration déjà livrée dans un APK ; en ajouter une nouvelle
 * à la fin, avec le numéro suivant. Ainsi les données existantes ne sont jamais perdues.
 * Modèle de données : docs/SPEC.md, « Modèle de données ».
 */
export type Migration = {
  version: number;
  description: string;
  sql: string;
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Création de la table article (wishlist et futur vestiaire)',
    sql: `
      CREATE TABLE article (
        id              TEXT PRIMARY KEY NOT NULL,
        nom             TEXT NOT NULL,
        marque          TEXT,
        type            TEXT NOT NULL CHECK (type IN ('vetement', 'chaussures')),
        categorie       TEXT,
        taille          TEXT,
        couleur         TEXT,
        prix            REAL CHECK (prix IS NULL OR prix >= 0),
        devise          TEXT DEFAULT 'EUR',
        url_boutique    TEXT,
        image_locale    TEXT,
        image_source    TEXT,
        priorite        TEXT NOT NULL DEFAULT 'moyenne'
                        CHECK (priorite IN ('forte', 'moyenne', 'un_jour')),
        notes           TEXT,
        statut          TEXT NOT NULL DEFAULT 'souhaite'
                        CHECK (statut IN ('souhaite', 'achete', 'abandonne')),
        origine         TEXT NOT NULL CHECK (origine IN ('manuel', 'lien', 'photo')),
        est_alternative INTEGER NOT NULL DEFAULT 0 CHECK (est_alternative IN (0, 1)),
        date_ajout      TEXT NOT NULL,
        date_achat      TEXT,
        date_maj        TEXT NOT NULL
      );
      CREATE INDEX article_statut ON article (statut);
    `,
  },
  {
    version: 2,
    description: 'Historique des prix (table releve_prix), nouveaux champs de article, reprise des données',
    // Pas de clé étrangère déclarée : enregistrerArticle utilise INSERT OR REPLACE, qui efface puis
    // réécrit la ligne ; une suppression en cascade effacerait l'historique à chaque modification.
    // Les relevés d'une pièce sont donc supprimés explicitement avec elle (supprimerArticle).
    sql: `
      ALTER TABLE article ADD COLUMN prix_ajout REAL CHECK (prix_ajout IS NULL OR prix_ajout >= 0);
      ALTER TABLE article ADD COLUMN disponibilite TEXT NOT NULL DEFAULT 'inconnue'
        CHECK (disponibilite IN ('en_stock', 'epuise', 'inconnue'));
      ALTER TABLE article ADD COLUMN dispo_taille TEXT NOT NULL DEFAULT 'inconnue'
        CHECK (dispo_taille IN ('en_stock', 'epuise', 'inconnue'));
      ALTER TABLE article ADD COLUMN date_verif TEXT;
      ALTER TABLE article ADD COLUMN alternative_de TEXT;

      CREATE TABLE releve_prix (
        id            TEXT PRIMARY KEY NOT NULL,
        article_id    TEXT NOT NULL,
        date          TEXT NOT NULL,
        prix          REAL CHECK (prix IS NULL OR prix >= 0),
        devise        TEXT,
        disponibilite TEXT NOT NULL CHECK (disponibilite IN ('en_stock', 'epuise', 'inconnue')),
        dispo_taille  TEXT NOT NULL CHECK (dispo_taille IN ('en_stock', 'epuise', 'inconnue')),
        source        TEXT NOT NULL CHECK (source IN ('ajout', 'relais', 'manuel'))
      );
      CREATE INDEX releve_prix_article ON releve_prix (article_id, date);

      -- Reprise : le prix actuel devient le prix d'ajout ; un relevé initial par pièce de la Wishlist qui a un prix.
      UPDATE article SET prix_ajout = prix;
      INSERT INTO releve_prix (id, article_id, date, prix, devise, disponibilite, dispo_taille, source)
        SELECT
          lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
            substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) ||
            substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
          id, date_ajout, prix, devise, 'inconnue', 'inconnue', 'ajout'
        FROM article
        WHERE statut = 'souhaite' AND prix IS NOT NULL;
    `,
  },
  {
    version: 3,
    description: 'Photos rangées par leur seul nom de fichier, table suppression',
    // Le nom du dossier (« images », settings.imagesDirectory au moment de cette migration) est écrit en dur :
    // une migration livrée ne change plus. Seules les photos rangées dans ce dossier de l'app sont reprises ;
    // toute autre valeur reste telle quelle (versCheminDePhoto la garde entière), aucune photo n'est perdue.
    // rtrim(x, <x sans « / »>) garde x jusqu'au dernier « / » : on retire ce début pour ne garder que le nom.
    // `table` est un mot réservé de SQL, d'où les guillemets.
    sql: `
      UPDATE article
        SET image_locale = replace(image_locale, rtrim(image_locale, replace(image_locale, '/', '')), '')
        WHERE image_locale LIKE '%/images/%' AND substr(image_locale, -1) <> '/';

      CREATE TABLE suppression (
        id      TEXT NOT NULL,
        "table" TEXT NOT NULL CHECK ("table" IN ('article', 'releve_prix')),
        date    TEXT NOT NULL
      );
    `,
  },
  {
    version: 4,
    description: 'Prix le plus bas observé par le catalogue partagé du relais (lot 4, étape 3)',
    sql: `
      ALTER TABLE article ADD COLUMN prix_min_observe REAL CHECK (prix_min_observe IS NULL OR prix_min_observe > 0);
      ALTER TABLE article ADD COLUMN date_prix_min_observe TEXT;
    `,
  },
];
