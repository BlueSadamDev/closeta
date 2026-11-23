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

- `POST /extract`, corps `{ "url": "https://…" }` : lit la page de la boutique et renvoie nom, marque, image, prix et devise. N'accepte que des liens `https` publics.
- `POST /identify`, corps = la photo JPEG (`Content-Type: image/jpeg`, 2 Mo au plus) : l'IA de Cloudflare décrit la pièce, Google Lens (via SerpApi) cherche l'article, Google Shopping complète avec des alternatives. Renvoie de 0 à 5 résultats. La photo est déposée un instant dans le stockage R2 (Lens a besoin d'une adresse pour la lire, `GET /photo/<id>`), puis supprimée.
- `POST /alternatives`, corps JSON `{ image_url?, photo?, nom, marque, categorie, couleur, url_exclue }` (`photo` = JPEG en base64, seulement si la pièce n'a pas d'image de boutique) : Google Lens cherche des pièces qui ressemblent, classées par ressemblance (jamais par prix) ; la page d'origine, les réseaux sociaux et les résultats sans boutique sont écartés ; sous 3 résultats, Google Shopping complète. Renvoie de 0 à 5 résultats ; 1 ou 2 recherches SerpApi par appel.
- `GET /quota` : recherches SerpApi du mois, `{ "utilise": 37, "limite": 250, "mois": "2026-11" }` (affiché dans les Réglages de l'app).
- En-tête `Authorization: Bearer <jeton>` obligatoire ; limite de 30 requêtes par minute.
- Tests : `cd relay && npm ci && npm test`.

### Mise en ligne

1. Une fois : secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` (Settings > Secrets and variables > Actions).
2. Onglet **Actions** > **Mettre en ligne le relais** > **Run workflow**.
3. Une fois, après la première mise en ligne : dans le tableau de bord Cloudflare, Workers & Pages > `closeta-relay` > Settings > Variables and Secrets, ajouter le secret `RELAY_TOKEN` (le jeton à saisir ensuite dans l'app). Il est conservé lors des mises en ligne suivantes.

### Ajout par photo (`/identify`) : à préparer une fois, avant la mise en ligne

1. **Stockage R2** : tableau de bord Cloudflare > R2 > Create bucket, nom `closeta-photos-temp`. Puis dans le bucket : Settings > Object lifecycle rules > supprimer les objets après 1 jour (filet de sécurité).
2. **Jeton GitHub → Cloudflare** : le jeton du secret `CLOUDFLARE_API_TOKEN` doit avoir les droits « Workers R2 Storage : Edit » et « Workers AI : Read ».
3. **SerpApi** : créer un compte sur serpapi.com (offre gratuite), puis ajouter sa clé comme secret Cloudflare `SERPAPI_KEY` (même chemin que `RELAY_TOKEN`).
4. **Compteur des recherches** : l'espace Cloudflare KV `closeta-quota` (créé par `npx wrangler kv namespace create closeta-quota`, ou tableau de bord > Storage & Databases > Workers KV) compte les recherches SerpApi du mois du calendrier (heure de Paris). Son identifiant est dans `relay/wrangler.toml`. Le jeton `CLOUDFLARE_API_TOKEN` doit aussi avoir le droit « Workers KV Storage : Edit ». Le seuil se règle dans `wrangler.toml` (`SERPAPI_LIMITE_MOIS`, 250 par défaut) : une fois atteint, `/identify` et `/alternatives` répondent `quota_atteint` sans appeler SerpApi.
5. L'IA (Cloudflare Workers AI) ne demande ni compte ni clé : offre gratuite avec quota quotidien, qui s'arrête net une fois atteint. Le modèle se change dans `relay/src/settings.ts` (`modeleIA`).
