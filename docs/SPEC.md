# ClosetA — Spécification (lot 1 Wishlist, lot 2 Vestiaire)

Version du 22 novembre 2026 (lot 2 ajouté, tri et vue par marque). Copie de travail de la spec rédigée dans claude.ai : en cas d'écart, signaler et proposer la mise à jour. Lots suivants (3 à 7) : voir [ROADMAP.md](ROADMAP.md).

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

- Affichage du vestiaire (lot 2, voir « Lot 2 — Vestiaire » en fin de document)
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
| image_locale | texte | non | nom du fichier de la copie locale de la photo (le dossier est recalculé sur chaque téléphone, depuis la migration v3) |
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
- Filtres : Tout, Vêtements, Chaussures, Priorité, Catégorie ; tri par date d'ajout (défaut), prix, priorité, marque (lot 2)
  - Barre de filtres repliée par défaut (« FILTRER · TOUT » et « RÉCENTS ») ; un toucher déplie le panneau : Pièces (Tout, Vêtements, Chaussures), Choix (Priorité, Catégorie), Vue (Grille, Catégories, Marques), Tri. La barre reste visible en haut quand on fait défiler. Retour d'usage du 22 novembre 2026 (filtres pas assez démarqués), voir DESIGN.md « Barre de filtres ».
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

- Design, Wishlist : la ligne de filtres déborde (« PRIORITÉ » coupé à droite). Demande : placer « Vêtements » et « Chaussures » en dessous de « Tout », pour que tout le menu soit visible. Choix retenu : ligne 1 « TOUT · PRIORITÉ · CATÉGORIE », ligne 2 « VÊTEMENTS · CHAUSSURES ».
- Formulaire : pouvoir ajouter une photo (appareil photo ou galerie) quand on ajoute une pièce à la main ou par lien, sans passer par la recherche par photo.

**Retours d'usage de l'étape 2 du lot 2** (22 novembre 2026), corrigés à l'étape 3 : la première section n'a plus de filet ; la barre repliée n'affiche plus que le tri à droite et garde la sélection sur une ligne.

- Barre de filtres, vue par catégorie : double filet. Le filet bas de la barre de filtres et le filet haut de la première section (« MANTEAU · 1 PIÈCE ») se suivent, avec un petit espace entre les deux. Il ne doit en rester qu'un.
- Barre de filtres repliée : quand la vue « Catégories » est choisie, « FILTRER · TOUT » passe sur deux lignes, faute de place à côté de « CATÉGORIES · RÉCENTS ».

## Lot 2 — Vestiaire

Le Vestiaire montre les pièces passées en « acheté » (`statut = achete`). Aucun changement de la base : `date_achat` existe déjà. Aucune dépendance ni permission Android nouvelle.

**Accès**

- Sous l'en-tête de la Wishlist et du Vestiaire, deux mots en capitales : « WISHLIST · VESTIAIRE », au style des filtres (actif = `ink` souligné). Un toucher passe d'un écran à l'autre ; le retour Android ramène du Vestiaire à la Wishlist.

**Écran Vestiaire**

- Même structure que la Wishlist : sur-titre « MON VESTIAIRE · N PIÈCES », titre « Le Vestiaire », total à droite.
- Total : somme des prix des pièces achetées ; pièces sans prix exclues et signalées (même règle que la Wishlist). Le prix est celui relevé à l'ajout ; un prix payé différent se corrige avec « Modifier ».
- Grille 2 colonnes : photo, marque, nom, prix. À la place de l'étiquette de priorité : le mois d'achat (« ACHETÉ EN NOV. 2026 »).
- Ordre par défaut : date d'achat, la plus récente d'abord.
- Pas de bouton « Ajouter » : une pièce entre au Vestiaire par « Je l'ai acheté ».
- État vide : une phrase qui explique comment une pièce y entre.
- Filtres : Tout, Vêtements, Chaussures, Catégorie (pas de Priorité) ; recherche texte ; tri par date d'achat (défaut), prix ou marque ; bascule Grille / Catégories / Marques avec sous-totaux, mêmes règles que la Wishlist, dans la même barre de filtres repliable et collante.

**Tri et vue par marque (Wishlist et Vestiaire)**

- Tri par marque : ordre alphabétique des marques ; pièces sans marque à la fin.
- Vue groupée par marque, en plus de la grille et de la vue par catégorie : mêmes règles que la vue par catégorie. Sections dans l'ordre alphabétique, titre tel que saisi avec le nombre de pièces, sous-total à droite ; section « Sans marque » à la fin. Filtres, recherche et tri s'appliquent aussi (le tri dans chaque section). La vue choisie n'est pas mémorisée.

**Fiche d'une pièce achetée**

- Affiche « Acheté le 22 novembre 2026 » ; pas de bouton « Je l'ai acheté ».
- Actions : Modifier, Supprimer, « Remettre dans la Wishlist » (confirmation ; statut `souhaite`, `date_achat` effacée).

**Hors lot 2** : statut `abandonne` (prévu en base, inutilisé), statistiques, tenues, budget. Lots suivants : voir [ROADMAP.md](ROADMAP.md).

**Découpage**

1. Écran Vestiaire et accès : bascule « WISHLIST · VESTIAIRE », grille, total, état vide ; fiche adaptée (date d'achat, sans « Je l'ai acheté »)
2. Filtres, recherche, tri et vue par catégorie du Vestiaire ; barre de filtres repliable et collante (Wishlist et Vestiaire) ; tri par marque et vue groupée par marque (Wishlist et Vestiaire)
3. « Remettre dans la Wishlist » depuis la fiche → **fin du lot 2**

**Retours d'usage** (notés pendant les tests de l'étape 3 du lot 2, 22 novembre 2026) : onglets Wishlist et Vestiaire en bas de l'écran et vrai menu, planifiés à l'étape 5 du lot 3 (voir « Lot 3 — Prix, alternatives et numérisation », « Étape 5 — Navigation par onglets »).

**Critères d'acceptation**

- [ ] Une pièce marquée « Je l'ai acheté » apparaît dans le Vestiaire, avec son mois d'achat, et le total du Vestiaire se met à jour
- [ ] Le Vestiaire ne montre jamais une pièce de la Wishlist, et inversement
- [ ] Les filtres type et catégorie, la recherche et le tri fonctionnent et se combinent dans le Vestiaire
- [ ] Le tri par marque et la vue groupée par marque fonctionnent dans la Wishlist et le Vestiaire, avec sous-totaux et section « Sans marque » à la fin
- [ ] « Remettre dans la Wishlist » ramène la pièce dans la Wishlist, sans date d'achat

## Lot 3 — Prix, alternatives et numérisation

Lot fusionné (anciens lots 3 « Prix et alternatives » et 4 « Numériser » de la feuille de route), pour **un seul test d'APK de production**, à la dernière étape. Chaque étape reste validée sur l'APK de développement. Trois pistes, menables en parallèle dans plusieurs sessions (voir CLAUDE.md, « Travail en parallèle ») : **A · Relais et Wishlist** (étapes 1 à 4), **B · Vestiaire** (étapes 5 à 8) et **C · Fondations multi-installations** (étapes 9 à 11, ajoutée le 23 novembre 2026). La production (étape 12) vient en dernier.

Décisions validées le 23 novembre 2026 :

- Alternatives : les **plus ressemblantes** (pas forcément moins chères), proposées **uniquement depuis la Wishlist**.
- Prix : **historique complet** conservé.
- Baisse de prix : signalée **à l'ouverture** seulement (pas de notification, pas de tâche en arrière-plan).
- Ajout direct au Vestiaire : date d'achat et prix payé **facultatifs**.
- Photos des pièces possédées : **sur cintre**, **format unique portrait 3:4**.

Décisions du 23 novembre 2026 (plans des étapes 1 et 5) :

- `releve_prix` reçoit un champ `source` (enum obligatoire : `ajout`, `relais`, `manuel`) : relevé de l'ajout, relecture par le relais, modification à la main.
- Les relevés sont créés dès l'étape 1 : à l'ajout par lien ou par photo, et à chaque modification manuelle du prix.
- Le compteur SerpApi suit le mois du calendrier (remise à zéro le 1er), même si l'offre SerpApi se renouvelle à une autre date.
- Barre d'onglets : deux mots en capitales, « WISHLIST » et « VESTIAIRE », sans icône (actif `ink` souligné, inactif `inkMuted`).
- Le bouton « Ajouter » du Vestiaire n'apparaît qu'à l'étape 6 (ajout direct au Vestiaire).

Décisions du 23 novembre 2026 (plan de l'étape 3) :

- Une relecture par le relais ne crée un relevé que si le prix ou la disponibilité a changé ; la date de vérification, elle, est toujours mise à jour.
- Étiquettes « ÉPUISÉ » et « BAISSE » : en haut à gauche de la photo, même style que la priorité (« BAISSE » en `tobacco`).

### Modèle de données (migration)

Nouvelle table `releve_prix` (un relevé = une lecture de la page boutique) :

| Champ | Type | Obligatoire | Remarque |
| --- | --- | --- | --- |
| id | UUID | oui | |
| article_id | UUID | oui | lien vers `article`, supprimé avec lui |
| date | date-heure | oui | |
| prix | décimal | non | null si la page ne donne pas de prix |
| devise | texte | non | |
| disponibilite | enum | oui | `en_stock`, `epuise`, `inconnue` |
| dispo_taille | enum | oui | `en_stock`, `epuise`, `inconnue` : pour la taille de l'article, si la boutique la publie |

Nouveaux champs de `article` :

| Champ | Type | Remarque |
| --- | --- | --- |
| prix_ajout | décimal | prix au moment de l'ajout (repris de `prix` pour les pièces existantes) |
| disponibilite | enum | dernier état connu, défaut `inconnue` |
| dispo_taille | enum | dernier état connu, défaut `inconnue` |
| date_verif | date-heure | dernière lecture de la page boutique |
| alternative_de | UUID | non null si la pièce a été ajoutée comme alternative d'une autre |

Règles :

- `prix` reste le **prix actuel** : il est mis à jour par chaque relevé qui en donne un. Le total de la Wishlist utilise donc le prix actuel.
- Le premier relevé est créé à l'ajout (par lien ou photo), avec le prix d'ajout.
- Une modification manuelle du prix crée un relevé (source manuelle) pour garder l'historique cohérent.
- Le Vestiaire n'est jamais actualisé : une pièce achetée garde son prix (prix payé).

### Piste A · Relais et Wishlist

**Étape 1 — Compteur SerpApi et historique des prix**

- Relais : compteur des recherches SerpApi du mois (Cloudflare KV ou équivalent gratuit), remis à zéro chaque mois. Seuil réglable (défaut 250). À 80 % : l'app prévient ; au seuil : les routes qui cherchent répondent `quota_atteint` sans appeler SerpApi.
- Relais : route `GET /quota` → `{ utilise, limite, mois }`.
- App, Réglages : ligne « Recherches ce mois : 37 sur 250 ».
- App : migration (`releve_prix`, nouveaux champs), reprise des données existantes (`prix_ajout` = `prix`, un relevé initial par pièce de la Wishlist qui a un prix).

**Étape 2 — Alternatives depuis une fiche de la Wishlist**

- Relais : route `POST /alternatives`, entrée `{ image_url?, photo?, nom, marque, categorie, couleur, url_exclue, genre? }` (`genre` ajouté à l'étape 12) → `{ resultats: [ { nom, marque, image, prix, devise, boutique, url } ] }`, au plus 5.
  - Recherche visuelle Google Lens sur l'image de la pièce (URL d'origine si elle existe, sinon photo locale envoyée et déposée un instant dans R2, comme `/identify`).
  - Classement par **ressemblance** (pertinence Lens puis proximité nom / catégorie / couleur), le prix n'entre pas dans le classement.
  - Exclus : la page d'origine (`url_exclue`), les réseaux sociaux, les résultats sans boutique.
  - Moins de 3 résultats : complément Google Shopping à partir de nom + marque + catégorie + couleur.
- App, fiche d'une pièce de la **Wishlist** seulement : action « Voir des alternatives ». Liste : photo, marque, nom, prix, boutique, et l'écart de prix avec la pièce (« 30 € de moins », « 12 € de plus »).
- Toucher une alternative : ouvre le formulaire pré-rempli (même parcours que l'ajout par lien), avec `est_alternative = vrai` et `alternative_de` = la pièce d'origine. La fiche de l'alternative mentionne « Alternative à : <nom> ».
- Chaque appel consomme 1 à 2 recherches SerpApi : la fiche affiche le compteur avant de lancer.

**Étape 3 — Prix et disponibilité actualisés**

- Relais : `/extract` renvoie en plus `disponibilite` (globale) et, si on lui passe `taille`, `dispo_taille`, lus dans les données produit (offres, variantes `hasVariant` avec taille). Rien de publié → `inconnue`, jamais deviné.
- App : à l'ouverture d'une fiche de la Wishlist avec un lien boutique, si `date_verif` a plus de 24 h → relecture en arrière-plan de l'écran (la fiche s'affiche tout de suite, puis se met à jour). Aucun appel SerpApi.
- Affichage sur la fiche :
  - Baisse : « *−25 €* depuis l'ajout » (relief), et prix barré d'ajout ; hausse : mention discrète.
  - Disponibilité : « En stock en M », « Épuisé en M », « Épuisé », ou rien si inconnue.
  - Historique : liste des relevés (date, prix), du plus récent au plus ancien.
- Grille de la Wishlist : petite étiquette « BAISSE » ou « ÉPUISÉ » sur la carte, selon le dernier relevé.
- Échec de lecture : la fiche garde les dernières valeurs connues et indique la date de la dernière vérification.

**Étape 4 — Pièce épuisée → alternatives**

- Quand la pièce est épuisée (globalement ou dans sa taille) : bandeau en tête de fiche « Épuisé en M. *Voir des alternatives* ». La recherche n'est lancée qu'au toucher (économie du quota).

### Piste B · Vestiaire

**Étape 5 — Navigation par onglets** (retours d'usage du lot 2)

- Barre fixée en bas : deux onglets, Wishlist et Vestiaire (remplace la bascule « WISHLIST · VESTIAIRE »).
- Icône menu en haut à gauche : vrai menu (Wishlist, Vestiaire, Réglages).
- Bouton « Ajouter » sur chaque onglet : il ajoute à la liste de l'onglet affiché.

**Étape 6 — Ajout direct au Vestiaire**

- Le bouton « Ajouter » du Vestiaire ouvre la même feuille (lien, photo, à la main). La pièce est créée avec `statut = achete`.
- Formulaire : champs de la Wishlist sans priorité, plus « Date d'achat » et « Prix payé », tous deux **facultatifs**.
- Sans date d'achat : la carte affiche « ACHAT NON DATÉ » ; ces pièces viennent en dernier dans le tri par date d'achat.
- Sans prix : exclue du total et signalée (règle existante).

**Étape 7 — Prise de vue guidée, format 3:4**

- Dans le Vestiaire, « Photo » ouvre une prise de vue guidée (module `expo-camera`, à valider : nouvelle dépendance native, APK de dev à réinstaller ; permission CAMERA déjà présente).
- À l'écran : cadre 3:4, silhouette de cintre en haut au centre, consignes courtes : « Suspends la pièce sur un cintre, devant un mur uni. Entière dans le cadre, crochet en haut. »
- Après la prise : recadrage automatique au format **3:4 portrait**, 1200 × 1600 px, JPEG, puis le formulaire (identification par `/identify` proposée, facultative).
- Une photo choisie dans la galerie passe par le même recadrage (cadre ajustable avant validation).
- Format cible : pièce entière, centrée, sur cintre, fond uni (exemple de référence fourni par l'utilisateur le 23 novembre 2026).
- Les cartes du Vestiaire passent au ratio 3:4 (la Wishlist garde son recadrage actuel, les images des boutiques n'étant pas standardisées).

**Étape 8 — Habillage de la photo**

- Exploration (23 novembre 2026) : essai de détourage sur 5 photos réelles, puis décision de l'utilisateur : **intégrer**, avec un **fond uni `photo3`** (#E4DDD2) **sans crochet** (le fond « mur ivoire et crochet laiton » est abandonné).
- Détourage **sur le téléphone**, gratuit et hors ligne : ML Kit Subject Segmentation (Google), par un petit module natif propre à l'app (`modules/detourage/`), à la taille réelle de la photo. Le modèle est fourni par les services Google Play (téléchargé au premier usage : le premier habillage peut être plus long). Aucune photo n'est envoyée.
- Habillage : la pièce détourée est **centrée** horizontalement et verticalement sur le fond, avec une marge de 10 % (côtés) et 7,5 % (haut et bas), et une ombre légère ; image finale 1200 × 1600, JPEG. Les taches détachées de la pièce sont ignorées pour le centrage.
- Dans le Vestiaire, après la prise de vue guidée ou la galerie : habillage automatique (« On prépare ta photo… »). Formulaire : choix « Habillée » (par défaut) ou « D'origine ».
- Échec (détourage impossible, rien de détecté, pièce trop petite, plus de 30 s) : la photo d'origine 3:4 est gardée, avec un message ; l'ajout n'est jamais bloqué.
- L'identification (`/identify`) reçoit toujours la photo d'origine.
- Les photos déjà présentes dans le Vestiaire ne sont pas modifiées.

### Piste C · Fondations multi-installations

Objectif : pouvoir installer ClosetA sur d'autres téléphones (les siens ou ceux d'autres personnes, sur le même relais ou sur un relais à eux) **sans recréer de compte Cloudflare**, et préparer une future synchronisation. Ces fondations ne changent rien à l'usage quotidien d'un téléphone seul. Décisions validées le 23 novembre 2026 ; comptes utilisateurs et synchronisation restent hors lot.

Constats de départ : un seul jeton partagé (`RELAY_TOKEN`), quota SerpApi global sans attribution, adresse du relais écrite en dur dans `settings.ts`, identifiants propres au compte Cloudflare dans `wrangler.toml`, photos enregistrées avec leur chemin complet, aucune sauvegarde, aucune vérification de compatibilité entre versions de l'app et du relais.

**Étape 9 — Identité, jetons par installation et versions**

- App : **identifiant d'installation** (UUID créé au premier lancement, rangé dans le coffre du téléphone), envoyé au relais dans l'en-tête `X-ClosetA-Installation`, avec la version de l'app dans `X-ClosetA-Version`.
- Relais : **un jeton par installation**. Liste dans Cloudflare KV : empreinte SHA-256 du jeton (jamais le jeton en clair) → `{ id, nom, cree_le, actif }`. Un jeton révoqué (`actif = faux`) est refusé immédiatement.
- Relais : **jeton d'administration** (`ADMIN_TOKEN`, secret Cloudflare saisi par l'utilisateur, comme les autres) qui seul ouvre les routes `GET /v1/admin/installations` (liste, avec le quota du mois de chacune), `POST /v1/admin/installations` (`{ nom }` → crée l'installation et renvoie son jeton **une seule fois**) et `DELETE /v1/admin/installations/{id}` (révocation).
- Transition : `RELAY_TOKEN` reste accepté et compte comme l'installation « Principale » tant qu'il existe ; l'app actuelle continue donc de marcher sans rien faire. Son retrait est hors lot.
- Quota : compteur SerpApi **par installation en plus du global** (le seuil global reste la limite dure ; seuil par installation réglable, défaut = global). `GET /quota` renvoie `{ installation: { utilise, limite }, global: { utilise, limite }, mois }`.
- Limite de débit par installation (et non plus par jeton partagé).
- Versions : routes servies sous `/v1/…` ; les routes actuelles sans préfixe restent des alias tant que des APK anciens existent. Variable `VERSION_APP_MIN` : une app plus ancienne reçoit `mise_a_jour_requise` (HTTP 426) et affiche « Mets ClosetA à jour pour continuer. »
- Tests du relais : jeton inconnu, révoqué, administration sans jeton admin, quota par installation, alias sans préfixe, version trop ancienne.

Décisions du 23 novembre 2026 (plan de l'étape 9) :

- Réglages et fiche affichent le compteur **global** (la limite dure) ; « épuisé » s'affiche aussi quand le seuil du téléphone est atteint (d'où `limite` dans `installation`).
- L'en-tête `X-ClosetA-Installation` est seulement contrôlé (forme d'un UUID) ; c'est le **jeton** qui désigne l'installation pour le quota et la limite de débit.
- Révocation : effective en **moins d'une minute** (délai de diffusion de Cloudflare KV).
- `VERSION_APP_MIN` est vide au départ ; une app qui n'envoie pas sa version compte comme trop ancienne une fois la variable remplie.

**Étape 10 — Configuration par QR code et relais déployable par un autre**

- Réglages, section « Relais » : adresse du relais **modifiable** (valeur par défaut : celle de `settings.ts`), jeton, « Tester la connexion », et **« Scanner un QR de configuration »** (lecteur de codes de `expo-camera`, déjà présent).
- QR de configuration : `closeta://config?relais=<adresse>&jeton=<jeton>`. Il contient un secret : il n'est affiché qu'à la demande, avec la mention « Ce code donne accès à ton relais. Ne le partage qu'avec le téléphone à configurer. »
- Réglages, section « Installations » (visible seulement si un jeton d'administration est saisi sur ce téléphone) : liste (nom, date, recherches du mois), « Ajouter un téléphone » (nom → QR de configuration affiché), « Révoquer » (confirmation).
- Relais déployable par un autre compte : plus aucun identifiant propre au compte dans `wrangler.toml` (identifiant KV, nom du bucket R2, nom du Worker) ; le workflow de mise en ligne les injecte depuis les **variables** GitHub du dépôt. README : guide « Installer son propre relais » pas à pas (compte Cloudflare, SerpApi, secrets, variables, premier jeton d'administration).

Décisions du 24 novembre 2026 (plan de l'étape 10) :

- Adresse du relais, jeton et jeton d'administration sont rangés dans le coffre du téléphone (`expo-secure-store`). Tant que l'adresse n'est pas changée, rien n'est rangé et l'app suit celle de `settings.ts` : un téléphone déjà configuré marche sans rien faire.
- Un lien `closeta://config` ouvert par Android (QR lu avec l'appareil photo du téléphone) mène à la même confirmation que le scan dans les Réglages : rien n'est enregistré sans « Configurer ».
- QR dessiné avec `qrcode-generator` (calcul seul, sans code natif) et `react-native-svg` ; le lecteur de codes d'`expo-camera` est activé (`barcodeScannerEnabled`), d'où un nouvel APK de développement.
- Le jeton d'un téléphone ajouté n'existe que dans son QR, affiché une seule fois : il n'est rangé nulle part sur le téléphone qui administre.
- Variables GitHub : `RELAIS_NOM_WORKER`, `RELAIS_KV_ID`, `RELAIS_BUCKET_R2`. Le workflow ajoute à `wrangler.toml`, le temps de la mise en ligne, les blocs de l'espace KV et du bucket R2, et passe le nom avec `wrangler deploy --name`. Depuis le lot 4, étape 2 : aussi `RELAIS_D1_ID` (bloc de la base D1).
- Sur un nouveau relais, le premier téléphone se configure avec `RELAY_TOKEN` ; les suivants avec « Ajouter un téléphone ».

**Étape 11 — Données portables : chemins relatifs et sauvegarde**

- Migration v3 : `image_locale` ne garde que le **nom du fichier** (le dossier est recalculé à l'exécution) ; reprise des données existantes. Indispensable pour restaurer une sauvegarde sur un autre téléphone, ou entre l'APK de dev et celui de production.
- Table `suppression` (`id`, `table`, `date`) : trace de chaque pièce ou relevé supprimé, pour une future synchronisation. Aucun usage visible dans ce lot.
- **Sauvegarde** (Réglages) : un fichier unique `closeta-AAAA-MM-JJ.closeta` (JSON : version du schéma, articles, relevés, photos encodées), proposé au partage Android (Drive, mail, fichiers…). Ni jeton ni identifiant d'installation dans la sauvegarde.
- **Restauration** (Réglages) : choix d'un fichier `.closeta`, résumé (« 42 pièces, 37 photos »), confirmation, puis **remplacement** de toutes les données du téléphone. Fusion de deux téléphones : hors lot.
- Dépendances à valider au plan de l'étape : partage et choix de fichier (`expo-sharing`, `expo-document-picker`).

Décisions du 24 novembre 2026 (plan de l'étape 11) :

- Dépendance : `expo-sharing` seul (menu de partage d'Android, sans son extension « recevoir un partage »). Le choix du fichier passe par le sélecteur d'`expo-file-system`, déjà présent : `expo-document-picker` n'est pas ajouté. Aucune permission Android ; nouvel APK de développement nécessaire.
- Migration v3 : seules les photos rangées dans le dossier `images/` de l'app passent au nom seul ; toute autre valeur reste entière et s'affiche comme avant. Dans l'app, une pièce porte toujours le chemin complet ; seule la base garde le nom.
- Le fichier contient, pour chaque pièce et chaque relevé, une liste fixe de champs recopiés un à un : aucun réglage, jeton ou identifiant ne peut y entrer. Les traces de `suppression` n'y sont pas ; une restauration les efface.
- Lecture : fichier entièrement vérifié avant tout changement (format, version, champs, photos encodées, noms de photos sans dossier). Version plus récente refusée avec « Mets l’app à jour » ; seule la version 3 existe.
- Remplacement : photos écrites dans un dossier à part, base remplacée d'un seul bloc, puis photos mises en place ; une restauration interrompue après le remplacement de la base se termine au démarrage suivant.
- Le fichier est préparé en mémoire (photos encodées) : adapté à quelques centaines de pièces.

**Étape 12 — Production**

- Vérifications complètes (expo-doctor, lint, tsc, jest, tests du relais), APK de production, **test unique** par l'utilisateur, fin du lot.
- Le test couvre en particulier : migration des photos (aucune perdue), ancien jeton toujours accepté, sauvegarde puis restauration sur l'APK de dev.

Retours du test de production (24 novembre 2026), ajoutés avant la fin du lot :

- **Photo agrandie** : toucher la photo d'une fiche (Wishlist ou Vestiaire) l'ouvre en plein écran sur fond `paper` ; pincer pour zoomer (jusqu'à × 4, réglage `photoPleinEcran`), glisser pour se déplacer, double toucher pour zoomer ou revenir ; un toucher, la croix ou le retour Android referment. Dépendances `react-native-gesture-handler`, `react-native-reanimated` et `react-native-worklets`, déjà présentes via expo-router, déclarées aux versions du SDK.
- **Genre des recherches** : Réglages, section « Recherches », « Je cherche pour : Femme · Homme · Mixte » (défaut Mixte = aucun filtre), rangé dans le coffre du téléphone, hors sauvegarde. Envoyé au relais (`genre` dans `/alternatives`, `?genre=` sur `/identify`) : ajouté à la recherche Google Shopping ; les résultats dont le nom désigne l'autre genre (« homme », « men », « femme », « women »…) sont écartés, sauf s'ils citent les deux. Sur `/identify`, seules les alternatives Shopping sont concernées, pas les correspondances Lens. Valeur inconnue refusée (`requete_invalide`).
- Le **style** dans les alternatives viendra avec le lot 6 (voir ROADMAP.md).

### Critères d'acceptation

- [ ] Réglages affiche le nombre de recherches SerpApi du mois ; au seuil, l'app explique qu'il faut attendre le mois suivant
- [ ] « Voir des alternatives » n'apparaît que sur une fiche de la Wishlist et propose jusqu'à 5 pièces ressemblantes, sans la page d'origine
- [ ] Une alternative ajoutée mentionne la pièce d'origine
- [ ] Ouvrir une fiche vérifiée il y a plus de 24 h relit la page ; une baisse s'affiche avec son montant ; l'historique liste les relevés
- [ ] Une disponibilité non publiée par la boutique n'est jamais affichée comme « en stock » ou « épuisé »
- [ ] Une pièce épuisée propose des alternatives sans lancer de recherche tant qu'on ne touche pas le bandeau
- [ ] Une pièce ajoutée depuis le Vestiaire y apparaît directement, avec ou sans date et prix
- [ ] Une photo prise par la prise de vue guidée est enregistrée en 3:4, 1200 × 1600
- [ ] Les données existantes (Wishlist, Vestiaire, photos) sont intactes après la migration et la mise à jour de l'APK
- [ ] Un téléphone ajouté depuis « Installations » se configure en scannant un QR, sans rien taper, et son quota du mois apparaît dans la liste
- [ ] Une installation révoquée est refusée par le relais ; les autres continuent de fonctionner
- [ ] Le téléphone actuel fonctionne sans reconfiguration après la mise à jour (ancien jeton accepté)
- [ ] Une app plus ancienne que `VERSION_APP_MIN` affiche le message de mise à jour au lieu d'une erreur
- [ ] Une sauvegarde restaurée sur un autre téléphone (ou sur l'APK de dev) retrouve toutes les pièces, relevés et photos
- [ ] `wrangler.toml` ne contient plus aucun identifiant propre à un compte Cloudflare

### Hors lot 3

Notifications de baisse, actualisation des pièces du Vestiaire, comptes utilisateurs, synchronisation ou partage entre téléphones, fusion de sauvegardes, retrait de l'ancien jeton partagé, alternatives depuis le Vestiaire, habillage si l'étape 8 n'est pas validée, lots suivants (bien tailler, plan d'achat, style : voir ROADMAP.md).

## Lot 4 — Robustesse et catalogue partagé

Lot technique, préparé le 24 novembre 2026 à partir de [ARCHITECTURE.md](ARCHITECTURE.md) (faiblesses n° 1 à 3 et 5 à 10). But : rendre le relais fiable et économe avant d'ouvrir ClosetA à d'autres personnes, sans rien changer aux usages quotidiens. Comme au lot 3, chaque étape est validée sur l'APK de développement et **un seul APK de production** est testé, à la dernière étape. Deux pistes, menables en parallèle : **A · Relais** (étapes 1 à 5) et **B · App et conformité** (étapes 6 à 8).

Décisions validées par l'utilisateur le 24 novembre 2026 :

- Durées de conservation du catalogue : page produit 24 h ; Google Shopping 7 jours ; Lens sur l'image d'une boutique 30 jours ; Lens sur une photo (empreinte) 30 jours ; historique des prix conservé.
- Historique partagé affiché sur la fiche de la Wishlist : « Prix le plus bas observé : 79 € (octobre 2026) », seulement s'il existe au moins 2 observations.
- Code d'invitation : 12 caractères lisibles (`CLST-7K4Q-9M2P`, sans 0/O ni 1/I), usage unique, valable 7 jours.
- Mises à jour : chaque APK de production publié en **release GitHub** (`vX.Y.Z`), l'app propose la nouvelle version au plus une fois par jour.
- Alerte de quota : visible dans Réglages pour l'installation qui a le jeton d'administration, à 80 % du quota global.

Décisions de confidentialité validées le 24 novembre 2026 (étape 8, détail dans [CONFIDENTIALITE.md](CONFIDENTIALITE.md)) :

- **Hébergement dans l'UE** (code fait le 25 novembre 2026 : variable `JURIDICTION_DONNEES` pour le Durable Object, variable GitHub `RELAIS_R2_JURIDICTION` pour le bucket ; recréation de D1 et R2 par l'utilisateur) : base D1 `CATALOGUE` créée avec la juridiction `eu` (`wrangler d1 create … --jurisdiction eu` ; la base de l'étape 2, créée sans, est à recréer et `RELAIS_D1_ID` à changer), Durable Object `Quota` obtenu dans la juridiction `eu` (`QUOTAS.jurisdiction('eu')`), bucket R2 des photos dans la juridiction européenne. KV (installations) n'a pas cette option. Le Durable Object de l'étape 1, déjà en ligne sans juridiction, est à déplacer (reprise des compteurs du mois).
- **Adresse canonique** (correctif après l'étape 2, fait le 25 novembre 2026 ; une adresse qui garde un paramètre inconnu est lue sans passer par le catalogue, pour ne pas confondre deux pièces) : **liste blanche** ; seuls les paramètres reconnus comme taille, couleur ou variante sont gardés, tous les autres sont retirés (un paramètre inconnu peut contenir un identifiant de session ou de client).
- **Installation révoquée** (fait le 25 novembre 2026 ; les installations révoquées avant sont effacées à la prochaine liste) : sa fiche et l'empreinte de son jeton sont **supprimées** de KV à la révocation ; ses compteurs disparaissent avec le mois (mois en cours et précédent gardés). Pas de renommage : révoquer puis recréer.
- **Sauvegarde automatique d'Android désactivée** (`android.allowBackup: false`) : la seule sauvegarde est le fichier `.closeta`.
- Images des boutiques et miniatures chargées directement par le téléphone, photo publique le temps de la recherche Lens : acceptées et documentées, sans changement.

### Règle modifiée (à partir de l'étape 2)

« Le relais ne conserve rien » devient : **le relais ne conserve aucune donnée personnelle.** Il garde :

- les installations (empreintes des jetons, nom, dates) et les compteurs de quota ;
- un **catalogue anonyme** : produits, prix observés et résultats de recherche, aux durées ci-dessus.

Jamais : identifiant d'installation ou jeton dans le catalogue, lien entre une recherche et la personne qui l'a faite, photo d'utilisateur (seulement son empreinte SHA-256, comme clé de cache), copie d'image de boutique (seulement son adresse).

### Piste A · Relais

**Étape 1 — Compteurs de quota dans un Durable Object**

- Un Durable Object `Quota` (stockage SQLite, disponible en offre gratuite) remplace les compteurs de KV : table `compteur (mois, cle, utilise)`, `cle` = `global` ou l'identifiant d'installation.
- `reserver()` vérifie le seuil global et celui de l'installation, puis compte les deux **dans une seule opération** : plus de recherche comptée en trop ou en moins, même quand deux téléphones cherchent en même temps.
- Reprise : au premier appel du mois en cours, les compteurs encore présents dans KV sont recopiés une fois, puis KV n'est plus utilisé pour le quota (les installations y restent : elles changent rarement).
- `GET /v1/quota` et `GET /v1/admin/installations` lisent le Durable Object ; leurs réponses ne changent pas de forme.
- Mise en ligne : la classe est déclarée dans `wrangler.toml` (migration `new_sqlite_classes`), aucune nouvelle variable GitHub.
- Tests : réservations simultanées, seuil global, seuil par installation, changement de mois, reprise depuis KV.

**Étape 2 — Catalogue partagé et cache (Cloudflare D1)**

- Base D1 `CATALOGUE` (identifiant fourni par une nouvelle variable GitHub `RELAIS_D1_ID`, créée par l'utilisateur ; commande exacte donnée au plan de l'étape). Schéma versionné (`relay/migrations/`), appliqué par le workflow de mise en ligne.
- Tables :

| Table | Champs |
| --- | --- |
| `produit` | `id`, `url` (adresse canonique), `boutique`, `nom`, `marque`, `image_url`, `categorie`, `couleur`, `genre`, `premiere_vue`, `derniere_vue` |
| `observation_prix` | `produit_id`, `date`, `prix`, `devise`, `disponibilite`, `dispo_tailles` (JSON) |
| `recherche` | `cle` (empreinte de : type + entrée normalisée + genre), `type` (`lens_image`, `lens_photo`, `shopping`), `resultats` (JSON), `cree_le`, `expire_le` |

- Adresse canonique : adresse de la page sans les paramètres de suivi connus (`utm_*`, `gclid`, `fbclid`…), les autres paramètres sont gardés (ils peuvent désigner une taille ou une couleur).
- `/v1/extract` : si le produit a été lu il y a moins de 24 h, réponse depuis le catalogue sans relire la page ; sinon lecture, mise à jour de `produit`, et nouvelle observation **seulement si le prix ou la disponibilité a changé**.
- `/v1/identify` et `/v1/alternatives` : avant d'appeler SerpApi, recherche de la clé dans `recherche` ; un résultat valide est renvoyé tel quel et **ne consomme pas le quota** de l'installation. Les réponses indiquent `depuis_cache: true|false`.
- Purge : tâche planifiée Cloudflare chaque nuit (3 h UTC), suppression des `recherche` expirées.
- Durées dans `relay/src/settings.ts`, jamais en dur ailleurs.
- Mise à jour de la règle dans CLAUDE.md (section « Relais Cloudflare ») et dans ce document.
- Réalisé en plus : `depuis_cache` aussi sur `/v1/extract` ; une recherche déjà en catalogue reste servie quand le quota est atteint (seules les recherches nouvelles sont refusées) ; `categorie`, `couleur` et `genre` de `produit` restent vides tant que la lecture des pages ne les fournit pas.
- Tests : clé de cache (même entrée = même clé, genre différent = clé différente), expiration, adresse canonique, observation créée seulement en cas de changement, aucun identifiant d'installation écrit dans D1.

**Étape 3 — Historique de prix partagé**

- `/v1/extract` renvoie en plus `historique : { prix_min, date_prix_min, observations, depuis }` quand le produit compte au moins 2 observations.
- App, fiche d'une pièce de la Wishlist : sous l'historique local, ligne « Prix le plus bas observé : *79 €* (octobre 2026) » ; rien si l'information manque.
- Fait le 25 novembre 2026 : `historique = { prix_min, devise, date_prix_min, observations, depuis }`, calculé dans la devise de la page ; l'app ne garde que les euros. Migration 4 de la base du téléphone : `article.prix_min_observe` et `article.date_prix_min_observe` (gardés entre deux relectures, mis à jour à chaque relecture qui en donne un) ; sauvegarde en version 4 (une sauvegarde en version 3 reste lisible, sans ce prix).
- Le relevé local du téléphone (`releve_prix`) ne change pas.

**Étape 4 — Interface de recherche indépendante du fournisseur**

- Les appels à SerpApi passent par une interface unique (`lens(image)`, `shopping(requete, genre)`) avec une implémentation SerpApi ; aucune autre partie du relais ne connaît SerpApi.
- Variable `RECHERCHE_FOURNISSEUR` (défaut `serpapi`), pour pouvoir changer de fournisseur plus tard sans toucher aux routes.
- Aucune différence visible ; les tests existants doivent rester verts sans modification de leurs attentes.
- Fait le 26 novembre 2026 : interface `FournisseurRecherche` dans `relay/src/recherche.ts` (`lens(image, prixDabord)`, `shopping(requete)` : la requête porte déjà le genre), implémentation dans `relay/src/serpapi.ts` (seul fichier qui connaît SerpApi, clé masquée dans les erreurs), choix dans `relay/src/fournisseur.ts` ; variable `RECHERCHE_FOURNISSEUR = "serpapi"` dans `wrangler.toml`. Le code d'incident `cle_serpapi_absente` est gardé (réponses inchangées).

**Étape 5 — Supervision et photos temporaires**

- Journaux Cloudflare activés (`[observability]` dans `wrangler.toml`), en JSON : route, durée, résultat, `depuis_cache`, code d'erreur. **Jamais** de jeton, d'identifiant d'installation, d'adresse IP, d'URL de photo ni de requête de recherche dans les journaux.
- `GET /v1/admin/etat` (jeton d'administration) : quota global du mois, taux de réponses depuis le cache, nombre d'erreurs des 24 dernières heures.
- Photos R2 : le workflow de mise en ligne vérifie que la règle « suppression après 1 jour » existe sur le bucket, et l'ajoute sinon (`wrangler r2 bucket lifecycle`).
- Fait le 26 novembre 2026 : `relay/src/supervision.ts` (une ligne JSON par requête : route sous forme de modèle, statut, durée, `depuis_cache`, code d'erreur ; test qui vérifie l'absence de jeton, d'identifiant, d'adresse IP, d'URL de photo et de page), compteurs par heure dans le Durable Object `Quota` (48 h gardées), `GET /v1/admin/etat` (`mois`, `quota`, `requetes`, `cache { reponses, depuis_cache, taux }`, `erreurs` : statuts 500 et plus), règle R2 nommée `closeta-suppression-1-jour`.

### Piste B · App et conformité

**Étape 6 — Codes d'invitation**

- Section « Installations » (jeton d'administration) : « Inviter quelqu'un » → nom → code d'invitation affiché, avec un lien à partager `closeta://invitation?relais=<adresse>&code=<code>` (QR et texte). Contrairement au QR de configuration, le lien **ne contient aucun jeton** : il peut être envoyé par message.
- Relais : `POST /v1/admin/invitations` (création ; seule l'empreinte du code est gardée, 7 jours), `GET` (invitations en attente) et `DELETE /v1/admin/invitations/<id>` (annulation), et `POST /v1/invitations/utiliser` (`{ code }`, sans jeton ni identifiant du téléphone, 5 essais par minute et par adresse) → crée l'installation et renvoie son jeton une seule fois ; le code est effacé dans la même opération que sa vérification.
- Décisions du 25 novembre 2026 : invitations rangées dans le Durable Object `Quota` (et non dans KV, dont la diffusion peut prendre une minute) pour garantir l'usage unique ; l'app n'envoie que le code, le relais tire lui-même l'identifiant de l'installation ; code `CLST-` suivi de 8 caractères tirés au hasard (40 bits).
- App : Réglages « J'ai un code d'invitation » (saisie ou lien ouvert), puis jeton rangé dans le coffre du téléphone ; la section « Installations » liste les invitations en attente (nom, expiration) et permet de les annuler.

**Étape 7 — Vérification de mise à jour**

- Workflow de production : publie l'APK signé dans une **release GitHub** `vX.Y.Z` (version de `app.json`, refus si elle existe déjà).
- Relais : `GET /v1/version` → `{ derniere, url }`, lu dans la dernière release GitHub et gardé 1 h (l'app ne parle qu'au relais).
- App : au plus une fois par jour, si une version plus récente existe, bandeau discret « Nouvelle version 1.2.0 disponible » avec un lien vers la release (navigateur). Rien si le relais ne répond pas.
- Décisions du 25 novembre 2026 : le relais lit la page publique `…/releases/latest` (redirection vers `…/tag/vX.Y.Z`) plutôt que l'API GitHub, dont la limite est partagée entre les serveurs de Cloudflare ; dépôt dans la variable `DEPOT_RELEASES` de `wrangler.toml` (vide = aucune annonce) ; réponse gardée 1 h dans KV, rien de gardé si GitHub ne répond pas. Bandeau en haut de la **Wishlist seulement**, avec une croix qui masque la version annoncée jusqu'à la suivante ; la ligne « Version » des Réglages indique aussi la nouvelle version.

**Étape 8 — Confidentialité**

- `docs/CONFIDENTIALITE.md` : données traitées (sur le téléphone, par le relais, dans le catalogue), finalités, durées, sous-traitants (Cloudflare ; SerpApi ; Google via Lens et Shopping) et transferts hors UE, droits et contact. Relu et validé par l'utilisateur.
- `docs/REGISTRE.md` : registre des traitements au format usuel (une fiche par traitement : relais, catalogue, installations).
- App : Réglages « Confidentialité » (résumé en quelques lignes et lien vers le document) ; sur les écrans photo, rappel « Photographie la pièce seule, sans personne. »

**Étape 9 — Production**

- Vérifications complètes (expo-doctor, lint, tsc, jest, tests du relais), mise en ligne du relais, APK de production publié en release, **test unique** par l'utilisateur.
- Retours d'usage ajoutés le 25 novembre 2026, développés avant le build :
  - **Recadrage au choix de la photo, pour la Wishlist aussi** (« Par photo », photo du formulaire) : recadrage d'Android proposé dès que la photo est prise ou choisie, format libre (le Vestiaire garde son recadrage 3:4).
  - **« Modifier » en haut à droite de la fiche** (icône dans l'en-tête), à la place du bouton en bas de fiche.

### Critères d'acceptation

- [ ] Deux recherches lancées en même temps depuis deux téléphones sont comptées exactement deux fois
- [ ] Les compteurs du mois en cours sont repris sans remise à zéro
- [ ] Une même demande d'alternatives refaite le lendemain répond depuis le catalogue, sans consommer de recherche
- [ ] Une page produit relue moins de 24 h après ne déclenche pas de nouvelle lecture
- [ ] La base D1 ne contient aucun identifiant d'installation, jeton, adresse IP ni photo
- [ ] La fiche affiche le prix le plus bas observé quand le catalogue en connaît au moins 2 observations
- [ ] Aucun jeton, identifiant d'installation, adresse IP ni URL de photo dans les journaux
- [ ] Un code d'invitation configure un nouveau téléphone, ne fonctionne qu'une fois, et plus après 7 jours
- [ ] L'app signale une version plus récente publiée en release
- [ ] Le document de confidentialité et le registre existent, validés par l'utilisateur

### Hors lot 4

Comptes utilisateurs, synchronisation, partage de Wishlist, inscription libre (sans invitation), Play Store, modèle de financement, retrait de l'ancien jeton partagé, changement effectif de fournisseur de recherche.
