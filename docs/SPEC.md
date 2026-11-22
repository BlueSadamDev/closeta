# ClosetA — Spécification du lot 1 (Wishlist)

Version du 20 novembre 2026. Copie de travail de la spec rédigée dans claude.ai : en cas d'écart, signaler et proposer la mise à jour.

## Vision et périmètre

ClosetA est une app Android personnelle qui suit un vêtement de l'envie à l'achat : il entre dans la wishlist, puis passe au vestiaire une fois acheté. Le lot 1 livre la wishlist ; le vestiaire arrive au lot 2, mais les données sont prévues dès maintenant.

**Lot 1a — Wishlist et ajout par lien**

- Wishlist en grille, filtres (type, catégorie, priorité), total en euros
- Vue par catégorie : la Wishlist regroupée en sections (Vestes, Pulls, Manteaux…), avec un sous-total par section
- Fiche article : consultation, modification, suppression
- Ajout manuel
- Ajout par lien produit : récupération automatique du nom, de la marque, de l'image et du prix
- Bouton « Je l'ai acheté » : l'article quitte la wishlist et reste en base avec le statut acheté

**Lot 1b — Ajout par photo**

- Analyse de la photo par IA, recherche visuelle en ligne, 3 à 5 propositions au choix
- Si l'article exact n'est pas trouvé : articles proches, étiquetés « Alternative, pas l'article exact »

**Hors lot 1**

- Affichage du vestiaire (lot 2)
- Suivi des prix, tenues, statistiques, budget plafond

## Modèle de données

Une seule table `article` porte la wishlist et le futur vestiaire ; c'est le champ `statut` qui décide où l'article s'affiche. Stockage local SQLite (expo-sqlite), images copiées dans le stockage de l'app.

| Champ | Type | Obligatoire | Remarque |
| --- | --- | --- | --- |
| id | UUID | oui | généré par l'app |
| nom | texte | oui | |
| marque | texte | non | |
| type | enum | oui | `vetement` ou `chaussures` |
| categorie | texte | non | liste proposée selon le type (haut, pull, pantalon, veste, manteau, maille, baskets, mocassins…) |
| taille | texte | non | |
| couleur | texte | non | |
| prix | décimal (€) | non | prix relevé au moment de l'ajout |
| devise | texte | non | EUR par défaut |
| url_boutique | texte | non | lien d'origine |
| image_locale | chemin | non | copie locale de la photo |
| image_source | texte | non | URL de l'image d'origine |
| priorite | enum | oui | `forte`, `moyenne`, `un_jour` (défaut `moyenne`) |
| notes | texte | non | |
| statut | enum | oui | `souhaite`, `achete`, `abandonne` |
| origine | enum | oui | `manuel`, `lien`, `photo` |
| est_alternative | booléen | oui | vrai si proposé comme article proche (lot 1b) |
| date_ajout | date-heure | oui | |
| date_achat | date-heure | non | renseignée au passage en `achete` |
| date_maj | date-heure | oui | |

Règles :

- La wishlist affiche `statut = souhaite` ; le total additionne leurs prix (articles sans prix exclus et signalés).
- « Je l'ai acheté » passe en `achete` et remplit `date_achat` ; rien n'est supprimé.
- Supprimer efface réellement l'article et son image, après confirmation.
- Le schéma est versionné (migrations) pour accueillir le lot 2 sans perte.

## Écrans et parcours

**1. Wishlist (accueil)**

- En-tête : logo, recherche texte dans la wishlist
- « Ma sélection · N pièces », titre « La Wishlist », total en euros
- Filtres : Tout, Vêtements, Chaussures, Priorité, Catégorie ; tri par date d'ajout (défaut), prix, priorité
- Bascule entre la grille et la vue par catégorie (sections par catégorie, sous-total par section ; articles sans catégorie regroupés à la fin)
  - Sections dans l'ordre alphabétique, titre au singulier tel que saisi (« VESTE · 2 PIÈCES »), sous-total à droite ; section « À classer » pour les pièces sans catégorie. Filtres, recherche et tri s'appliquent aussi (le tri dans chaque section). La vue choisie n'est pas mémorisée.
- Grille 2 colonnes : photo, étiquette de priorité, marque, nom, prix
- Bouton « Ajouter » fixe en bas à droite
- État vide : une phrase et le bouton d'ajout

**2. Fiche article**

- Grande photo, marque, nom, prix, taille, couleur, priorité, notes
- Lien « Voir en boutique » (ouvre le navigateur)
- Actions : Modifier, « Je l'ai acheté » (confirmation, puis retour à la wishlist), Supprimer (confirmation)

**3. Ajouter un article** (feuille qui monte du bas)

- Coller un lien
- Prendre ou choisir une photo (lot 1b ; masqué en 1a)
- Saisir à la main

**4. Formulaire de validation** (commun aux trois modes)

- Champs pré-remplis par le lien ou la photo, tous modifiables
- Champs manquants signalés ; nom et type obligatoires
- Enregistrer → statut `souhaite`

**5. Réglages** : saisie et test du jeton du relais (bouton « Tester la connexion »), version de l'app. Accessible depuis l'icône menu.

**Parcours par lien**

1. L'utilisateur colle l'URL ; si le presse-papiers contient déjà un lien, l'app le propose.
2. L'app appelle le relais `/extract` ; un indicateur de chargement s'affiche (délai maximal 20 s).
3. Le formulaire s'ouvre pré-rempli ; si l'extraction échoue, il s'ouvre vide avec le lien conservé et un message invitant à compléter la fiche.

**Parcours par photo (lot 1b)**

1. Photo prise ou choisie ; l'app la réduit (1024 px max) avant envoi.
2. Le relais `/identify` renvoie 3 à 5 propositions : image, nom, marque, prix, boutique ; un indicateur de chargement s'affiche (délai maximal 30 s, la recherche enchaînant IA et Google).
3. L'utilisateur choisit, ou refuse et relance.
4. Aucun résultat exact : la liste affiche des articles proches avec l'étiquette « Alternative, pas l'article exact ».
5. Le choix ouvre le formulaire de validation ; la photo de l'utilisateur peut être gardée comme image de l'article.

**Partage Android** : depuis une appli ou un site de boutique, « Partager → ClosetA » lance directement le parcours par lien. Usage principal attendu : inclus au lot 1a.

## Architecture

L'app reste locale pour les données ; seul l'ajout par lien ou par photo passe par un relais Cloudflare Worker qui détient les clés d'API.

```
Téléphone                    Cloudflare                     Services externes
App ClosetA  ── HTTPS ──▶   Relais (Worker)        ──▶     Pages des boutiques (/extract)
SQLite + photos              jeton, limite de débit ──▶     IA Cloudflare Workers AI (/identify)
aucune clé d'API             clés d'API en secrets  ──▶     SerpApi Google Lens + Shopping (/identify)
```

L'app n'appelle jamais directement l'IA ni la recherche visuelle : tout passe par le relais, qui contrôle le jeton et le volume.

**Routes du relais**

| Route | Entrée | Sortie | Fonctionnement |
| --- | --- | --- | --- |
| POST /extract | `{ url }` | `{ nom, marque, image, prix, devise, url }`, champs absents = null | 1) lecture des données produit standard de la page (schema.org Product, Open Graph ; nom du site en dernier recours pour la marque) ; 2) si incomplet, extraction par IA sur le texte de la page, ajoutée seulement si les boutiques test l'exigent |
| POST /identify (1b) | photo JPEG brute (`Content-Type: image/jpeg`), ≤ 1024 px, ≤ 2 Mo | `{ description: { type, categorie, couleur, matiere, marque, recherche }, resultats: [ { nom, marque, image, prix, devise, boutique, url, alternative } ] }`, 0 à 5 résultats, champs absents = null | 1) en même temps : IA Cloudflare Workers AI (offre gratuite, modèle réglable) qui décrit l'article, et recherche visuelle SerpApi Google Lens ; 2) les correspondances Lens menant à une boutique (réseaux sociaux écartés) sont les propositions, celles avec un prix d'abord ; 3) s'il y en a moins de 3, recherche Google Shopping à partir de la description, `alternative = true` ; au plus 5 résultats. La marque vue par l'IA n'est reportée que si elle figure dans le nom du résultat. Liste vide = rien trouvé ; erreur `recherche_indisponible` = aucune recherche n'a pu aboutir |
| GET /photo/{id} (1b) | — | la photo JPEG | adresse temporaire lue par Google Lens : identifiant aléatoire de 64 caractères, sans jeton, photo supprimée dès la fin de la recherche |

**Sécurité**

- Clés d'API stockées en secrets Cloudflare (`wrangler secret put`), jamais dans le dépôt ni l'APK. L'IA de Cloudflare (Workers AI) ne demande aucune clé ; seule SerpApi en a une (`SERPAPI_KEY`).
- Jeton partagé app ↔ relais dans l'en-tête `Authorization` ; requête refusée sans lui. Le jeton est saisi dans l'écran Réglages et stocké avec expo-secure-store, jamais injecté au build : le dépôt GitHub est public et ses APK sont téléchargeables par d'autres.
- Limite : 30 requêtes par minute et par jeton, réglable.
- Le relais ne conserve ni les photos ni les pages : il traite puis répond. Exception lot 1b : SerpApi Lens exige une URL d'image, d'où un dépôt temporaire dans Cloudflare R2 (bucket `closeta-photos-temp`), supprimé juste après la recherche ; une règle du bucket supprime aussi tout fichier de plus d'un jour.
- `/extract` n'accepte que des URL `https` publiques (pas d'adresse IP locale), pour éviter qu'on l'utilise pour sonder un réseau privé.
- Plafond de dépenses à configurer chez chaque fournisseur d'API.

## Identité visuelle — piste A « Éditorial »

Voir DESIGN.md (tokens, typographie, composants, charte des textes).

## Découpage, critères d'acceptation et risques

1. Socle : projet Expo, polices, thème, base SQLite et migrations, workflows de build
2. Wishlist et fiche : grille, filtres, total, modifier, supprimer, « Je l'ai acheté » ; formulaire de saisie manuelle (ajout et modification)
3. Relais Cloudflare : `/extract`, jeton, limite de requêtes (lecture des données standard ; IA en renfort seulement si nécessaire)
4. Écran Réglages (saisie du jeton du relais) et choix du mode d'ajout (feuille du bas)
5. Ajout par lien côté app et partage Android → **fin du lot 1a**
6. Vue par catégorie : sections par catégorie, sous-totaux
7. Relais `/identify` et parcours photo → **fin du lot 1b**

L'APK est construit par GitHub Actions (expo prebuild puis Gradle), avec la clé de signature dans les secrets GitHub. Dépôt public.

**Critères d'acceptation**

- [ ] Un article ajouté à la main apparaît dans la wishlist et le total se met à jour
- [ ] Les filtres type, catégorie et priorité fonctionnent et se combinent
- [ ] « Je l'ai acheté » retire l'article de la wishlist ; il reste en base avec `statut = achete` et `date_achat`
- [ ] Les données survivent à la fermeture de l'app et à une mise à jour de l'APK
- [ ] Un lien de 5 boutiques test pré-remplit au moins nom, image et prix pour 4 d'entre elles
- [ ] Un lien illisible ouvre le formulaire vide avec le lien conservé, sans planter
- [ ] (1b) Une photo d'article connu renvoie l'article exact parmi les propositions
- [ ] (1b) Une photo sans correspondance renvoie des alternatives étiquetées
- [ ] Aucune clé d'API ni aucun jeton dans le dépôt git ni dans l'APK

**Risques**

| Risque | Effet | Parade |
| --- | --- | --- |
| Boutiques qui bloquent les robots ou affichent la page en JavaScript | extraction vide | rendu de page Cloudflare (10 min/jour gratuites), sinon saisie complétée à la main |
| Recherche visuelle imprécise | mauvais article proposé | choix parmi 3 à 5 résultats, relance, alternatives étiquetées |
| Coût des API IA et recherche | factures inattendues | plafond de dépenses chez chaque fournisseur, limite de requêtes au relais |
| Fuite du jeton | usage des crédits par un tiers | jeton saisi dans l'app (jamais dans l'APK), rotation, limite de requêtes |
| Limite de calcul de 10 ms du Worker gratuit | erreurs sur pages lourdes | lecture ciblée des données produit ; offre payante à 5 $/mois si besoin |

**Questions ouvertes**

- ~~Quelles 5 boutiques test pour le critère d'extraction ?~~ Réponse :
  Scavini (WooCommerce), Suitsupply, Hast (Shopify), Aspen, Couturier Parisien (Shopify).
  Les liens produits exacts ne sont pas dans le dépôt (dépôt public) : ils sont testés à la main sur le relais.

**Retours d'usage à planifier** (notés pendant les tests de l'étape 7, 22 novembre 2026)

- Design, Wishlist : la ligne de filtres déborde (« PRIORITÉ » coupé à droite). Demande : placer « Vêtements » et « Chaussures » en dessous de « Tout », pour que tout le menu soit visible.
- Formulaire : pouvoir ajouter une photo (appareil photo ou galerie) quand on ajoute une pièce à la main ou par lien, sans passer par la recherche par photo.
