# Règles du projet ClosetA

## Contexte
- L'utilisateur ne sait pas développer. Tout expliquer en français simple, sans jargon (ou expliquer chaque terme technique).
- Projet : application Android personnelle de wishlist de vêtements et chaussures. Un article acheté passe au vestiaire. Usage strictement personnel : pas de Play Store, pas de comptes utilisateurs.
- Référence fonctionnelle : [docs/SPEC.md](docs/SPEC.md). La lire avant chaque nouvelle étape ou fonctionnalité. Ne rien développer qui n'y figure pas sans demander.
- Livrable : un APK installable sur le téléphone (Android 14 ou plus récent).
- Technologie imposée : Expo (React Native, TypeScript strict), expo-router, GitHub Actions pour les APK. Relais : Cloudflare Worker (TypeScript) dans `relay/`. Ne proposer aucun autre framework sans demander.
- Le développement se fait depuis le téléphone, via une session Claude Code distante. Les comptes rendus doivent être courts.

## Structure du code
- `src/app/` : écrans (expo-router).
- `src/domain/` : logique pure, sans interface ni réseau (total de la wishlist, changements de statut, lecture des données produit, validation des champs). Tout y est testé.
- `src/domain/texts/` : tous les textes affichés (voir DESIGN.md, « Textes »).
- `src/domain/settings.ts` : tous les réglages (délais, taille des photos, limites), jamais en dur dans le code.
- `src/db/` : base SQLite locale et migrations.
- `src/relay/` : client du relais (seul endroit de l'app qui fait des appels réseau).
- `src/photo/` : prise de la photo (appareil photo ou galerie) et réduction avant l'envoi au relais.
- `src/components/` : composants d'interface réutilisables.
- `src/theme.ts` : couleurs, polices, espacements (voir DESIGN.md).
- `relay/` : le Cloudflare Worker (routes `/extract` et `/identify`), avec ses propres tests.

## Dépôt public : règles de confidentialité
- Le dépôt GitHub est **public** (choix assumé : builds GitHub Actions sans limite). Tout ce qui y entre est lisible par n'importe qui.
- Aucun secret dans le dépôt : clés d'API, jeton du relais, keystore, mots de passe, identifiant de compte Cloudflare.
- **Aucun secret dans l'APK non plus** : les APK déposés par GitHub Actions sont téléchargeables par d'autres personnes. Le jeton du relais est donc **saisi dans l'app** (écran Réglages), stocké avec `expo-secure-store`, jamais injecté au build.
- L'adresse du relais n'est pas un secret : elle peut figurer dans `settings.ts`.
- Aucune vraie donnée de ma wishlist dans le dépôt (exports, captures, logs). Les tests utilisent uniquement des **données fictives** rangées dans `src/domain/__fixtures__/` et `relay/test/fixtures/`.
- Pas de SDK d'analytics, de suivi des plantages ni de publicité.
- Sauvegarde uniquement par export manuel d'un fichier, déclenché par l'utilisateur (lot 3, étape 11) ; jamais de jeton ni d'identifiant d'installation dedans.

## Relais Cloudflare
- Les clés d'API (IA, SerpApi) sont des secrets Cloudflare (`wrangler secret put`), jamais dans `wrangler.toml` ni dans le code.
- `wrangler.toml` ne contient aucun identifiant propre au compte : l'identifiant du compte vient du secret `CLOUDFLARE_ACCOUNT_ID`, le nom du Worker, l'espace KV, le bucket R2 et la base D1 des variables GitHub `RELAIS_NOM_WORKER`, `RELAIS_KV_ID`, `RELAIS_BUCKET_R2` et `RELAIS_D1_ID` (ajoutés par le workflow de mise en ligne). Juridiction UE : `JURIDICTION_DONNEES` dans `wrangler.toml` (Durable Object), variable GitHub facultative `RELAIS_R2_JURIDICTION` (bucket R2) ; D1 et R2 créés dans la juridiction `eu`.
- Le relais refuse toute requête sans jeton valide (en-tête `Authorization`) et limite le débit à 30 requêtes par minute.
- `/extract` n'accepte que des URL `https` publiques (pas d'adresse IP locale ou privée).
- Le relais ne conserve **aucune donnée personnelle** (depuis le lot 4, étape 2). Il garde les installations (empreintes des jetons) et les compteurs de quota, et un **catalogue anonyme** dans Cloudflare D1 (produits, prix observés, résultats de recherche, aux durées de `relay/src/settings.ts`). Jamais dans le catalogue : identifiant d'installation, jeton, adresse IP, lien entre une recherche et la personne qui l'a faite, photo (seulement son empreinte SHA-256, comme clé), copie d'image de boutique (seulement son adresse). Photos pour Google Lens : dépôt temporaire dans Cloudflare R2, supprimé juste après la recherche.
- Ne jamais créer ni modifier toi-même un secret Cloudflare : donner la commande exacte à l'utilisateur.

## Règles de l'app
- Quand une information manque (prix non trouvé, image absente), l'app l'affiche comme manquante au lieu d'inventer une valeur.
- Un échec d'extraction ou d'identification ne bloque jamais l'ajout : le formulaire s'ouvre et l'utilisateur complète.
- Chaque règle de `src/domain/` a des tests automatiques (Jest, via `jest-expo`) sur données fictives. Après chaque modification d'un calcul, lancer les tests et dire en une phrase ce qu'ils vérifient.

## Découpage en étapes (lot 1)
Une étape = une branche `lot-1-<n>-<nom>` et un APK testé.
1. Socle : projet Expo, thème, polices, base SQLite et migrations, les deux workflows de build. **Terminée, fusionnée via la PR #1** : app Expo SDK 58, identité visuelle, table `article` et migrations, accueil provisoire.
2. Wishlist et fiche : grille, filtres, total, modifier, supprimer, « Je l'ai acheté » ; formulaire de saisie manuelle (ajout et modification). **Terminée, fusionnée via la PR #2** : Wishlist, fiche, formulaire, barre de navigation couleur papier.
3. Relais : `/extract`, jeton, limite de débit, mise en ligne par GitHub Actions. Lecture des données produit standard d'abord ; IA en renfort seulement si les boutiques test l'exigent. **Terminée, fusionnée via la PR #4** : relais `/extract` en ligne (jeton, limite de débit, URL publiques), lecture des données produit, workflow de mise en ligne.
4. Écran Réglages (saisie et test du jeton) ; choix du mode d'ajout (feuille du bas). **Terminée, fusionnée via la PR #5** : écran Réglages (jeton rangé dans le coffre du téléphone, bouton « Tester la connexion »), feuille du bas « Ajouter une pièce ».
5. Ajout par lien dans l'app et partage Android (« Partager → ClosetA ») → fin du lot 1a. **Terminée, fusionnée via la PR #6** : écran « Coller un lien » (lien du presse-papiers proposé), formulaire pré-rempli par le relais, partage Android, photo copiée sur le téléphone.
6. Vue par catégorie : Wishlist regroupée en sections par catégorie, avec sous-totaux. **Terminée, fusionnée via la PR #7** : bascule « VUE · GRILLE / CATÉGORIES », sections alphabétiques avec sous-totaux, section « À classer » à la fin.
7. Relais `/identify` + parcours photo → fin du lot 1b. Recherche visuelle : SerpApi (API Google Lens ; alternatives via Google Shopping à partir de la description IA). **Terminée, fusionnée via la PR #8** : relais `/identify` (IA Cloudflare Workers AI + Google Lens via SerpApi, alternatives Google Shopping, photo temporaire dans R2), écran « Par photo », formulaire pré-rempli, permission CAMERA.
8. Retours d'usage de l'étape 7 : filtres de la Wishlist sur deux lignes ; photo dans le formulaire (ajout à la main, par lien, modification). **Terminée, fusionnée via la PR #9** : filtres « TOUT · PRIORITÉ · CATÉGORIE » puis « VÊTEMENTS · CHAUSSURES », photo ajoutable (appareil ou galerie) dans le formulaire.

## Découpage en étapes (lot 2 : Vestiaire)
Une étape = une branche et un APK testé. Détail : docs/SPEC.md, « Lot 2 — Vestiaire ».
1. Écran Vestiaire et accès : bascule « WISHLIST · VESTIAIRE », grille, total, état vide ; fiche adaptée (date d'achat, sans « Je l'ai acheté »). **Terminée, fusionnée via la PR #10** : bascule « WISHLIST · VESTIAIRE », écran Vestiaire (mois d'achat sur les cartes, total), fiche avec la date d'achat.
2. Filtres, recherche, tri et vue par catégorie du Vestiaire ; barre de filtres repliable et collante (Wishlist et Vestiaire). **Terminée, fusionnée via la PR #11** : recherche, filtres, tri et vue par catégorie du Vestiaire ; barre « FILTRER » repliable (panneau à sélections pleines) qui reste en haut au défilement. Le tri et la vue groupée par marque, ajoutés à cette étape par la PR #12 après sa fusion, sont reportés à l'étape 4.
3. « Remettre dans la Wishlist » depuis la fiche. **Terminée, fusionnée via la PR #13** : bouton « Remettre dans la Wishlist » sur la fiche d'une pièce achetée, corrections de la barre de filtres.
4. Tri et vue par marque (Wishlist et Vestiaire) → fin du lot 2. **Terminée, fusionnée via la PR #14** : tri « Marque » et vue « Marques » (sections alphabétiques, sous-totaux, « Sans marque » à la fin) dans la Wishlist et le Vestiaire.

## Découpage en étapes (lot 3 : Prix, alternatives et numérisation)
Une étape = une branche, validée sur l'APK de développement ; **un seul APK de production testé**, à l'étape 12. Trois pistes, menables dans plusieurs sessions (voir « Travail en parallèle »). Détail : docs/SPEC.md, « Lot 3 — Prix, alternatives et numérisation ».

Piste A · Relais et Wishlist :
1. Compteur SerpApi et historique des prix : compteur mensuel au relais (seuil réglable, `quota_atteint`), route `GET /quota`, ligne dans Réglages ; migration (`releve_prix`, nouveaux champs de `article`) et reprise des données. **Terminée, fusionnée via la PR #17** : compteur SerpApi dans Cloudflare KV (mois du calendrier, seuil dans `wrangler.toml`), `GET /quota`, ligne « Recherches ce mois » dans Réglages (mise en garde à 80 %), message « quota atteint » sur Par photo ; migration v2 (`releve_prix` avec `source`), relevés à l'ajout par lien ou photo et à chaque prix modifié à la main.
2. Alternatives depuis une fiche de la Wishlist : route `POST /alternatives` (ressemblance), « Voir des alternatives », ajout d'une alternative liée à la pièce d'origine. **Terminée, fusionnée via la PR #19** : route `POST /alternatives` (Google Lens sur l'image de la boutique ou la photo, complément Google Shopping, compteur), bouton « Voir des alternatives » avec le compteur du mois, écart de prix, formulaire pré-rempli lié à la pièce d'origine, « Alternative à : » sur la fiche.
3. Prix et disponibilité actualisés : `/extract` renvoie la disponibilité ; relecture à l'ouverture d'une fiche (plus de 24 h) ; baisse, disponibilité, historique ; étiquettes « BAISSE » et « ÉPUISÉ » sur les cartes. **Terminée, fusionnée via la PR #21** : `/extract` renvoie la disponibilité (globale et par taille, lue dans les données produit et les variantes), relecture à l'ouverture d'une fiche de plus de 24 h, baisse ou hausse depuis l'ajout, disponibilité, historique (relevé seulement en cas de changement), étiquettes « ÉPUISÉ » et « BAISSE » sur les cartes.
4. Pièce épuisée → bandeau « Voir des alternatives » (recherche lancée seulement au toucher). **Terminée, fusionnée via la PR #23** : bandeau « Épuisé en M. Voir des alternatives » en tête de fiche (Wishlist seulement), écran Alternatives ouvert au toucher, bandeau grisé quand le quota est atteint.

Piste B · Vestiaire :
5. Navigation par onglets : barre en bas (Wishlist, Vestiaire), vrai menu en haut à gauche, bouton « Ajouter » sur chaque onglet. **Terminée, fusionnée via la PR #16** : onglets « WISHLIST · VESTIAIRE » en bas, menu qui glisse depuis la gauche (Wishlist, Vestiaire, Réglages), bascule supprimée. Le bouton « Ajouter » du Vestiaire vient à l'étape 6.
6. Ajout direct au Vestiaire : même feuille d'ajout, statut `achete`, date d'achat et prix payé facultatifs. **Terminée, fusionnée via la PR #18** : bouton « Ajouter » du Vestiaire (même feuille), formulaire sans priorité avec « Prix payé » et « Date d'achat » facultatifs, « ACHAT NON DATÉ » sur les cartes, aucun relevé de prix pour le Vestiaire.
7. Prise de vue guidée, format 3:4 (`expo-camera` à valider) : cadre, silhouette de cintre, recadrage 1200 × 1600 ; cartes du Vestiaire en 3:4. **Terminée, fusionnée via la PR #20** : `expo-camera` (sans micro), prise de vue guidée (cadre 3:4, cintre, consigne), recadrage 1200 × 1600, galerie recadrée en 3:4, identification facultative, cartes du Vestiaire en 3:4.
8. Habillage de la photo (exploration) : essai de détourage sur 5 photos, décision de l'utilisateur avant tout développement. **Terminée, fusionnée via la PR #26** : essai validé, puis intégration : module natif local `modules/detourage/` (ML Kit Subject Segmentation sur le téléphone), pièce détourée et centrée sur fond uni `photo3` sans crochet, choix « Habillée / D'origine », photo d'origine gardée en cas d'échec.

Piste C · Fondations multi-installations (ajoutée le 23 novembre 2026) :
9. Identité, jetons par installation et versions : identifiant d'installation, jetons par installation (empreintes dans KV), jeton d'administration et routes `/v1/admin/installations`, quota et limite de débit par installation, routes `/v1/…` avec alias, `VERSION_APP_MIN` ; `RELAY_TOKEN` toujours accepté (installation « Principale »). **Terminée, fusionnée via la PR #25** : jetons par installation (empreintes dans KV, révocation), `ADMIN_TOKEN` et routes `/v1/admin/installations`, quota et limite de débit par installation, routes `/v1` avec alias, `VERSION_APP_MIN` (426, « Mets ClosetA à jour pour continuer. »), identifiant d'installation et version envoyés par l'app.
10. Configuration par QR code et relais déployable par un autre : adresse du relais modifiable, QR `closeta://config`, section « Installations » (ajout, révocation), `wrangler.toml` sans identifiant de compte (variables GitHub), guide « Installer son propre relais ». **Terminée, fusionnée via la PR #27** : adresse du relais modifiable (coffre du téléphone, `settings.ts` par défaut), QR `closeta://config` (scan avec `expo-camera`, affichage avec `qrcode-generator`, lien ouvert par Android avec confirmation), section « Installations » (liste, ajout par QR affiché une fois, révocation), `wrangler.toml` sans identifiant de compte (variables `RELAIS_NOM_WORKER`, `RELAIS_KV_ID`, `RELAIS_BUCKET_R2`), guide « Installer son propre relais ».
11. Données portables : photos en nom de fichier (migration v3), table `suppression`, sauvegarde et restauration d'un fichier `.closeta`. **Terminée, fusionnée via la PR #28** : migration v3 (nom seul des photos, dossier recalculé au démarrage), table `suppression`, section « Sauvegarde » des Réglages (fichier `.closeta` partagé avec `expo-sharing`, restauration vérifiée puis remplacement complet, sans aucun secret).

Fin du lot :
12. Production : vérifications complètes, APK de production, test unique par l'utilisateur. **Terminée, fusionnée via la PR #29** : vérifications complètes, aucun secret (dépôt, APK), test unique validé sur l'APK de production (points 1 à 7 ; QR de configuration à tester plus tard) ; retours ajoutés : photo agrandie avec zoom sur la fiche, genre des recherches d'alternatives (Réglages « Je cherche pour », relais `/alternatives` et `/identify`) ; variables GitHub `RELAIS_*` créées, relais remis en ligne.

## Découpage en étapes (lot 4 : Robustesse et catalogue partagé)
Une étape = une branche, validée sur l'APK de développement ; **un seul APK de production testé**, à l'étape 9 (même exception de fusion qu'au lot 3). Deux pistes, menables dans deux sessions. Détail : docs/SPEC.md, « Lot 4 — Robustesse et catalogue partagé », et docs/ARCHITECTURE.md. Les 5 décisions de la spec (durées du catalogue, historique partagé, codes d'invitation, releases GitHub, alerte de quota) sont validées.

Piste A · Relais :
1. Compteurs de quota dans un Durable Object `Quota` (SQLite) : réservation atomique global + installation, reprise des compteurs KV du mois. **Terminée, fusionnée via la PR #32** : Durable Object `Quota` (table `compteur`, lien `QUOTAS`, migration `new_sqlite_classes`), réservation des deux seuils en une seule opération, reprise unique des compteurs KV du mois, mois de plus de 2 mois effacés ; KV ne garde plus que les installations.
2. Catalogue partagé et cache dans D1 (`produit`, `observation_prix`, `recherche`) : lecture des pages en cache 24 h, recherches en cache (sans consommer le quota), purge nocturne ; variable GitHub `RELAIS_D1_ID` à créer par l'utilisateur ; règle « Relais Cloudflare » mise à jour. **Terminée, fusionnée via la PR #34** : base D1 `CATALOGUE` (migrations dans `relay/migrations/`, appliquées par le workflow), page produit servie 24 h depuis le catalogue (adresse sans suivi, observation seulement si changement), recherches Lens (30 j) et Shopping (7 j) réutilisées sans quota (`depuis_cache`), purge à 3 h UTC, variable `RELAIS_D1_ID`, règle « aucune donnée personnelle ».
3. Historique de prix partagé : `historique` dans `/v1/extract`, « Prix le plus bas observé » sur la fiche de la Wishlist.
4. Interface de recherche indépendante du fournisseur (`RECHERCHE_FOURNISSEUR`, défaut `serpapi`).
5. Supervision et photos temporaires : journaux JSON sans donnée personnelle, `GET /v1/admin/etat`, règle d'expiration R2 vérifiée par le workflow.

Piste B · App et conformité :
6. Codes d'invitation : création depuis « Installations », lien `closeta://invitation` sans jeton, code à usage unique valable 7 jours. **Terminée, fusionnée via la PR #36** : routes `/v1/admin/invitations` et `POST /v1/invitations/utiliser` (`{ code }` seul), code `CLST-XXXX-XXXX` dont seule l'empreinte est gardée, usage unique garanti par le Durable Object `Quota`, 5 essais par minute et par adresse ; « Inviter quelqu'un » (code, QR, partage), invitations en attente annulables, « J'ai un code d'invitation » (saisie, lien ou QR).
7. Vérification de mise à jour : release GitHub à chaque APK de production, `GET /v1/version`, bandeau dans l'app. **Terminée, fusionnée via la PR #37** : workflow de production qui publie l'APK en release `vX.Y.Z` (refus si elle existe : augmenter la version de `app.json`), `GET /v1/version` (page `…/releases/latest`, gardée 1 h, variable `DEPOT_RELEASES`), bandeau « Nouvelle version disponible » en haut de la Wishlist (au plus une vérification par jour, croix pour masquer), ligne « Version » des Réglages.
8. Confidentialité : `docs/CONFIDENTIALITE.md`, `docs/REGISTRE.md`, écran « Confidentialité », rappel sur les écrans photo. **Terminée, fusionnée via la PR #35** : `docs/CONFIDENTIALITE.md` et `docs/REGISTRE.md` (version 1, contact dpo@closeta.fr), écran « Confidentialité » dans Réglages, rappel « sans personne » sur les écrans photo, sauvegarde automatique d'Android désactivée ; décisions pour la piste A notées dans docs/SPEC.md (juridiction `eu`, liste blanche des paramètres, suppression à la révocation).

Fin du lot :
9. Production : vérifications complètes, relais en ligne, APK publié en release, test unique par l'utilisateur. Retours ajoutés le 25 novembre 2026 : recadrage au choix de la photo pour la Wishlist, « Modifier » en haut à droite de la fiche.

## Lot 4b : Confort de saisie (ajouté le 25 novembre 2026, après le lot 4)
Brouillons repris plus tard, choix Wishlist ou Vestiaire dans le formulaire d'ajout, recadrage d'une photo déjà enregistrée. Détail à écrire dans docs/SPEC.md avant le développement (voir docs/ROADMAP.md).

## Lots suivants
Lots 4 à 7 (robustesse et catalogue partagé, bien tailler, plan d'achat, style) : voir [docs/ROADMAP.md](docs/ROADMAP.md). Chaque lot sera détaillé dans docs/SPEC.md avant son développement. Architecture, coûts et passage à plusieurs utilisateurs : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), à lire avant toute évolution du relais.

Tenir ces listes à jour : marquer chaque étape « terminée, fusionnée via la PR #n » avec une ligne de résumé.

## Design
Lire [DESIGN.md](DESIGN.md) avant toute modification d'interface et le respecter. Tout nouveau texte affiché passe par `src/domain/texts/` et respecte la charte ; le test `textGuard.test.ts` doit rester vert.

## Façon de travailler
- Commencer toujours par un plan court et attendre la validation avant d'écrire du code.
- Demander une validation à chaque étape majeure : nouvelle fonctionnalité, changement d'architecture, ajout d'une dépendance ou d'une permission Android. Pour une petite modification, avancer sans demander.
- Faire de petites modifications et vérifier que ça fonctionne après chacune.
- Après chaque étape, résumer en 3 à 5 lignes ce qui a changé et comment le vérifier sur le téléphone.
- Ne jamais supprimer de fichiers ni installer d'outil global sans demander.
- N'ajouter aucune fonctionnalité non demandée et ne pas réécrire du code qui marche.
- En cas de blocage après 2 tentatives : s'arrêter, expliquer le problème et proposer des options. Ne pas tourner en boucle.

## Dépendances
- Ajouter un module Expo avec `npx expo install <nom>`, jamais `npm install`, pour garantir la compatibilité avec le SDK.
- Modules prévus (à ajouter seulement quand l'étape en a besoin, avec validation) : `expo-sqlite`, `expo-file-system`, `expo-image-picker`, `expo-image-manipulator`, `expo-secure-store`, `expo-font`, `expo-clipboard`, `expo-dev-client`, `expo-build-properties`, `jest-expo`.
- Session distante sans accès à exp.host (`getaddrinfo ENOTFOUND exp.host`) : `EXPO_OFFLINE=1 npx expo install <nom>` (versions lues dans le SDK installé). `expo-doctor` y échoue sur 2 contrôles réseau, sans rapport avec le projet.
- Ne jamais ajouter manuellement `expo-modules-core` ni `expo-modules-autolinking` dans `package.json`. Lancer `npx expo install --fix` si nécessaire.
- **Dependabot** : ne jamais fusionner une PR Dependabot qui touche les dépendances npm de l'app. À la place : `npx expo install --check`, puis `npx expo install --fix` sur une branche dédiée, et fermer la PR Dependabot avec une explication. Les PR Dependabot sur `.github/workflows` ou `relay/` peuvent être fusionnées après un build et des tests réussis.

## Qualité du code (avant chaque build ou grosse étape)
1. `npx expo-doctor` (objectif : aucune erreur)
2. `npx expo lint`
3. `npx tsc --noEmit`
4. `npx jest`
5. Si `relay/` a changé : ses tests (`npm test` dans `relay/`)
Si `expo-doctor` signale des versions incompatibles : `npx expo install --fix`, puis relancer les vérifications.

## Git et GitHub
- Commits fréquents, messages clairs en français. Commit de sécurité avant chaque grosse modification.
- Ne jamais travailler directement sur `main`. Une branche par étape.
- Après chaque étape validée : commit, puis push de la branche.
- Fusionner dans `main` uniquement après test de l'APK par l'utilisateur, avec un accord explicite qui nomme la PR (par exemple « fusionne la #3 »). Un « ok » général ne suffit pas.
- Exception du lot 3 : une étape peut être fusionnée après les vérifications automatiques (section « Qualité du code »), sans test d'APK ; le test unique se fait avec l'APK de production à l'étape 12. L'accord explicite qui nomme la PR reste obligatoire.
- Dans chaque résumé, distinguer « APK construit » (le build GitHub a réussi) et « APK testé » (installé et vérifié par l'utilisateur).
- Après une fusion avec conflits, relire `package.json` et `.github/workflows/` pour vérifier qu'aucune mise à jour n'a été annulée.
- Après la fusion, proposer de supprimer la branche.
- Ajouter les fichiers un par un, jamais `git add .` ni `git add -A`.
- Ne jamais faire de force push ni réécrire l'historique sans accord.

## Travail en parallèle (plusieurs sessions)
- Au début de chaque tâche, vérifier avec `git status` et `git worktree list` qu'aucune autre session n'utilise le dossier courant.
- Si le dossier est occupé : travailler dans un worktree (`git worktree add .claude/worktrees/<nom> -b <branche> origin/main`).
- Une branche par session, jamais la même branche dans deux sessions.
- Répartition naturelle : une session sur `relay/`, une autre sur l'app. Une seule session à la fois modifie `package.json` et `package-lock.json`.
- Si deux sessions lancent `npx expo start`, la seconde utilise `--port 8082`.
- Avant de fusionner : `git merge main`, puis relancer les vérifications.
- À la fin : `git worktree remove .claude/worktrees/<nom>` et suppression de la branche.

## Build de l'APK
- Méthode unique : **GitHub Actions**, déclenchement manuel depuis l'onglet Actions. Deux workflows :
  - `build-dev-apk.yml` : **APK de développement** (avec `expo-dev-client`, installé sous le nom « ClosetA (dev) »), à réinstaller seulement quand une dépendance native ou une permission change. Entre deux, les modifications se voient en rechargeant l'app depuis `npx expo start`.
  - `build-apk.yml` : **APK de production**, signé, pour l'usage au quotidien.
- Les APK sont déposés comme artefacts (`closeta-dev-apk`, `closeta-apk`), conservés 7 jours.
- Avant chaque build : exécuter les vérifications de la section « Qualité du code ».
- **Erreurs connues et correctifs (hérités du projet Aube) :**
  - `generateInlineModules` (SyntaxError JSON) → `npm_config_warn: "false"` dans l'env du workflow (déjà en place).
  - `Could not get unknown property 'CLOSETA_...'` → passer les propriétés via `./gradlew -PKEY=VALUE`, pas via `gradle.properties`.
  - Dans les blocs `signingConfigs`, utiliser `project.getProperty('KEY')` plutôt que la variable nue `KEY`.
  - APK de production qui plante à l'ouverture alors que l'APK de dev marche → suspecter le compactage R8 : essayer `enableMinifyInReleaseBuilds: false` et `enableShrinkResourcesInReleaseBuilds: false` dans `expo-build-properties`.
- Donner les commandes exactes à copier-coller pour lancer un workflow (`gh workflow run …`) et le lien du build. Un build dure 20 à 30 minutes ; si la session a redémarré pendant un build, revérifier avec `gh run view <ID>` avant de conclure.
- Expliquer comment télécharger et installer l'APK (artefact → ZIP → `.apk`).
- Erreur Gradle en CI : diagnostiquer avec `gh run view <ID> --log`.

## Secrets
- Ne jamais créer ni modifier de secret GitHub ou Cloudflare, de keystore ou de mot de passe de signature : donner la marche à suivre à l'utilisateur.
- Ne jamais lire `.env*`, `.dev.vars`, `credentials.json`, `credentials/`, `*.jks`, `*.keystore` (lecture bloquée dans `.claude/settings.json`).

## Maîtrise des coûts
- Lire uniquement les fichiers nécessaires, pas tout le projet à chaque fois.
- Ne pas parcourir `node_modules/`, `.expo/`, `android/`, `ios/`, `dist/`, `build/`, `relay/.wrangler/`, les fichiers `*.apk` / `*.aab` ni `package-lock.json`.
- Prévenir l'utilisateur quand la conversation devient longue et suggérer de démarrer une nouvelle tâche.

## Documentation
- Tenir à jour `README.md` : objectif de l'app, lancement, construction des deux APK, déploiement du relais.
- Quand une étape change ce que prévoit la spec, le signaler et proposer la mise à jour de `docs/SPEC.md`.
