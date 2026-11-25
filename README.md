# ClosetA

Application Android personnelle pour suivre une wishlist de vêtements et de chaussures. Un article acheté passe au Vestiaire.
Usage strictement personnel : pas de Play Store, pas de comptes.

- Fonctionnalités prévues : [docs/SPEC.md](docs/SPEC.md)
- Identité visuelle et textes : [DESIGN.md](DESIGN.md)
- Règles de travail : [CLAUDE.md](CLAUDE.md)

## Technologies

Expo (React Native, TypeScript), expo-router pour les écrans, SQLite pour les données (stockées uniquement sur le téléphone).

## Lancer le projet sur un ordinateur

```bash
npm ci            # installe les dépendances
npx expo start    # lance le serveur de développement (pour l'APK de développement)
```

Vérifications avant un build :

```bash
npx expo-doctor
npx expo lint
npx tsc --noEmit
npx jest
```

## Sauvegarder et restaurer ses données

Les données ne quittent jamais le téléphone, sauf par une sauvegarde lancée à la main.

- **Sauvegarder** (Réglages > Sauvegarde) : crée un fichier `closeta-AAAA-MM-JJ.closeta` (pièces de la Wishlist et du Vestiaire, historique des prix, photos) et ouvre le partage d'Android pour le ranger (Drive, mail, fichiers…). Le fichier ne contient ni jeton, ni jeton d'administration, ni adresse du relais, ni identifiant d'installation : après une restauration sur un nouveau téléphone, configurer le relais (Réglages > Relais ou QR).
- **Restaurer** : choisir un fichier `.closeta` ; l'app affiche son résumé (« 42 pièces, 37 photos ») et, après « Remplacer », **remplace toutes les données du téléphone**. Un fichier abîmé ou venant d'une version plus récente de l'app est refusé sans rien toucher.
- Une sauvegarde passe d'un téléphone à l'autre, et de l'APK de développement à celui de production (la base ne garde que le nom des photos, leur dossier est recalculé sur chaque téléphone).

## Construire les APK (GitHub Actions)

Les APK se construisent sur GitHub, sans rien installer. Onglet **Actions** du dépôt, choisir le workflow, puis **Run workflow** en sélectionnant la branche. Un build dure 20 à 30 minutes.

| Workflow | APK | Nom sur le téléphone | Secrets nécessaires |
| --- | --- | --- | --- |
| Build APK de développement | `closeta-dev-apk` | ClosetA (dev) | aucun |
| Build APK de production | `closeta-apk` | ClosetA | les 4 secrets de signature |

Récupérer l'APK : ouvrir le build terminé, section **Artifacts**, télécharger le ZIP (conservé 7 jours), l'ouvrir et installer le fichier `.apk` (autoriser l'installation d'applications inconnues si Android le demande).

**Releases (APK de production)** : chaque APK de production est aussi publié dans une release GitHub `vX.Y.Z` (version lue dans `app.json`, fichier `closeta-X.Y.Z.apk`, sans limite de durée). **Avant chaque build de production, augmenter `expo.version` dans `app.json`** (par exemple `1.0.0` → `1.1.0`) : le workflow refuse une version qui a déjà sa release. Le relais lit la dernière release (`GET /v1/version`, dépôt donné par `DEPOT_RELEASES` dans `relay/wrangler.toml`) et l'app affiche, au plus une fois par jour, le bandeau « Nouvelle version 1.2.0 disponible » en haut de la Wishlist.

### Secrets de signature (APK de production)

À créer une seule fois, dans **Settings > Secrets and variables > Actions** :
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`.
Garder une copie du keystore en lieu sûr : sans lui, les mises à jour de l'app ne pourront plus s'installer par-dessus l'ancienne version.

## Images de la marque

Les PNG de `assets/images/` (icône, écran de démarrage) sont générés à partir des SVG de `assets/brand/` :

```bash
node scripts/generate-brand-images.js
```

## Polices

Cormorant Garamond et Jost, sous licence SIL Open Font License (fichiers de licence dans `assets/fonts/`).

## Relais Cloudflare (dossier `relay/`)

Petit programme hébergé chez Cloudflare (gratuit). L'app lui envoie un lien produit ou une photo ; il renvoie ce qu'il a trouvé (une information introuvable reste vide). Il ne conserve aucune donnée personnelle (voir « Catalogue partagé » ci-dessous).

- `POST /extract`, corps `{ "url": "https://…", "taille": "M" }` (`taille` facultative) : lit la page de la boutique et renvoie nom, marque, image, prix, devise, `disponibilite` et `dispo_taille` (`en_stock`, `epuise` ou `inconnue` si la boutique ne publie rien). N'accepte que des liens `https` publics.
- `POST /identify[?genre=femme|homme]`, corps = la photo JPEG (`Content-Type: image/jpeg`, 2 Mo au plus) : l'IA de Cloudflare décrit la pièce, Google Lens (via SerpApi) cherche l'article, Google Shopping complète avec des alternatives. Renvoie de 0 à 5 résultats. La photo est déposée un instant dans le stockage R2 (Lens a besoin d'une adresse pour la lire, `GET /photo/<id>`), puis supprimée.
- `POST /alternatives`, corps JSON `{ image_url?, photo?, nom, marque, categorie, couleur, url_exclue, genre? }` (`photo` = JPEG en base64, seulement si la pièce n'a pas d'image de boutique ; `genre` = `femme` ou `homme`, choix « Je cherche pour » des Réglages, absent = mixte) : Google Lens cherche des pièces qui ressemblent, classées par ressemblance (jamais par prix) ; la page d'origine, les réseaux sociaux et les résultats sans boutique sont écartés ; sous 3 résultats, Google Shopping complète. Avec un genre, il est ajouté à la recherche Shopping et les résultats nommés pour l'autre genre sont écartés (sur `/identify`, seulement pour les alternatives Shopping). Renvoie de 0 à 5 résultats ; 1 ou 2 recherches SerpApi par appel.
- `GET /quota` : recherches SerpApi du mois, `{ "installation": { "utilise": 12, "limite": 250 }, "global": { "utilise": 37, "limite": 250 }, "mois": "2026-11" }` (le global est affiché dans les Réglages de l'app).
- Routes servies sous `/v1/…` (`/v1/extract`, `/v1/identify`, `/v1/alternatives`, `/v1/quota`) ; les adresses sans `/v1` restent des alias pour les anciens APK.
- En-tête `Authorization: Bearer <jeton>` obligatoire ; limite de 30 requêtes par minute et par installation. L'app envoie aussi `X-ClosetA-Installation` (identifiant du téléphone) et `X-ClosetA-Version` (version de l'app).
- Tests : `cd relay && npm ci && npm test`.

### Catalogue partagé (Cloudflare D1)

- Base D1 `closeta-catalogue` (lien `CATALOGUE`), tables créées par les fichiers de `relay/migrations/` à chaque mise en ligne. Elle est **anonyme** : produits, prix observés et résultats de recherche ; jamais de jeton, d'identifiant d'installation, d'adresse IP ni de photo (une photo ne sert de clé que par son empreinte SHA-256).
- `/extract` : une page lue il y a moins de 24 h (par n'importe quel téléphone) est servie depuis le catalogue, sans la relire. L'adresse est comparée sans ses paramètres de suivi (`utm_*`, `gclid`, `fbclid`…). Un nouveau relevé de prix n'est ajouté que si le prix ou la disponibilité a changé ; l'historique est conservé.
- `/identify` et `/alternatives` : une recherche Google Lens ou Shopping déjà faite (même entrée, même genre) est réutilisée **sans consommer le quota**, même quand il est atteint : Shopping 7 jours, Lens 30 jours.
- Les trois réponses indiquent `depuis_cache: true` quand rien n'a été relu ni payé.
- Purge des recherches expirées chaque nuit à 3 h UTC (tâche planifiée, `[triggers]` dans `wrangler.toml`). Durées dans `relay/src/settings.ts`.
- Sans base D1 ou en cas de panne, le relais fonctionne comme avant, sans cache.

### Installations (un jeton par téléphone)

- Chaque téléphone peut avoir son propre jeton. Le relais n'en garde que l'empreinte SHA-256 (dans le même espace KV que le compteur), jamais le jeton lui-même. Un jeton révoqué est refusé (en moins d'une minute, délai de diffusion de KV).
- L'ancien jeton `RELAY_TOKEN` reste accepté : il compte comme l'installation « Principale ».
- Chaque recherche SerpApi compte dans la case de l'installation et dans la case globale ; le seuil global reste la limite dure. Seuil par installation : `SERPAPI_LIMITE_INSTALLATION` dans `wrangler.toml` (vide = même seuil que le global).
- Administration, avec le secret Cloudflare `ADMIN_TOKEN` (en-tête `Authorization: Bearer <jeton d'administration>`) :
  - `GET /v1/admin/installations` : liste (nom, date, active ou non, recherches du mois) ;
  - `POST /v1/admin/installations`, corps `{ "nom": "Téléphone de Léa" }` : crée l'installation et renvoie son jeton **une seule fois** ;
  - `DELETE /v1/admin/installations/<id>` : révoque l'installation ;
  - `POST /v1/admin/invitations`, corps `{ "nom": "Téléphone de Léa" }` : crée une invitation et renvoie son code (`CLST-7K4Q-9M2P`) **une seule fois** ; `GET /v1/admin/invitations` : invitations en attente ; `DELETE /v1/admin/invitations/<id>` : annule une invitation.
- Codes d'invitation : `POST /v1/invitations/utiliser`, corps `{ "code": "CLST-7K4Q-9M2P" }`, **sans jeton** : crée l'installation prévue et renvoie son jeton une seule fois. Le code sert une fois, 7 jours au plus ; seule son empreinte est gardée, dans le Durable Object `Quota`. Limite : 5 essais par minute et par adresse (`LIMITEUR_INVITATION`).
- Version minimale de l'app : `VERSION_APP_MIN` dans `wrangler.toml` (vide = aucune exigence). Une app plus ancienne, ou qui n'envoie pas sa version (APK d'avant l'étape 9 du lot 3), reçoit `mise_a_jour_requise` (HTTP 426) et affiche « Mets ClosetA à jour pour continuer. »

### Configurer un téléphone (Réglages de l'app)

- **Relais** : adresse du relais (par défaut celle de `src/domain/settings.ts`), jeton, « Tester la connexion ». Les deux sont rangés dans le coffre du téléphone (`expo-secure-store`), jamais dans l'APK.
- **QR de configuration** : `closeta://config?relais=<adresse>&jeton=<jeton>`. « Scanner un QR de configuration » le lit avec l'appareil photo ; un QR lu par l'appareil photo d'Android ouvre aussi ClosetA. Une confirmation est toujours demandée avant d'enregistrer. Seules les adresses `https` sont acceptées. « Afficher le QR de ce téléphone » ne s'affiche qu'à la demande : le code contient le jeton.
- **Installations** : visible seulement quand un jeton d'administration (`ADMIN_TOKEN`) est saisi sur ce téléphone. Liste des téléphones (nom, date, recherches du mois), « Ajouter un téléphone » (nom, puis QR affiché une seule fois, à scanner depuis le nouveau téléphone), « Révoquer ». « Inviter quelqu'un » (nom, puis code, QR et bouton « Partager l'invitation ») ; invitations en attente avec « Annuler ».
- **Invitation** : `closeta://invitation?relais=<adresse>&code=<code>`, sans jeton, donc partageable par message. « J'ai un code d'invitation » (saisie du code pour le relais de ce téléphone), lien ouvert par Android ou QR scanné : confirmation, puis jeton rangé dans le coffre.

### Mise en ligne

1. Une fois : secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` (Settings > Secrets and variables > Actions > onglet **Secrets**).
2. Une fois : variables GitHub `RELAIS_NOM_WORKER`, `RELAIS_KV_ID`, `RELAIS_BUCKET_R2` et `RELAIS_D1_ID` (même page, onglet **Variables**). Elles sont propres au compte Cloudflare : `relay/wrangler.toml` n'en contient aucune, le workflow les ajoute juste avant l'envoi et s'arrête avec un message clair s'il en manque une.
3. Onglet **Actions** > **Mettre en ligne le relais** > **Run workflow**.
4. Une fois, après la première mise en ligne : dans le tableau de bord Cloudflare, Workers & Pages > le Worker (`RELAIS_NOM_WORKER`) > Settings > Variables and Secrets, ajouter le secret `RELAY_TOKEN` (le jeton à saisir ensuite dans l'app). Il est conservé lors des mises en ligne suivantes.
5. Pour gérer plusieurs téléphones : ajouter de la même façon le secret `ADMIN_TOKEN` (jeton d'administration, différent de `RELAY_TOKEN`).

### Ajout par photo (`/identify`) : à préparer une fois, avant la mise en ligne

1. **Stockage R2** : tableau de bord Cloudflare > R2 > Create bucket, nom `closeta-photos-temp`, emplacement **Specify jurisdiction > European Union** (données dans l'UE) ; variable GitHub `RELAIS_R2_JURIDICTION` = `eu`. Puis dans le bucket : Settings > Object lifecycle rules > supprimer les objets après 1 jour (filet de sécurité).
2. **Jeton GitHub → Cloudflare** : le jeton du secret `CLOUDFLARE_API_TOKEN` doit avoir les droits « Workers R2 Storage : Edit » et « Workers AI : Read ».
3. **SerpApi** : créer un compte sur serpapi.com (offre gratuite), puis ajouter sa clé comme secret Cloudflare `SERPAPI_KEY` (même chemin que `RELAY_TOKEN`).
4. **Installations et compteur des recherches** : l'espace Cloudflare KV `closeta-quota` (créé par `npx wrangler kv namespace create closeta-quota`, ou tableau de bord > Storage & Databases > Workers KV) garde la liste des installations. Son identifiant va dans la variable GitHub `RELAIS_KV_ID`. Le jeton `CLOUDFLARE_API_TOKEN` doit aussi avoir le droit « Workers KV Storage : Edit ». Les recherches SerpApi du mois du calendrier (heure de Paris) sont comptées par un Durable Object `Quota`, déclaré dans `wrangler.toml` et créé tout seul à la mise en ligne (rien à préparer). Le seuil se règle dans `wrangler.toml` (`SERPAPI_LIMITE_MOIS`, 250 par défaut) : une fois atteint, `/identify` et `/alternatives` répondent `quota_atteint` sans appeler SerpApi.
5. **Catalogue partagé** : tableau de bord Cloudflare > Storage & Databases > D1 SQL Database > **Create Database**, nom `closeta-catalogue`, emplacement **Jurisdiction > European Union** (ou `npx wrangler d1 create closeta-catalogue --jurisdiction eu`). Son **Database ID** (36 caractères) va dans la variable GitHub `RELAIS_D1_ID`. Le jeton `CLOUDFLARE_API_TOKEN` doit avoir le droit « D1 : Edit » (le workflow crée les tables).
6. **Juridiction des compteurs et des invitations** : `JURIDICTION_DONNEES = "eu"` dans `relay/wrangler.toml` place le Durable Object `Quota` dans l'UE. Au premier appel, il reprend le contenu de l'ancien exemplaire (sans juridiction), qui l'efface. Si Cloudflare refuse la juridiction, vider la valeur et remettre en ligne.
7. L'IA (Cloudflare Workers AI) ne demande ni compte ni clé : offre gratuite avec quota quotidien, qui s'arrête net une fois atteint. Le modèle se change dans `relay/src/settings.ts` (`modeleIA`).

## Installer son propre relais

Pour utiliser ClosetA avec **ton propre** relais (ton compte Cloudflare, ta clé SerpApi), sans dépendre de celui de quelqu'un d'autre. Tout est gratuit avec les offres de base. Compter une heure la première fois.

1. **Copier le dépôt** : sur GitHub, bouton **Fork** (une copie à toi, publique comme l'original). Les étapes suivantes se font dans ta copie.
2. **Compte Cloudflare** : créer un compte sur cloudflare.com (offre gratuite). Noter l'**Account ID** (tableau de bord > Workers & Pages, colonne de droite).
3. **Bucket R2** (photos temporaires) : tableau de bord > R2 > activer R2 (gratuit, une carte peut être demandée sans être débitée) > **Create bucket**, nom au choix, par exemple `closeta-photos-temp`, emplacement **Specify jurisdiction > European Union** (puis variable GitHub `RELAIS_R2_JURIDICTION` = `eu`). Dans le bucket : Settings > Object lifecycle rules > supprimer les objets après 1 jour.
4. **Espace KV** (compteur et installations) : tableau de bord > Storage & Databases > Workers KV > **Create**, nom `closeta-quota`. Noter son **ID** (32 caractères).
   **Base D1** (catalogue partagé) : tableau de bord > Storage & Databases > D1 SQL Database > **Create Database**, nom `closeta-catalogue`, emplacement **Jurisdiction > European Union**. Noter son **Database ID** (36 caractères, avec des tirets).
5. **Jeton d'API Cloudflare** (permet à GitHub de mettre le relais en ligne) : My Profile > API Tokens > **Create Token** > modèle « Edit Cloudflare Workers ». Vérifier qu'il contient « Workers Scripts : Edit », « Workers KV Storage : Edit » et « Workers R2 Storage : Edit », ajouter « Workers AI : Read » et « D1 : Edit », puis créer et copier le jeton (il ne s'affiche qu'une fois).
6. **SerpApi** (recherche par photo et alternatives) : créer un compte sur serpapi.com (offre gratuite, 250 recherches par mois), copier la clé (Dashboard > Your Private API Key).
7. **Secrets GitHub** (ta copie > Settings > Secrets and variables > Actions > onglet **Secrets** > New repository secret) :
   - `CLOUDFLARE_API_TOKEN` : le jeton de l'étape 5 ;
   - `CLOUDFLARE_ACCOUNT_ID` : l'Account ID de l'étape 2.
8. **Variables GitHub** (même page, onglet **Variables** > New repository variable) :
   - `RELAIS_NOM_WORKER` : nom du relais, en minuscules et tirets, par exemple `closeta-relay` (il fait partie de l'adresse) ;
   - `RELAIS_KV_ID` : l'ID de l'étape 4 ;
   - `RELAIS_BUCKET_R2` : le nom du bucket de l'étape 3 ;
   - `RELAIS_D1_ID` : le Database ID de la base D1 de l'étape 4.
9. **Première mise en ligne** : onglet **Actions** > activer les workflows si GitHub le demande > **Mettre en ligne le relais** > **Run workflow**. À la fin, l'adresse du relais s'affiche dans le journal de l'étape « Mettre en ligne sur Cloudflare », de la forme `https://<RELAIS_NOM_WORKER>.<ton-sous-domaine>.workers.dev`.
10. **Secrets Cloudflare** (tableau de bord > Workers & Pages > ton relais > Settings > Variables and Secrets > Add, type **Secret**) :
    - `SERPAPI_KEY` : la clé de l'étape 6 ;
    - `RELAY_TOKEN` : le jeton de ton premier téléphone ;
    - `ADMIN_TOKEN` : ton jeton d'administration, différent du précédent.
    Pour fabriquer un jeton : une longue suite de lettres et de chiffres sans espace (40 caractères ou plus), par exemple tirée d'un gestionnaire de mots de passe. Les garder dans ce gestionnaire : Cloudflare ne les réaffiche jamais.
11. **Premier téléphone** : installer l'APK (voir « Construire les APK »), puis Réglages > Relais : saisir l'adresse de l'étape 9 et le jeton `RELAY_TOKEN`, **Enregistrer**, **Tester la connexion**.
12. **Premier jeton d'administration** : sur ce même téléphone, Réglages > Installations : coller `ADMIN_TOKEN`, **Enregistrer**. La liste des installations apparaît (« Principale » = le jeton `RELAY_TOKEN`).
13. **Autres téléphones** : « Ajouter un téléphone », donner un nom, puis sur le nouveau téléphone, Réglages > « Scanner un QR de configuration ». Le QR ne s'affiche qu'une fois ; en cas de perte, révoquer et recommencer.

Le relais ne garde aucune donnée personnelle : les photos sont supprimées juste après la recherche ; KV garde les empreintes des jetons, le Durable Object `Quota` les compteurs du mois, et la base D1 un catalogue anonyme (produits, prix observés, résultats de recherche).
