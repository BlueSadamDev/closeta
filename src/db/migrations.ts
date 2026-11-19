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
];
