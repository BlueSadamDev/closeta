# ClosetA — Registre des activités de traitement

> **BROUILLON.** Établi le 24 novembre 2026 (lot 4, étape 8) au format de l'article 30.1 du RGPD, à partir du code relu sur `main`, décisions de l'utilisateur intégrées. Détail et justifications : [CONFIDENTIALITE.md](CONFIDENTIALITE.md). Les mentions **[à vérifier]** et **[prévu]** ont le même sens que dans ce document.

## Responsable du traitement

| | |
| --- | --- |
| Responsable | L'administrateur du relais |
| Contact | dpo@closeta.fr |
| Délégué à la protection des données | Aucun désigné (non obligatoire) ; l'adresse de contact est générique |
| Représentant dans l'UE | Sans objet |
| Champ | Relais Cloudflare de ClosetA et données qu'il garde. Les données rangées sur les téléphones n'y figurent pas : l'administrateur n'y a pas accès, chaque utilisateur les gère seul. |
| Applicabilité | Registre tenu volontairement. Il devient utile dès que le relais sert à d'autres personnes que l'administrateur (sinon, exemption domestique, art. 2.2.c). |

Trois fiches : **1. Relais** (lecture des pages, recherches visuelles, quota), **2. Catalogue partagé** (lot 4), **3. Installations et invitations**.

---

## Fiche 1 — Relais : lecture des pages et recherches visuelles

| Rubrique | Contenu |
| --- | --- |
| Date de création / mise à jour | 24 novembre 2026 |
| Finalités | Pré-remplir une fiche à partir du lien d'une pièce (`/v1/extract`) ; identifier une pièce photographiée (`/v1/identify`) ; proposer des alternatives (`/v1/alternatives`) ; relire prix et disponibilité d'une fiche de plus de 24 h ; tenir le compte mensuel des recherches (`/v1/quota`) ; au lot 4, superviser le fonctionnement (journaux, `/v1/admin/etat`). |
| Base légale | Intérêt légitime (art. 6.1.f) : fournir le service demandé par l'utilisateur, le sécuriser, maîtriser son coût. |
| Personnes concernées | Utilisateurs de ClosetA ayant une installation sur ce relais. Indirectement, toute personne qui figurerait sur une photo malgré le rappel « Photographie la pièce seule, sans personne. ». |
| Catégories de données | **Techniques** : adresse IP (en mémoire, limite de débit), en-têtes HTTP, empreinte du jeton, identifiant d'installation (vérifié, non conservé), version de l'app. **Contenu des requêtes** : adresse d'une page produit ; photo d'une pièce (JPEG, 1024 px au plus) ; nom, marque, catégorie, couleur de la pièce ; genre recherché (rayon homme, femme ou mixte). **Comptage** : nombre de recherches du mois, par installation. |
| Données sensibles | Aucune attendue. Risque résiduel : une photo montrant une personne. Mesure : rappel sur les écrans photo. |
| Destinataires | Administrateur du relais (compteurs seulement). Sous-traitants : Cloudflare (hébergement, Workers AI, R2, KV), SerpApi (recherche Google Lens et Google Shopping). Tiers : Google (reçoit la photo et les requêtes via SerpApi, responsable de son propre traitement), boutiques en ligne (lecture de la page demandée). |
| Transferts hors UE | Cloudflare, États-Unis : DPF UE–États-Unis, clauses types en secours **[à vérifier : inscription active]**. SerpApi, États-Unis : **[à vérifier : mécanisme]**. Google, États-Unis : tiers, DPF côté Google **[à vérifier]**. |
| Durées de conservation | Pages, liens, descriptions de l'IA, résultats : **non conservés** (lot 1 à 3). Photo : supprimée dès la fin de la recherche, 1 jour au plus en cas d'incident (règle du bucket R2). Compteurs mensuels : mois en cours et mois précédent (Durable Object `Quota` ; anciennes cases KV expirées après 40 jours). Limite de débit : environ une minute en mémoire. Journaux du lot 4 : durée de Cloudflare **[à vérifier]**. |
| Mesures de sécurité | HTTPS ; jeton obligatoire, empreinte SHA-256, comparaison en temps constant ; 30 requêtes par minute par installation ou IP ; `/extract` limité aux adresses `https` publiques, redirections revérifiées ; photo refusée au-delà de 2 Mo ; photo servie à Google Lens sous un identifiant aléatoire de 64 caractères, sans jeton, puis supprimée ; secrets du relais en secrets Cloudflare ; journaux du lot 4 sans jeton, identifiant, IP, URL de photo ni requête de recherche. |
| Analyse d'impact (AIPD) | Non requise : pas de données sensibles, pas de profilage, pas de surveillance, petite échelle. |

---

## Fiche 2 — Catalogue partagé et cache des recherches (lot 4, étapes 2 et 3)

| Rubrique | Contenu |
| --- | --- |
| Date de création / mise à jour | 24 novembre 2026 (traitement prévu, pas encore en ligne) |
| Finalités | Éviter de relire une page produit déjà lue depuis moins de 24 h ; éviter de refaire une recherche déjà faite (économie du quota SerpApi) ; garder l'historique des prix observés pour afficher « Prix le plus bas observé ». |
| Base légale | Aucune si le catalogue est bien anonyme (considérant 26). Sinon : intérêt légitime (art. 6.1.f). |
| Personnes concernées | Aucune visée : le catalogue décrit des pièces vendues en ligne. |
| Catégories de données | `produit` : adresse canonique, boutique, nom, marque, image (adresse), catégorie, couleur, genre du rayon, première et dernière vue. `observation_prix` : date, prix, devise, disponibilité, disponibilité par taille. `recherche` : clé (empreinte SHA-256 de type + entrée normalisée + genre), type (`lens_image`, `lens_photo`, `shopping`), résultats, dates. **Exclus par construction et vérifiés par des tests** : identifiant d'installation, jeton, adresse IP, photo, copie d'image de boutique. |
| Réserves sur l'anonymat et mesures | 1) Adresse canonique : un paramètre inconnu peut contenir un identifiant de session ou de client → **liste blanche**, seuls les paramètres de taille, couleur ou variante sont gardés **[prévu, étape 2]**. 2) Clé `lens_photo` : empreinte d'une photo, pseudonyme si la photo montre une personne → rappel « sans personne » sur les écrans photo. 3) Clé Shopping : construite depuis le nom saisi, texte libre → risque résiduel faible, accepté. |
| Destinataires | Toutes les installations du relais, de façon agrégée : une réponse peut venir d'une recherche faite par une autre installation, sans savoir laquelle. Sous-traitant : Cloudflare (D1). |
| Transferts hors UE | Aucun pour le stockage : base D1 créée avec la juridiction `eu` **[prévu, étape 2]**. Le Worker qui la lit s'exécute dans le centre Cloudflare le plus proche de la requête, sous le DPA de Cloudflare. |
| Durées de conservation | Page produit : 24 h avant relecture. Résultats Shopping : 7 jours. Résultats Lens (image de boutique ou photo) : 30 jours. Purge des recherches expirées chaque nuit à 3 h UTC. Fiches `produit` et historique des prix : sans limite. |
| Mesures de sécurité | Accès au catalogue seulement par le Worker (aucun accès public) ; durées dans `relay/src/settings.ts` ; schéma versionné dans `relay/migrations/` ; tests d'absence d'identifiant dans D1. |

---

## Fiche 3 — Installations, quotas par installation et codes d'invitation

| Rubrique | Contenu |
| --- | --- |
| Date de création / mise à jour | 24 novembre 2026 |
| Finalités | Donner un accès personnel au relais à chaque téléphone ; pouvoir le retirer (révocation) ; répartir le quota mensuel de recherches ; au lot 4, inviter une personne sans lui envoyer de jeton. |
| Base légale | Intérêt légitime (art. 6.1.f) : contrôle d'accès et sécurité du service (considérant 49). |
| Personnes concernées | Utilisateurs du relais, et personnes invitées (lot 4). |
| Catégories de données | Identifiant d'installation (UUID tiré par le relais) ; **nom de l'installation**, choisi par l'administrateur, souvent un prénom ; date de création ; état (active ou révoquée) ; empreinte SHA-256 du jeton ; compteurs mensuels de recherches. Lot 4 : empreinte du code d'invitation et nom prévu ; adresse IP, en mémoire, pour la limite de débit de l'utilisation d'un code. |
| Destinataires | Administrateur du relais (section « Installations » des Réglages, avec le jeton d'administration). Sous-traitant : Cloudflare (KV ; Durable Object au lot 4). |
| Transferts hors UE | Cloudflare KV, répliqué dans le monde entier ; DPF UE–États-Unis, clauses types en secours **[à vérifier]**. |
| Durées de conservation | Installation et empreinte du jeton : tant que l'installation est active, supprimées à la révocation **[prévu ; aujourd'hui gardées, marquées « révoquée »]**. Compteurs : mois en cours et mois précédent. Code d'invitation : 7 jours, invalidé dès son utilisation. |
| Mesures de sécurité | Jetons de 32 octets aléatoires, montrés une seule fois (QR affiché une fois) ; seule l'empreinte est gardée ; révocation effective en moins d'une minute ; jeton d'administration distinct, limité en débit ; lien d'invitation sans jeton ; code à usage unique, limité en débit par IP. |
| Exercice des droits | Accès : l'administrateur communique la fiche de l'installation et ses compteurs. Rectification du nom : révoquer puis recréer. Effacement : révocation, qui supprime la fiche **[prévu]**. |
