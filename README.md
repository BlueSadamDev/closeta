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

## Construire les APK (GitHub Actions)

Les APK se construisent sur GitHub, sans rien installer. Onglet **Actions** du dépôt, choisir le workflow, puis **Run workflow** en sélectionnant la branche. Un build dure 20 à 30 minutes.

| Workflow | APK | Nom sur le téléphone | Secrets nécessaires |
| --- | --- | --- | --- |
| Build APK de développement | `closeta-dev-apk` | ClosetA (dev) | aucun |
| Build APK de production | `closeta-apk` | ClosetA | les 4 secrets de signature |

Récupérer l'APK : ouvrir le build terminé, section **Artifacts**, télécharger le ZIP (conservé 7 jours), l'ouvrir et installer le fichier `.apk` (autoriser l'installation d'applications inconnues si Android le demande).

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

Petit programme hébergé chez Cloudflare (gratuit). L'app lui envoie un lien produit ou une photo ; il renvoie ce qu'il a trouvé (une information introuvable reste vide). Il ne conserve rien.

- `POST /extract`, corps `{ "url": "https://…", "taille": "M" }` (`taille` facultative) : lit la page de la boutique et renvoie nom, marque, image, prix, devise, `disponibilite` et `dispo_taille` (`en_stock`, `epuise` ou `inconnue` si la boutique ne publie rien). N'accepte que des liens `https` publics.
- `POST /identify`, corps = la photo JPEG (`Content-Type: image/jpeg`, 2 Mo au plus) : l'IA de Cloudflare décrit la pièce, Google Lens (via SerpApi) cherche l'article, Google Shopping complète avec des alternatives. Renvoie de 0 à 5 résultats. La photo est déposée un instant dans le stockage R2 (Lens a besoin d'une adresse pour la lire, `GET /photo/<id>`), puis supprimée.
- `POST /alternatives`, corps JSON `{ image_url?, photo?, nom, marque, categorie, couleur, url_exclue }` (`photo` = JPEG en base64, seulement si la pièce n'a pas d'image de boutique) : Google Lens cherche des pièces qui ressemblent, classées par ressemblance (jamais par prix) ; la page d'origine, les réseaux sociaux et les résultats sans boutique sont écartés ; sous 3 résultats, Google Shopping complète. Renvoie de 0 à 5 résultats ; 1 ou 2 recherches SerpApi par appel.
- `GET /quota` : recherches SerpApi du mois, `{ "installation": { "utilise": 12, "limite": 250 }, "global": { "utilise": 37, "limite": 250 }, "mois": "2026-11" }` (le global est affiché dans les Réglages de l'app).
- Routes servies sous `/v1/…` (`/v1/extract`, `/v1/identify`, `/v1/alternatives`, `/v1/quota`) ; les adresses sans `/v1` restent des alias pour les anciens APK.
- En-tête `Authorization: Bearer <jeton>` obligatoire ; limite de 30 requêtes par minute et par installation. L'app envoie aussi `X-ClosetA-Installation` (identifiant du téléphone) et `X-ClosetA-Version` (version de l'app).
- Tests : `cd relay && npm ci && npm test`.

### Installations (un jeton par téléphone)

- Chaque téléphone peut avoir son propre jeton. Le relais n'en garde que l'empreinte SHA-256 (dans le même espace KV que le compteur), jamais le jeton lui-même. Un jeton révoqué est refusé (en moins d'une minute, délai de diffusion de KV).
- L'ancien jeton `RELAY_TOKEN` reste accepté : il compte comme l'installation « Principale ».
- Chaque recherche SerpApi compte dans la case de l'installation et dans la case globale ; le seuil global reste la limite dure. Seuil par installation : `SERPAPI_LIMITE_INSTALLATION` dans `wrangler.toml` (vide = même seuil que le global).
- Administration, avec le secret Cloudflare `ADMIN_TOKEN` (en-tête `Authorization: Bearer <jeton d'administration>`) :
  - `GET /v1/admin/installations` : liste (nom, date, active ou non, recherches du mois) ;
  - `POST /v1/admin/installations`, corps `{ "nom": "Téléphone de Léa" }` : crée l'installation et renvoie son jeton **une seule fois** ;
  - `DELETE /v1/admin/installations/<id>` : révoque l'installation.
- Version minimale de l'app : `VERSION_APP_MIN` dans `wrangler.toml` (vide = aucune exigence). Une app plus ancienne, ou qui n'envoie pas sa version (APK d'avant l'étape 9 du lot 3), reçoit `mise_a_jour_requise` (HTTP 426) et affiche « Mets ClosetA à jour pour continuer. »

### Configurer un téléphone (Réglages de l'app)

- **Relais** : adresse du relais (par défaut celle de `src/domain/settings.ts`), jeton, « Tester la connexion ». Les deux sont rangés dans le coffre du téléphone (`expo-secure-store`), jamais dans l'APK.
- **QR de configuration** : `closeta://config?relais=<adresse>&jeton=<jeton>`. « Scanner un QR de configuration » le lit avec l'appareil photo ; un QR lu par l'appareil photo d'Android ouvre aussi ClosetA. Une confirmation est toujours demandée avant d'enregistrer. Seules les adresses `https` sont acceptées. « Afficher le QR de ce téléphone » ne s'affiche qu'à la demande : le code contient le jeton.
- **Installations** : visible seulement quand un jeton d'administration (`ADMIN_TOKEN`) est saisi sur ce téléphone. Liste des téléphones (nom, date, recherches du mois), « Ajouter un téléphone » (nom, puis QR affiché une seule fois, à scanner depuis le nouveau téléphone), « Révoquer ».

### Mise en ligne

1. Une fois : secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` (Settings > Secrets and variables > Actions > onglet **Secrets**).
2. Une fois : variables GitHub `RELAIS_NOM_WORKER`, `RELAIS_KV_ID` et `RELAIS_BUCKET_R2` (même page, onglet **Variables**). Elles sont propres au compte Cloudflare : `relay/wrangler.toml` n'en contient aucune, le workflow les ajoute juste avant l'envoi et s'arrête avec un message clair s'il en manque une.
3. Onglet **Actions** > **Mettre en ligne le relais** > **Run workflow**.
4. Une fois, après la première mise en ligne : dans le tableau de bord Cloudflare, Workers & Pages > le Worker (`RELAIS_NOM_WORKER`) > Settings > Variables and Secrets, ajouter le secret `RELAY_TOKEN` (le jeton à saisir ensuite dans l'app). Il est conservé lors des mises en ligne suivantes.
5. Pour gérer plusieurs téléphones : ajouter de la même façon le secret `ADMIN_TOKEN` (jeton d'administration, différent de `RELAY_TOKEN`).

### Ajout par photo (`/identify`) : à préparer une fois, avant la mise en ligne

1. **Stockage R2** : tableau de bord Cloudflare > R2 > Create bucket, nom `closeta-photos-temp`. Puis dans le bucket : Settings > Object lifecycle rules > supprimer les objets après 1 jour (filet de sécurité).
2. **Jeton GitHub → Cloudflare** : le jeton du secret `CLOUDFLARE_API_TOKEN` doit avoir les droits « Workers R2 Storage : Edit » et « Workers AI : Read ».
3. **SerpApi** : créer un compte sur serpapi.com (offre gratuite), puis ajouter sa clé comme secret Cloudflare `SERPAPI_KEY` (même chemin que `RELAY_TOKEN`).
4. **Compteur des recherches** : l'espace Cloudflare KV `closeta-quota` (créé par `npx wrangler kv namespace create closeta-quota`, ou tableau de bord > Storage & Databases > Workers KV) compte les recherches SerpApi du mois du calendrier (heure de Paris). Son identifiant va dans la variable GitHub `RELAIS_KV_ID`. Le jeton `CLOUDFLARE_API_TOKEN` doit aussi avoir le droit « Workers KV Storage : Edit ». Le seuil se règle dans `wrangler.toml` (`SERPAPI_LIMITE_MOIS`, 250 par défaut) : une fois atteint, `/identify` et `/alternatives` répondent `quota_atteint` sans appeler SerpApi.
5. L'IA (Cloudflare Workers AI) ne demande ni compte ni clé : offre gratuite avec quota quotidien, qui s'arrête net une fois atteint. Le modèle se change dans `relay/src/settings.ts` (`modeleIA`).

## Installer son propre relais

Pour utiliser ClosetA avec **ton propre** relais (ton compte Cloudflare, ta clé SerpApi), sans dépendre de celui de quelqu'un d'autre. Tout est gratuit avec les offres de base. Compter une heure la première fois.

1. **Copier le dépôt** : sur GitHub, bouton **Fork** (une copie à toi, publique comme l'original). Les étapes suivantes se font dans ta copie.
2. **Compte Cloudflare** : créer un compte sur cloudflare.com (offre gratuite). Noter l'**Account ID** (tableau de bord > Workers & Pages, colonne de droite).
3. **Bucket R2** (photos temporaires) : tableau de bord > R2 > activer R2 (gratuit, une carte peut être demandée sans être débitée) > **Create bucket**, nom au choix, par exemple `closeta-photos-temp`. Dans le bucket : Settings > Object lifecycle rules > supprimer les objets après 1 jour.
4. **Espace KV** (compteur et installations) : tableau de bord > Storage & Databases > Workers KV > **Create**, nom `closeta-quota`. Noter son **ID** (32 caractères).
5. **Jeton d'API Cloudflare** (permet à GitHub de mettre le relais en ligne) : My Profile > API Tokens > **Create Token** > modèle « Edit Cloudflare Workers ». Vérifier qu'il contient « Workers Scripts : Edit », « Workers KV Storage : Edit » et « Workers R2 Storage : Edit », ajouter « Workers AI : Read », puis créer et copier le jeton (il ne s'affiche qu'une fois).
6. **SerpApi** (recherche par photo et alternatives) : créer un compte sur serpapi.com (offre gratuite, 250 recherches par mois), copier la clé (Dashboard > Your Private API Key).
7. **Secrets GitHub** (ta copie > Settings > Secrets and variables > Actions > onglet **Secrets** > New repository secret) :
   - `CLOUDFLARE_API_TOKEN` : le jeton de l'étape 5 ;
   - `CLOUDFLARE_ACCOUNT_ID` : l'Account ID de l'étape 2.
8. **Variables GitHub** (même page, onglet **Variables** > New repository variable) :
   - `RELAIS_NOM_WORKER` : nom du relais, en minuscules et tirets, par exemple `closeta-relay` (il fait partie de l'adresse) ;
   - `RELAIS_KV_ID` : l'ID de l'étape 4 ;
   - `RELAIS_BUCKET_R2` : le nom du bucket de l'étape 3.
9. **Première mise en ligne** : onglet **Actions** > activer les workflows si GitHub le demande > **Mettre en ligne le relais** > **Run workflow**. À la fin, l'adresse du relais s'affiche dans le journal de l'étape « Mettre en ligne sur Cloudflare », de la forme `https://<RELAIS_NOM_WORKER>.<ton-sous-domaine>.workers.dev`.
10. **Secrets Cloudflare** (tableau de bord > Workers & Pages > ton relais > Settings > Variables and Secrets > Add, type **Secret**) :
    - `SERPAPI_KEY` : la clé de l'étape 6 ;
    - `RELAY_TOKEN` : le jeton de ton premier téléphone ;
    - `ADMIN_TOKEN` : ton jeton d'administration, différent du précédent.
    Pour fabriquer un jeton : une longue suite de lettres et de chiffres sans espace (40 caractères ou plus), par exemple tirée d'un gestionnaire de mots de passe. Les garder dans ce gestionnaire : Cloudflare ne les réaffiche jamais.
11. **Premier téléphone** : installer l'APK (voir « Construire les APK »), puis Réglages > Relais : saisir l'adresse de l'étape 9 et le jeton `RELAY_TOKEN`, **Enregistrer**, **Tester la connexion**.
12. **Premier jeton d'administration** : sur ce même téléphone, Réglages > Installations : coller `ADMIN_TOKEN`, **Enregistrer**. La liste des installations apparaît (« Principale » = le jeton `RELAY_TOKEN`).
13. **Autres téléphones** : « Ajouter un téléphone », donner un nom, puis sur le nouveau téléphone, Réglages > « Scanner un QR de configuration ». Le QR ne s'affiche qu'une fois ; en cas de perte, révoquer et recommencer.

Le relais ne garde ni les photos (supprimées juste après la recherche) ni les pages lues ; seuls les compteurs du mois et les empreintes des jetons sont conservés dans KV.
