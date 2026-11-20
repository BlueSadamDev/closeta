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
- Sauvegarde uniquement par export manuel d'un fichier, déclenché par l'utilisateur (hors lot 1).

## Relais Cloudflare
- Les clés d'API (IA, SerpApi) sont des secrets Cloudflare (`wrangler secret put`), jamais dans `wrangler.toml` ni dans le code.
- `wrangler.toml` ne contient pas l'identifiant du compte : il est fourni par la variable d'environnement `CLOUDFLARE_ACCOUNT_ID`.
- Le relais refuse toute requête sans jeton valide (en-tête `Authorization`) et limite le débit à 30 requêtes par minute.
- `/extract` n'accepte que des URL `https` publiques (pas d'adresse IP locale ou privée).
- Le relais ne conserve rien. Exception au lot 1b : si SerpApi Lens exige une URL d'image, dépôt temporaire dans Cloudflare R2, supprimé juste après la recherche.
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
4. Écran Réglages (saisie et test du jeton) ; choix du mode d'ajout (feuille du bas). **Terminée, fusionnée via la PR #5** : Réglages (jeton dans le coffre du téléphone, test de connexion, version), feuille « Ajouter une pièce ».
5. Ajout par lien dans l'app et partage Android (« Partager → ClosetA ») → fin du lot 1a.
6. Vue par catégorie : Wishlist regroupée en sections par catégorie, avec sous-totaux.
7. Relais `/identify` + parcours photo → fin du lot 1b. Recherche visuelle : SerpApi (API Google Lens ; alternatives via Google Shopping à partir de la description IA).

Tenir cette liste à jour : marquer chaque étape « terminée, fusionnée via la PR #n » avec une ligne de résumé.

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
