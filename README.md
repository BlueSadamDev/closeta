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

## Relais Cloudflare

À venir (étape 4) : dossier `relay/`.
