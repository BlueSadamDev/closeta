# ClosetA — Confidentialité

> **Version 1, validée le 25 novembre 2026.** Rédigé le 24 novembre 2026 (lot 4, étape 8) à partir du code relu sur `main` : app (`src/`), relais (`relay/src/`, `relay/wrangler.toml`) et workflows. Décisions de l'utilisateur intégrées le 24 novembre 2026 (voir aussi docs/SPEC.md, « Lot 4 », « Décisions de confidentialité »). Les mentions **[à vérifier]** signalent une information qui ne vient pas du code (engagements d'un fournisseur) et qui n'a pas pu être confirmée sur la source officielle. Les mentions **[prévu]** décrivent une mesure décidée, pas encore en place dans le code.

Ce document décrit les données que ClosetA traite, pourquoi, où, combien de temps et avec qui. Il couvre trois lieux :

1. **le téléphone**, où vivent la Wishlist, le Vestiaire et les photos ;
2. **le relais**, un programme sur Cloudflare qui lit les pages des boutiques et lance les recherches visuelles ;
3. **le catalogue partagé** du relais, une base anonyme de pièces et de prix, ajoutée au lot 4.

Le registre des traitements est dans [REGISTRE.md](REGISTRE.md).

---

## 1. Responsable du traitement et contact

ClosetA n'a ni compte utilisateur, ni publicité, ni statistiques d'usage, ni outil de suivi des plantages. Chaque relais est installé et administré par une personne (« l'administrateur du relais ») qui en distribue l'accès.

Deux situations :

| Situation | Qualification proposée |
| --- | --- |
| L'administrateur utilise seul son relais, depuis ses propres téléphones | Activité strictement personnelle : exemption domestique (RGPD, art. 2.2.c et considérant 18). Ce document sert alors de documentation, pas d'obligation. |
| L'administrateur donne l'accès à d'autres personnes (jeton d'installation, QR de configuration, code d'invitation au lot 4) | L'administrateur est **responsable du traitement** des données de ces personnes qui transitent par son relais, ou y sont gardées. Cloudflare et SerpApi sont ses **sous-traitants**. |

- Responsable : l'administrateur du relais.
- Contact pour toute question ou demande d'exercice des droits : **dpo@closeta.fr**
- Délégué à la protection des données : aucun désigné (non obligatoire, art. 37). L'adresse ci-dessus est une boîte de contact générique.

Le dépôt GitHub du code et l'auteur de l'app ne reçoivent aucune donnée des utilisateurs. Le dépôt sert seulement à télécharger l'APK (voir § 6).

---

## 2. Sur le téléphone

Ces données restent sur le téléphone. L'administrateur du relais n'y a pas accès.

| Données | Où | Détail |
| --- | --- | --- |
| Pièces de la Wishlist et du Vestiaire | Base SQLite de l'app | Nom, marque, type, catégorie, taille, couleur, prix, devise, lien de la boutique, adresse de l'image d'origine, priorité, notes libres, statut, origine (manuel, lien, photo), date d'ajout, d'achat, de mise à jour, disponibilité, date de dernière vérification, lien vers la pièce d'origine d'une alternative. |
| Historique des prix | Table `releve_prix` | Prix et disponibilité relevés pour une pièce, avec leur date et leur source. |
| Traces de suppression | Table `suppression` | Identifiant de la ligne supprimée, nom de la table, date. Sert à la sauvegarde (pas de contenu de la pièce). |
| Photos | Dossier privé de l'app | Photos prises par l'utilisateur et images des boutiques copiées. Elles sont réencodées en JPEG par l'app (`expo-image-manipulator`) et demandées sans EXIF (`exif: false`). **[à vérifier sur une vraie photo : absence de position GPS dans le fichier rangé]** |
| Coffre du téléphone (`expo-secure-store`, chiffré par Android) | Keystore Android | Jeton du relais, jeton d'administration (s'il est saisi), adresse du relais, identifiant d'installation (UUID tiré au hasard au premier lancement), réglage « Je cherche pour ». |

**Notes libres et photos** : l'utilisateur peut y mettre ce qu'il veut, y compris des données personnelles. L'app ne les envoie jamais au relais, sauf la photo dans les cas décrits au § 3.

**Détourage des photos (Vestiaire)** : il se fait **sur le téléphone**, avec Google ML Kit (Subject Segmentation, fourni par les services Google Play). La photo ne quitte pas le téléphone pour ce traitement. Selon la page de Google, ML Kit collecte des informations sur l'appareil (fabricant, modèle, version d'Android, accélérateurs disponibles) pour du diagnostic et des statistiques d'usage. Ces données sont envoyées à Google en HTTPS, Google agissant comme responsable de son propre traitement. **[à vérifier : liste exacte des données pour Subject Segmentation]**

**Sauvegarde manuelle** : la section « Sauvegarde » des Réglages crée un fichier `.closeta` (pièces, relevés, suppressions, photos, sans aucun jeton ni identifiant d'installation). L'utilisateur choisit où l'envoyer (feuille de partage d'Android). La destination est sous sa seule responsabilité.

**Sauvegarde automatique d'Android : désactivée** (`android.allowBackup: false` dans `app.json`, depuis l'étape 8 du lot 4). Android ne copie donc ni la base, ni les photos, ni le coffre dans la sauvegarde du compte Google. Les APK construits avant cette étape laissaient la valeur par défaut d'Expo (`true`) : la base et les photos pouvaient y être copiées si l'utilisateur avait activé la sauvegarde Google ; le coffre en était exclu par `expo-secure-store`.

**Connexions directes du téléphone vers des tiers** (sans passer par le relais) :

- **Copie de l'image d'une boutique** : à l'enregistrement d'une pièce ajoutée par lien ou choisie parmi les alternatives, le téléphone télécharge lui-même l'image. Le serveur de la boutique, ou de son hébergeur d'images, voit l'adresse IP du téléphone.
- **Affichage des images non copiées** : les miniatures des propositions (écrans « Par photo » et « Alternatives ») et l'aperçu du formulaire sont chargés directement depuis leur adresse d'origine. Ce sont des serveurs de Google, de SerpApi ou des boutiques, qui voient l'adresse IP du téléphone.
- **Ouverture d'une boutique** : le bouton de la fiche ouvre le navigateur, qui applique alors les règles du site.

Le relais n'intervient pas dans ces échanges. Ce choix est assumé : faire passer ces images par le relais masquerait l'IP du téléphone, mais ajouterait une fonctionnalité et du trafic au relais.

---

## 3. Ce qui passe par le relais (lots 1 à 3)

Toutes les requêtes de l'app vers le relais sont en HTTPS et portent :

- `Authorization` : le jeton de l'installation. Le relais calcule son empreinte SHA-256 et la compare à celles qu'il garde. Le jeton lui-même n'est jamais enregistré.
- `X-ClosetA-Installation` : l'identifiant d'installation du téléphone. Le relais vérifie qu'il est bien formé (UUID), **sans le conserver**.
- `X-ClosetA-Version` : la version de l'app, comparée à la version minimale exigée.

Cloudflare reçoit aussi, comme pour toute requête web, l'**adresse IP** du téléphone et les en-têtes techniques habituels. Le relais n'utilise l'IP que comme clé de la limite de débit, dans deux cas : une requête sans jeton valide, ou une lecture de photo par Google Lens.

| Fonction de l'app | Données envoyées au relais | Ce que fait le relais | Tiers contactés |
| --- | --- | --- | --- |
| Coller un lien, partage Android, relecture du prix d'une fiche de plus de 24 h | Adresse de la page produit | Lit la page (12 s au plus), en extrait nom, marque, prix, devise, image, disponibilité. N'accepte que des adresses `https` publiques. | La boutique. Elle reçoit une requête venant de Cloudflare, pas du téléphone, avec un cookie de localisation fixe (`localization=FR; cart_currency=EUR`). |
| Par photo (`/identify`) | Photo JPEG (1024 px au plus, 2 Mo au plus), genre recherché | 1) Fait décrire la photo par l'IA de Cloudflare. 2) Dépose la photo dans Cloudflare R2 sous une adresse aléatoire de 64 caractères, la fait chercher par Google Lens via SerpApi, puis **la supprime dès la fin de la recherche**. 3) Lance une recherche Google Shopping avec la description. | Cloudflare (Workers AI, R2), SerpApi, Google |
| Voir des alternatives (`/alternatives`) | Nom, marque, catégorie, couleur et genre de la pièce ; adresse de l'image de la boutique **ou**, à défaut, la photo du téléphone ; adresse de la pièce à exclure | Lens sur l'image (photo déposée puis supprimée comme ci-dessus), puis recherche Google Shopping construite avec nom, marque, catégorie, couleur et genre | SerpApi, Google, Cloudflare R2 |
| Recherches ce mois (`/quota`) | Aucune donnée en plus des en-têtes | Lit le compteur du mois | — |
| Installations (administrateur seulement) | Jeton d'administration, nom donné à la nouvelle installation | Crée, liste ou révoque une installation | — |
| QR de configuration | Rien n'est envoyé : le QR est affiché et lu de téléphone à téléphone. Il contient l'adresse du relais et le **jeton en clair**, d'où la mise en garde affichée. | — | — |

**Pourquoi la photo est publique quelques secondes** : Google Lens ne peut recevoir qu'une adresse d'image, sans jeton. Pendant la recherche, `GET /photo/<id>` sert donc la photo **sans authentification**. L'identifiant est aléatoire (64 caractères) et non devinable, et la route est limitée en débit. La photo est supprimée aussitôt la recherche terminée, réussie ou non. Si la suppression échoue, la règle du bucket l'efface au bout d'un jour (règle vérifiée au lot 4, étape 5).

**Ce que voit Google** : SerpApi transmet l'adresse de la photo à Google Lens. Les serveurs de Google téléchargent alors la photo depuis le relais. Google traite ensuite l'image et les requêtes Shopping **selon ses propres règles**. ClosetA n'a pas de contrat avec Google : Google n'est pas un sous-traitant, mais un destinataire tiers. **C'est la raison principale du rappel affiché sur les écrans photo : « Photographie la pièce seule, sans personne. »** Une photo sans personne, de vêtement seul, n'est en principe pas une donnée personnelle.

### Ce que le relais conservait avant le catalogue

| Donnée | Stockage | Durée |
| --- | --- | --- |
| Installations : identifiant (UUID tiré par le relais), **nom choisi par l'administrateur** (par exemple un prénom), date de création, actif ou révoqué | Cloudflare KV | Tant que l'installation est active. Aujourd'hui, une installation révoquée reste dans KV (marquée « révoquée ») ; **[prévu]** suppression de la fiche à la révocation. |
| Empreinte SHA-256 de chaque jeton → identifiant d'installation | Cloudflare KV | Comme l'installation |
| Compteur mensuel des recherches SerpApi (global et par installation) | Durable Object `Quota` (base SQLite), depuis l'étape 1 du lot 4 ; avant, Cloudflare KV | Mois en cours et mois précédent ; les plus anciens sont effacés au premier appel d'un nouveau mois. Les anciennes cases KV expirent seules au bout de 40 jours. |
| Photo envoyée pour une recherche | Cloudflare R2 | Le temps de la recherche (environ 30 s au plus), un jour au maximum en cas d'échec de la suppression |
| Compteur de la limite de débit (30 requêtes par minute, clé = installation ou adresse IP) | Mémoire de Cloudflare (Rate Limiting) | Environ une minute **[à vérifier : documentation Cloudflare]** |

Avant le catalogue du lot 4 (§ 4), le relais ne gardait **ni** les pages lues, **ni** les liens envoyés, **ni** les résultats de recherche, **ni** les descriptions de l'IA, **ni** l'identifiant d'installation du téléphone, **ni** l'adresse IP. Il n'écrit aucun journal (`console.log` absent du code ; journaux Cloudflare non activés dans `wrangler.toml`). **[à vérifier : métadonnées gardées par défaut par Cloudflare, comme les statistiques de requêtes du tableau de bord]**

---

## 4. Ce qui change avec le lot 4 (catalogue partagé)

Règle du lot 4 : **le relais ne conserve aucune donnée personnelle.** Il garde les installations, les compteurs, et un catalogue anonyme.

| Étape | Changement | Effet sur les données |
| --- | --- | --- |
| 1 — Durable Object `Quota` (en ligne) | Les compteurs passent de KV à un Durable Object (stockage SQLite) : table `compteur (mois, cle, utilise)`, `cle` = `global` ou identifiant d'installation. | Mêmes données, stockées ailleurs ; mois en cours et précédent gardés. **[prévu]** Déplacement dans la juridiction `eu` (§ 7). |
| 2 — Catalogue D1 (en ligne) | Tables `produit` (adresse canonique, boutique, nom, marque, image, catégorie, couleur, genre, première et dernière vue), `observation_prix` (date, prix, devise, disponibilité, disponibilité par taille), `recherche` (clé = empreinte de type + entrée + genre ; résultats ; dates). | Données de **pièces vendues en ligne**, sans lien avec la personne qui les a demandées : ni identifiant d'installation, ni jeton, ni IP, ni photo (tests prévus). Voir les réserves ci-dessous. |
| 2 — Cache des recherches | Une recherche déjà faite (Lens ou Shopping, même entrée, même genre) est resservie sans rappeler SerpApi. | Moins de données envoyées à SerpApi et Google. La photo n'est plus envoyée du tout quand son empreinte est en cache. |
| 3 — Historique partagé | `/v1/extract` renvoie le prix le plus bas observé. | Aucune donnée nouvelle sur la personne. |
| 4 — Interface de recherche | Les appels à SerpApi passent par une interface unique. | Aucun. Un changement de fournisseur demandera de mettre à jour ce document et le registre. |
| 5 — Journaux | Journaux Cloudflare activés, en JSON : route, durée, résultat, `depuis_cache`, code d'erreur ; **jamais** de jeton, d'identifiant d'installation, d'IP, d'URL de photo ni de requête de recherche. `GET /v1/admin/etat` : chiffres agrégés. | Données techniques sans personne identifiée, gardées par Cloudflare **[à vérifier : durée de conservation des Workers Logs pour l'offre utilisée]**. |
| 6 — Codes d'invitation | Code `CLST-` + 8 caractères tirés au hasard, à usage unique. Seule son **empreinte** est gardée, dans le Durable Object `Quota`, 7 jours au plus, avec le nom prévu pour l'installation ; effacée à l'utilisation, à l'annulation ou à l'expiration. Utilisation sans jeton ni identifiant du téléphone, limitée à 5 essais par minute **par adresse IP** (en mémoire). | Nouveau : le nom de la personne invitée est connu dès l'invitation. Le lien d'invitation, sans jeton, peut transiter par une messagerie choisie par l'administrateur. |
| 7 — Mises à jour | Le relais lit la dernière release GitHub (gardée 1 h). L'app affiche un bandeau, et le lien s'ouvre dans le navigateur. | GitHub reçoit les requêtes du relais (pas du téléphone), puis celle du navigateur si l'utilisateur ouvre le lien. |
| 8 — Confidentialité | Ce document, le registre, l'écran « Confidentialité », le rappel sur les écrans photo. | — |

Durées du catalogue (décisions du 24 novembre 2026) :

| Contenu | Durée |
| --- | --- |
| Page produit (relecture évitée) | 24 h |
| Résultat Google Shopping | 7 jours |
| Résultat Lens sur l'image d'une boutique | 30 jours |
| Résultat Lens sur une photo (clé = empreinte SHA-256 de la photo) | 30 jours |
| Historique des prix (`observation_prix`) | Conservé sans limite |
| `recherche` expirées | Purgées chaque nuit (3 h UTC) |

**Caractère anonyme du catalogue : réserves et mesures** :

1. **Adresse canonique** : un lien partagé depuis un panier, un e-mail ou un compte client peut contenir un identifiant propre à la personne (session, référence client, code d'affiliation). Mesure décidée **[prévu, correctif du relais]** : **liste blanche**, seuls les paramètres reconnus comme taille, couleur ou variante sont gardés, tous les autres sont retirés. L'étape 2, fusionnée avant cette décision, retire seulement les paramètres de suivi connus (`utm_*`, `gclid`, `fbclid`…) : d'ici le correctif, un paramètre propre à une personne peut entrer dans le catalogue.
2. **Empreinte de la photo** : l'empreinte SHA-256 d'une photo de vêtement seul ne permet pas de retrouver la photo, ni la personne. Si la photo montrait une personne, l'empreinte serait une donnée pseudonymisée, d'où le rappel « sans personne ».
3. **Clé Shopping** : la requête est construite à partir de la fiche (nom, marque, catégorie, couleur, genre), donc normalement sans donnée personnelle. Mais le nom d'une pièce saisi à la main est du texte libre.
4. **Genre** : le genre recherché (« Je cherche pour ») fait partie des clés de cache et de la table `produit`. Il décrit le rayon (homme, femme, mixte), pas la personne. Il n'est relié à aucune installation.
5. **Corrélation dans le temps** : sans identifiant, une ligne du catalogue ne peut pas être rattachée à une personne. Les dates `premiere_vue` et `derniere_vue`, croisées avec les journaux de Cloudflare, pourraient en théorie le permettre. Les journaux du lot 4 n'enregistrent ni IP ni identifiant, ce qui ferme cette piste.

---

## 5. Finalités et bases légales

| Finalité | Données | Base légale proposée |
| --- | --- | --- |
| Remplir une fiche à partir d'un lien | Adresse de la page | Intérêt légitime (art. 6.1.f) : fournir le service demandé par l'utilisateur. Alternative : exécution d'un service demandé (art. 6.1.b) si l'accès est formalisé. |
| Identifier une pièce photographiée, proposer des alternatives | Photo, description de la pièce, genre | Idem. La photo doit montrer la pièce seule (rappel à l'écran). |
| Contrôler l'accès au relais | Empreinte du jeton, installation | Intérêt légitime : sécurité du service (art. 6.1.f, considérant 49). |
| Limiter le débit, protéger contre les abus | Adresse IP, identifiant d'installation, en mémoire une minute | Intérêt légitime : sécurité (considérant 49). |
| Rester dans l'offre gratuite de SerpApi | Compteurs mensuels par installation | Intérêt légitime : maîtrise des coûts et partage équitable. |
| Catalogue et cache (lot 4) | Données de pièces, sans donnée personnelle | Hors RGPD si l'anonymat est confirmé (réserves du § 4) ; sinon intérêt légitime (économie de recherches, historique des prix). |
| Inviter une personne (lot 4) | Nom prévu, empreinte du code, IP en mémoire | Intérêt légitime de l'administrateur à ouvrir l'accès ; demande de la personne invitée. |
| Supervision (lot 4) | Journaux techniques sans personne identifiée | Intérêt légitime : fiabilité du service. |

Aucune décision automatisée produisant des effets juridiques (art. 22). Aucun profilage. Aucune donnée sensible (art. 9) attendue ; le rappel photo vise à l'éviter. Analyse d'impact (art. 35) non requise : ni données sensibles, ni profilage, ni surveillance, petite échelle.

---

## 6. Destinataires, sous-traitants et tiers

| Acteur | Rôle | Données reçues | Lieu | Encadrement |
| --- | --- | --- | --- | --- |
| **Cloudflare, Inc.** (Workers, KV, R2, Rate Limiting, Workers AI ; au lot 4 Durable Objects, D1, Workers Logs) | Sous-traitant | Toutes les requêtes du relais (avec IP et en-têtes), installations, compteurs, photos le temps de la recherche, catalogue (lot 4) | Réseau mondial, siège aux États-Unis. KV est répliqué dans le monde entier. Workers AI s'exécute dans le centre Cloudflare choisi par Cloudflare. | DPA Cloudflare (accepté avec les conditions du service), certification Data Privacy Framework UE–États-Unis, clauses contractuelles types 2021/914 en secours. Workers AI : contenu non utilisé pour entraîner des modèles, gardé le temps du traitement. **[à vérifier : version du DPA en vigueur, inscription DPF active]** |
| **SerpApi, LLC** | Sous-traitant | Adresse de la photo déposée ou de l'image de la boutique, requête Google Shopping, pays et langue (`fr`), clé d'API du relais. Ni IP du téléphone, ni identifiant d'installation. | États-Unis (siège déclaré : Austin, Texas) **[à vérifier]** | **[à vérifier : DPA proposé et pour quelles offres ; mécanisme de transfert (DPF, clauses types) ; durée de conservation des requêtes et des résultats (cache d'une heure côté SerpApi, historique des recherches visible dans le compte)]**. Le site de SerpApi n'a pas pu être consulté depuis la session de rédaction. |
| **Google LLC** (Google Lens, Google Shopping) | **Tiers destinataire**, responsable de son propre traitement (pas de contrat avec ClosetA) | Photo téléchargée depuis le relais, image de boutique, requête Shopping. Requêtes faites par SerpApi, pas par le téléphone. | États-Unis et monde | Conditions et règles de confidentialité de Google. Google est certifié DPF **[à vérifier]**. Hors maîtrise de ClosetA : c'est le point qui justifie le rappel photo. |
| **Google** (ML Kit, services Google Play) | Responsable de son propre traitement | Informations sur l'appareil, diagnostic. **Pas la photo.** | Monde | Conditions de ML Kit et de Google Play. |
| **Google** (sauvegarde Android) | — | Rien : sauvegarde automatique désactivée depuis l'étape 8 (voir § 2) | — | — |
| **Boutiques en ligne** | Tiers | Requête de lecture de page depuis Cloudflare. Téléchargements d'images et affichage de miniatures **depuis le téléphone**, avec son IP. | Variable | Règles de chaque boutique. |
| **GitHub, Inc.** | Tiers (hébergement du code et des APK) | Requêtes de téléchargement de l'APK, et lecture de la dernière release par le relais au lot 4 | États-Unis | Conditions de GitHub. Aucune donnée d'usage de l'app. |

Personne d'autre ne reçoit de données : pas de régie publicitaire, pas d'outil de statistiques, pas de revente.

---

## 7. Transferts hors de l'Union européenne

| Destinataire | Pays | Mécanisme |
| --- | --- | --- |
| Cloudflare | États-Unis (et centres hors UE) | Décision d'adéquation UE–États-Unis (DPF, 10 juillet 2023) ; clauses contractuelles types en secours **[à vérifier : inscription active]** |
| SerpApi | États-Unis | **[à vérifier : DPF ou clauses types ; à défaut, transfert sans encadrement documenté, à signaler]** |
| Google (Lens, Shopping, ML Kit) | États-Unis et monde | Tiers responsable de son traitement ; DPF côté Google **[à vérifier]** |

**Mesure décidée [prévu, piste A]** : base D1 du catalogue recréée avec la juridiction `eu` (celle de l'étape 2 a été créée sans), Durable Object `Quota` déplacé dans la juridiction `eu`, bucket R2 des photos dans la juridiction européenne, pour que les données gardées restent dans l'UE. KV (installations) n'offre pas cette option : il reste répliqué dans le monde entier, sous le DPA de Cloudflare.

---

## 8. Durées de conservation (récapitulatif)

| Donnée | Durée |
| --- | --- |
| Pièces, relevés, photos sur le téléphone | Jusqu'à leur suppression par l'utilisateur ou la désinstallation de l'app |
| Photo envoyée au relais | Durée de la recherche ; 1 jour au plus en cas d'incident |
| Pages lues, liens, descriptions IA (aujourd'hui) | Non conservés |
| Installation (nom, dates, état) et empreinte de jeton | Tant que l'installation est active ; supprimées à la révocation **[prévu]** |
| Compteurs de quota | Mois en cours et mois précédent |
| Limite de débit (IP, installation) | Environ une minute, en mémoire |
| Catalogue : page produit / Shopping / Lens | 24 h / 7 jours / 30 jours |
| Catalogue : historique des prix | Sans limite (données de pièces, pas de personnes) |
| Invitation (lot 4) | 7 jours, puis supprimée ; aussitôt après usage |
| Journaux Cloudflare (lot 4) | Durée de rétention de Cloudflare **[à vérifier]** |

---

## 9. Sécurité

- HTTPS partout, entre le téléphone, le relais et les tiers.
- Jetons de 32 octets aléatoires. Le relais ne garde que leur empreinte SHA-256, compare en temps constant, et permet la révocation (effective en moins d'une minute).
- Jeton d'administration distinct, avec sa propre limite de débit.
- Secrets du relais (`RELAY_TOKEN`, `ADMIN_TOKEN`, `SERPAPI_KEY`) rangés comme secrets Cloudflare, jamais dans le dépôt ni dans l'APK. Côté téléphone, jetons dans le coffre chiffré d'Android, exclu des sauvegardes.
- Limite de débit : 30 requêtes par minute, par installation ou par IP.
- `/extract` refuse les adresses non `https` et les adresses privées ou locales, y compris après chaque redirection.
- Photos réduites à 1024 px avant l'envoi, refusées au-delà de 2 Mo, supprimées après usage.
- Permissions Android réduites : appareil photo seulement ; micro et stockage partagé bloqués explicitement.
- Sauvegarde automatique d'Android désactivée : les données de l'app ne sortent du téléphone que par la sauvegarde `.closeta`, à la main.
- Pas de SDK de statistiques, de publicité ni de suivi des plantages.
- Dépôt public : aucun secret, aucune donnée réelle (tests sur données fictives).

---

## 10. Droits des personnes

Pour les données **sur le téléphone**, l'utilisateur les gère lui-même : modifier ou supprimer une pièce, exporter (sauvegarde `.closeta`), tout effacer (désinstaller l'app ou vider ses données).

Pour les données **gardées par le relais** (installation et compteurs), écrire au contact du § 1 :

- **Accès** (art. 15) : l'administrateur communique le nom, la date de création et l'état de l'installation, et le compteur du mois.
- **Rectification** (art. 16) : le nom d'une installation se corrige en la révoquant et en en créant une nouvelle (nouveau QR ou nouvelle invitation).
- **Effacement** (art. 17) : révocation de l'installation, qui supprime sa fiche et l'empreinte de son jeton **[prévu ; aujourd'hui la fiche reste, marquée « révoquée »]**. Les compteurs disparaissent avec le mois (mois en cours et précédent gardés).
- **Opposition** (art. 21) : cesser d'utiliser le relais, et demander la révocation.
- **Limitation et portabilité** (art. 18, 20) : sans objet en pratique pour le relais ; la portabilité des pièces est assurée par la sauvegarde `.closeta`.
- Le catalogue (lot 4) ne contient aucune donnée rattachable à une personne : il n'y a rien à y retrouver pour une personne donnée.
- **Réclamation** : auprès de la CNIL (cnil.fr) ou de l'autorité du pays de résidence.

Délai de réponse : un mois (art. 12.3).

---

## 11. Décisions et points restants

Décisions du 24 novembre 2026 sur les points relevés à la relecture du code :

| Point | Décision | État |
| --- | --- | --- |
| Sauvegarde automatique d'Android | Désactivée | Fait (étape 8) |
| Images chargées directement par le téléphone (IP vue par Google, SerpApi, boutiques) | Accepté et documenté | — |
| Photo publique sans jeton pendant la recherche Lens | Accepté et documenté (identifiant aléatoire, suppression immédiate) | — |
| Installation révoquée gardée dans KV | Suppression à la révocation ; pas de renommage | Prévu (relais) |
| Paramètres d'adresse dans le catalogue | Liste blanche | Prévu (correctif du relais ; l'étape 2 retire seulement le suivi connu) |
| Juridiction UE pour D1, Durable Object, R2 | Oui | Prévu (piste A ; D1 et Durable Object à recréer ou déplacer) |
| Durée des compteurs mensuels | Mois en cours et précédent | Fait (étape 1) |

Restent à vérifier :

1. **Engagements de SerpApi** (DPA, mécanisme de transfert, durée de conservation des requêtes et des résultats) sur sa documentation officielle.
2. Inscription active de Cloudflare et de Google au Data Privacy Framework (dataprivacyframework.gov).
3. Durée de conservation des journaux Workers Logs de l'offre utilisée (étape 5).
4. Absence de position GPS dans une photo rangée par l'app (test sur une vraie photo).

---

## Sources

Consultées le 24 novembre 2026 (en plus du code) :

- Cloudflare, Data Processing Addendum : https://www.cloudflare.com/cloudflare-customer-dpa/
- Cloudflare, clauses contractuelles types : https://www.cloudflare.com/cloudflare-customer-scc
- Cloudflare, RGPD : https://www.cloudflare.com/trust-hub/gdpr/
- Cloudflare, Workers AI, utilisation des données : https://developers.cloudflare.com/workers-ai/platform/privacy/
- Google, ML Kit, informations pour la section « Sécurité des données » : https://developers.google.com/ml-kit/android-data-disclosure
- SerpApi, documents juridiques (non consultables depuis la session de rédaction) : https://serpapi.com/legal
