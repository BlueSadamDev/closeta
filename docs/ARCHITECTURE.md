# ClosetA — Architecture et passage à plusieurs utilisateurs

Analyse du 24 novembre 2026, après la fin du lot 3. Elle sert de référence pour le lot 4 (robustesse et catalogue partagé) et pour un futur lot « comptes et synchronisation ». Les prix cités ont été vérifiés le 24 novembre 2026 (sources en fin de document) ; ils changent, revérifier avant toute décision.

## 1. Principe actuel

```
Téléphone (une installation)       Cloudflare (relais)                Services externes
App ClosetA                        Worker : /v1/extract,              Pages des boutiques
  données en local (SQLite)  ───▶    /v1/identify, /v1/alternatives ─▶ Workers AI (vision)
  photos en local                  KV : installations                 SerpApi (Lens, Shopping)
  sauvegarde .closeta              Durable Object : quotas
                                   R2 : photos le temps d'une recherche
```

- **Local d'abord** : Wishlist, Vestiaire, relevés de prix et photos vivent sur le téléphone. Aucune base centrale de données personnelles.
- **Relais sans donnée personnelle** : il lit des pages, appelle l'IA et SerpApi, puis répond. Il ne garde que les installations (empreintes de jetons) et les compteurs de quota.

Ce choix rend l'app naturellement scalable : chaque nouvel utilisateur apporte son propre stockage (son téléphone), et le relais n'a rien à faire grossir.

## 2. Déjà en place pour plusieurs téléphones (lot 3, piste C)

- Un jeton par installation (empreintes dans KV), révocable ; jeton d'administration ; routes `/v1/admin/installations`.
- Quota SerpApi et limite de débit par installation, en plus du quota global.
- Routes versionnées `/v1` et version minimale de l'app (`VERSION_APP_MIN`).
- Configuration d'un téléphone par QR code ; relais déployable par un autre compte Cloudflare (variables GitHub, guide dans le README).
- Photos enregistrées par nom de fichier, table `suppression`, sauvegarde et restauration `.closeta`.

## 3. Coûts et passage à l'échelle

Le coût ne vient pas de Cloudflare mais des recherches SerpApi, payées une par une.

- **Cloudflare** : offre gratuite (100 000 requêtes par jour, 10 ms de calcul par requête) ; offre payante à 5 $ par mois et par compte, 10 millions de requêtes incluses par mois. Négligeable à notre échelle.
- **Workers AI** : 10 000 neurones gratuits par jour, puis 0,011 $ les 1 000 neurones (offre payante). Coût d'une analyse photo à mesurer dans le tableau de bord Cloudflare.
- **SerpApi** : 250 recherches gratuites par mois ; 25 $ pour 1 000 ; 75 $ pour 5 000 ; 275 $ pour 30 000. Les recherches identiques servies par le cache SerpApi (1 heure) sont gratuites.

Estimation, avec une **hypothèse de 20 recherches SerpApi par utilisateur actif et par mois** (photos et alternatives ; l'ajout par lien et la relecture des prix n'en consomment pas). À recaler sur les compteurs réels (`GET /v1/quota`).

| Taille | Formules | Coût mensuel | Par utilisateur |
| --- | --- | --- | --- |
| Cercle (≈ 12) | SerpApi gratuit, Cloudflare gratuit | 0 € | 0 € |
| ≈ 50 | SerpApi 1 000, Cloudflare payant | ≈ 30 $ | ≈ 0,60 $ |
| ≈ 250 | SerpApi 5 000, Cloudflare payant | ≈ 80 $ | ≈ 0,32 $ |
| ≈ 1 500 | SerpApi 30 000, Cloudflare payant, IA | ≈ 280 $ et plus | ≈ 0,19 $ |

Leviers pour contenir les coûts :

1. **Quotas par utilisateur** (en place) avec un plafond mensuel par défaut.
2. **Catalogue partagé et cache** (section 5) : ne jamais repayer une recherche déjà faite.
3. **Économie à la source** : lire d'abord les données publiées par la boutique, ne lancer Lens que si nécessaire.
4. **Modèle de financement**, à décider avant d'ouvrir l'app au public : gratuit limité, abonnement, ou « apporte ta clé SerpApi ».

Passer à l'offre payante Cloudflare (5 $ par mois) dès le premier utilisateur extérieur : elle lève le plafond de 1 000 écritures KV par jour, les 10 ms de calcul et la limite d'IA gratuite.

## 4. Faiblesses et solutions

| # | Faiblesse | Risque | Solution | Quand |
| --- | --- | --- | --- | --- |
| 1 | Compteurs de quota dans KV : lecture puis écriture séparées, mise à jour partout avec un délai, 1 000 écritures par jour en gratuit | Recherches comptées en trop ou en moins, dépassement, erreurs | Compteurs dans un **Durable Object** (comptage exact même en accès simultanés), disponible en gratuit avec SQLite | Lot 4, étape 1 : fait |
| 2 | Aucun cache de nos résultats au-delà de l'heure de SerpApi | Même recherche payée plusieurs fois | **Catalogue partagé et cache** dans D1 (section 5) | Lot 4 |
| 3 | Inscription par QR généré depuis le téléphone administrateur | Impossible au-delà de quelques proches | **Codes d'invitation** à usage unique (expiration 7 jours) ; plus tard, vraie inscription | Lot 4 |
| 4 | Pas de compte utilisateur | Téléphone perdu sans sauvegarde = données perdues ; pas de synchronisation | Sauvegarde `.closeta` (en place) ; comptes et synchronisation facultative (section 6) | Plus tard |
| 5 | Photos temporaires R2 supprimées seulement si la recherche va au bout | Photos oubliées après une coupure | **Règle d'expiration R2** : suppression automatique après 1 jour | Lot 4 |
| 6 | Recherche liée à SerpApi dans le code | Dépendance à un fournisseur et à ses prix | **Interface de recherche unique** (Lens, Shopping) derrière laquelle on peut changer ou combiner les fournisseurs | Lot 4 |
| 7 | Lecture des boutiques depuis les adresses Cloudflare | À gros volume, blocage par certains sites | Cache (une lecture par produit et par jour pour tous les utilisateurs), respect des conditions des sites | Lot 4 |
| 8 | Distribution par APK installé à la main | Mises à jour oubliées | **Vérification de mise à jour dans l'app** (dernière release GitHub) ; Play Store en test fermé à étudier | Lot 4 |
| 9 | Aucune supervision | Pannes et abus invisibles | Journaux structurés **sans donnée personnelle**, alerte quand un quota approche sa limite | Lot 4 |
| 10 | Cadre RGPD : responsable de traitement dès le premier autre utilisateur | Non-conformité | Politique de confidentialité, registre des traitements, liste des sous-traitants (Cloudflare, SerpApi, Google via Lens : transferts hors UE), consigne « pièce sur cintre » pour éviter les visages, identifiant d'installation pseudonyme | Lot 4 |

## 5. Catalogue partagé (Cloudflare D1)

### Objectifs

- **Économie** : un résultat de recherche ou une lecture de page déjà faits sont réutilisés, quel que soit l'utilisateur.
- **Historique de prix partagé** : un produit déjà connu arrive avec son historique (« prix le plus bas observé : 79 € en octobre »). Base du lot « plan d'achat » (soldes).
- **Recommandations** : proposer des pièces déjà connues avant de lancer une recherche payante (lot « style »).
- **Rapidité** : réponse immédiate quand le résultat est en base.

Le gain financier sera modeste tant que les utilisateurs sont peu nombreux (peu de recherches communes) ; il grandit avec eux. L'historique de prix est utile dès le premier utilisateur.

### Règles

- **Aucune donnée personnelle** : ni identifiant d'installation, ni jeton, ni lien entre une recherche et la personne qui l'a faite, ni photo d'utilisateur. Seulement des produits, des prix observés et des résultats de recherche.
- Les photos des utilisateurs ne servent de clé que sous forme d'**empreinte** (SHA-256 de la photo réduite), jamais conservées.
- Images des boutiques : **adresse web seulement**, jamais de copie.
- Purge nocturne des résultats expirés (tâche planifiée Cloudflare).

### Tables

| Table | Contenu |
| --- | --- |
| `produit` | adresse canonique de la page, boutique, nom, marque, adresse de l'image, catégorie, couleur, genre, première et dernière observation |
| `observation_prix` | produit, date, prix, devise, disponibilité globale et par taille |
| `recherche` | clé (type + entrée normalisée : URL d'image, empreinte de photo, requête Shopping, genre), résultats, date, expiration |

### Durées de conservation

| Donnée | Durée | Pourquoi |
| --- | --- | --- |
| Lecture d'une page produit | 24 h | Le prix et le stock bougent |
| Recherche Google Shopping | 3 à 7 jours | Les catalogues changent lentement |
| Recherche Lens sur l'image d'une boutique | 30 jours | Même image, mêmes résultats |
| Recherche Lens sur une photo (empreinte) | 30 jours | Même photo renvoyée (nouvel essai) |
| Historique des prix | Conservé | C'est la valeur du catalogue |

Capacité : l'offre gratuite de D1 (5 millions de lignes lues et 100 000 écrites par jour, 500 Mo par base) suffit largement pour des fiches et des relevés en texte.

### À vérifier avant le développement

- Conditions de SerpApi sur la conservation de ses résultats.
- Droit des bases de données des boutiques (protection contre l'extraction substantielle) : faible à notre échelle, à réévaluer avec le nombre d'utilisateurs.

### Règle à réécrire

Fait au lot 4, étape 2 : « le relais ne conserve rien » est devenu, dans CLAUDE.md et docs/SPEC.md, **le relais ne conserve aucune donnée personnelle** ; il garde un catalogue anonyme (produits, prix observés, résultats de recherche) aux durées ci-dessus.

## 6. Hors périmètre pour l'instant : comptes et synchronisation

À ouvrir quand le cercle d'utilisateurs et le modèle de financement seront décidés. Principes retenus :

- Rester **local d'abord** : la synchronisation est facultative, l'app fonctionne sans compte.
- Connexion par **lien magique par e-mail** (pas de mot de passe à gérer).
- Données de chaque utilisateur isolées (une base ou un Durable Object par utilisateur), photos dans R2, chiffrées au repos.
- Fondations déjà posées : identifiants UUID, table `suppression`, photos par nom de fichier, identifiant d'installation, routes versionnées.
- Partage d'une Wishlist entre utilisateurs : sur ces mêmes fondations, plus tard.

## Sources (consultées le 24 novembre 2026)

- [Cloudflare Workers — tarifs](https://developers.cloudflare.com/workers/platform/pricing/) et [limites](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers KV — tarifs](https://developers.cloudflare.com/kv/platform/pricing/)
- [Durable Objects — tarifs](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [D1 — tarifs](https://developers.cloudflare.com/d1/platform/pricing/) et [limites](https://developers.cloudflare.com/d1/platform/limits/)
- [Workers AI — tarifs](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [SerpApi — tarifs](https://serpapi.com/pricing) et [cache d'une heure](https://serpapi.com/google-shopping-api)
