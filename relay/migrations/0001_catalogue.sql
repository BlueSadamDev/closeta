-- Catalogue partagé et anonyme du relais (docs/SPEC.md, lot 4, étape 2).
-- Aucune donnée personnelle : ni identifiant d'installation, ni jeton, ni adresse IP, ni photo.
-- Dates en millisecondes depuis le 1er janvier 1970 (UTC).
-- Ne jamais modifier une migration déjà en ligne : en ajouter une nouvelle (0002_…).

-- Produits lus sur les pages des boutiques (adresse canonique : sans paramètres de suivi).
CREATE TABLE produit (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  boutique TEXT,
  nom TEXT,
  marque TEXT,
  image_url TEXT,
  categorie TEXT,
  couleur TEXT,
  genre TEXT,
  premiere_vue INTEGER NOT NULL,
  derniere_vue INTEGER NOT NULL
);

-- Prix et disponibilité observés : une ligne seulement quand quelque chose a changé. Conservés.
CREATE TABLE observation_prix (
  id INTEGER PRIMARY KEY,
  produit_id INTEGER NOT NULL REFERENCES produit (id),
  date INTEGER NOT NULL,
  prix REAL,
  devise TEXT,
  disponibilite TEXT NOT NULL,
  dispo_tailles TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX observation_prix_produit ON observation_prix (produit_id, date);

-- Résultats des recherches Google Lens et Shopping, réutilisés jusqu'à leur expiration.
-- cle = empreinte SHA-256 de « type | entrée normalisée | genre » (jamais la photo elle-même).
CREATE TABLE recherche (
  cle TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('lens_image', 'lens_photo', 'shopping')),
  resultats TEXT NOT NULL,
  cree_le INTEGER NOT NULL,
  expire_le INTEGER NOT NULL
);
CREATE INDEX recherche_expiration ON recherche (expire_le);
