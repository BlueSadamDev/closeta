# ClosetA — Feuille de route

Mise à jour du 22 novembre 2026. Lots 1 et 2 : voir docs/SPEC.md. Les lots 3 à 7 sont des orientations validées ; chacun sera détaillé dans docs/SPEC.md avant son développement.

| Lot | Nom | Contenu | Statut |
| --- | --- | --- | --- |
| 1 | Wishlist | Wishlist, fiche, ajout à la main, par lien, partage Android, par photo, vue par catégorie, Réglages, relais `/extract` et `/identify` | Terminé (PR #1 à #9) |
| 2 | Vestiaire | Écran Vestiaire ; filtres, recherche, tri et vue par catégorie ; **tri et groupement par marque (Wishlist et Vestiaire)** ; « Remettre dans la Wishlist » | En cours (étape 1 fusionnée, PR #10) |
| 3 | Prix et alternatives | Alternatives à la demande depuis une fiche ; prix et disponibilité actualisés à l'ouverture d'une fiche (une vérification par jour et par pièce, baisse signalée) ; disponibilité dans ma taille quand la boutique la publie, sinon « dispo inconnue » ; pièce épuisée → alternatives proposées | À détailler |
| 4 | Numériser | Ajout direct au Vestiaire des pièces déjà possédées ; prise de vue guidée (cadre, conseils, fond uni) ; recadrage automatique au format standard ; détourage automatique à étudier | À détailler |
| 5 | Bien tailler | Mes mesures et une pièce de référence par catégorie ; comparaison d'un article avec la référence (« 3 cm plus ample à la poitrine ») ; saisie manuelle des mesures, aide de l'IA pour lire un guide des tailles quand c'est possible ; mesures uniquement sur le téléphone | À détailler |
| 6 | Plan d'achat | Proposer quoi acheter et quand, à partir des priorités et des prix (détail à rediscuter) | À rediscuter |
| 7 | Style | Profil de style déduit du Vestiaire ; pièces manquantes ; suggestions | À détailler |

## Principes transverses

- **Quota SerpApi** : les lots 3 et 7 consomment des recherches. Le relais compte les recherches du mois et prévient avant la limite de l'offre en cours.
- **Honnêteté des données** : une information que la boutique ne publie pas (stock par taille, guide des tailles) est affichée comme inconnue, jamais devinée.
- **Données personnelles** : mesures corporelles et profil de style restent sur le téléphone ; seuls des descriptions d'articles et des photos de vêtements passent par le relais.
- **Dépendances** : le lot 4 remplit le Vestiaire, dont dépendent les lots 5 et 7.
