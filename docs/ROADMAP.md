# ClosetA — Feuille de route

Mise à jour du 23 novembre 2026. Lots 1 à 3 : voir docs/SPEC.md. Les lots 4 à 6 sont des orientations validées ; chacun sera détaillé dans docs/SPEC.md avant son développement.

| Lot | Nom | Contenu | Statut |
| --- | --- | --- | --- |
| 1 | Wishlist | Wishlist, fiche, ajout à la main, par lien, partage Android, par photo, vue par catégorie, Réglages, relais `/extract` et `/identify` | Terminé (PR #1 à #9) |
| 2 | Vestiaire | Écran Vestiaire ; filtres, recherche, tri et vue par catégorie ; **tri et groupement par marque (Wishlist et Vestiaire)** ; « Remettre dans la Wishlist » | Terminé (PR #10 à #14) |
| 3 | Prix, alternatives et numérisation | Alternatives à la demande depuis une fiche ; prix et disponibilité actualisés à l'ouverture d'une fiche (une vérification par jour et par pièce, baisse signalée) ; disponibilité dans ma taille quand la boutique la publie, sinon « dispo inconnue » ; pièce épuisée → alternatives proposées ; ajout direct au Vestiaire des pièces déjà possédées ; prise de vue guidée (cadre, conseils, fond uni) ; recadrage automatique au format standard ; détourage automatique à étudier | Spécifié (docs/SPEC.md) |
| 4 | Bien tailler | Mes mesures et une pièce de référence par catégorie ; comparaison d'un article avec la référence (« 3 cm plus ample à la poitrine ») ; saisie manuelle des mesures, aide de l'IA pour lire un guide des tailles quand c'est possible ; mesures uniquement sur le téléphone | À détailler |
| 5 | Plan d'achat | Proposer quoi acheter et quand, à partir des priorités et des prix (détail à rediscuter) | À rediscuter |
| 6 | Style | Profil de style déduit du Vestiaire ; pièces manquantes ; suggestions | À détailler |

## Principes transverses

- **Quota SerpApi** : les lots 3 et 6 consomment des recherches. Le relais compte les recherches du mois et prévient avant la limite de l'offre en cours.
- **Honnêteté des données** : une information que la boutique ne publie pas (stock par taille, guide des tailles) est affichée comme inconnue, jamais devinée.
- **Données personnelles** : mesures corporelles et profil de style restent sur le téléphone ; seuls des descriptions d'articles et des photos de vêtements passent par le relais.
- **Dépendances** : le lot 3 remplit le Vestiaire (ajout direct, numérisation), dont dépendent les lots 4 et 6.
