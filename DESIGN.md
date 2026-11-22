# DESIGN.md – ClosetA

Référence visuelle : la maquette « A · Éditorial » du canevas « ClosetA — Pistes d'identité visuelle ». Ce fichier en fixe les règles pour le code. En cas de doute, il fait foi ; s'il doit changer, le modifier ici d'abord.

## Identité
- **Nom affiché** : « ClosetA » (dans `app.json` : `name`).
- **Mot-symbole** : « CLOSETA » en capitales, Cormorant Garamond 600, espacement des lettres 0,32 em, couleur `ink`.
- **Icône Android** : un « C » en Cormorant Garamond 600, couleur `ink`, centré sur fond `paper`, en icône adaptative (avant-plan = lettre, arrière-plan = `paper`). Fichiers générés à partir d'un SVG unique rangé dans `assets/brand/`.
- **Écran de démarrage** : fond `paper`, mot-symbole 32 px centré.

## Principes
- **Ton magazine de mode** : beaucoup de blanc, des photos qui portent l'écran, des titres serif, de petites étiquettes en capitales.
- **Une seule chose mise en avant par écran** : sur la wishlist, les photos ; sur la fiche, l'article.
- **Pas d'ombre, pas de dégradé, pas d'emoji, aucun arrondi.** Les séparations se font par des filets fins (1 px, `ink`) et par l'espace.
- Icônes au trait fin (1,4 px), couleur du texte.
- Thème clair uniquement (sombre hors lot 1).

## Couleurs (tokens)

| Token | Valeur | Usage |
| --- | --- | --- |
| `paper` | `#F6F3EE` | Fond de tous les écrans |
| `ink` | `#15130F` | Texte principal, filets, bouton principal (fond) |
| `inkMuted` | `#6B6258` | Étiquettes, filtres inactifs, textes secondaires |
| `tobacco` | `#8A5A3B` | Accent ponctuel : élément actif, lien survolé. Jamais en fond large |
| `photo1` / `photo2` / `photo3` | `#D9CFC1` / `#C9B9A4` / `#E4DDD2` | Fonds d'image pendant le chargement ou en l'absence de photo |
| `danger` | `#9B2C2C` | Action destructrice (Supprimer), toujours avec un libellé |

Contraste : tout texte atteint 4,5:1 sur son fond. `inkMuted` et `tobacco` le respectent sur `paper`.

## Typographie
- **Cormorant Garamond** (500, 600, italique 500) : mot-symbole, titres, noms d'articles, prix.
- **Jost** (400, 500) : tout le reste.
- Polices embarquées avec `expo-font` (fichiers dans `assets/fonts/`, licence libre).

| Rôle | Police | Taille / graisse |
| --- | --- | --- |
| Titre d'écran (« La Wishlist ») | Cormorant Garamond italique | 44 / 500, interligne 1 |
| Total de la wishlist | Cormorant Garamond | 22 / 600 |
| Nom d'article (grille) | Cormorant Garamond | 19 / 500 |
| Nom d'article (fiche) | Cormorant Garamond | 32 / 500 |
| Prix (grille) | Jost | 13 / 400 |
| Prix (fiche) | Cormorant Garamond | 24 / 600 |
| Étiquette (marque, filtres, sur-titre) | Jost | 10–12 / 500, MAJUSCULES, espacement 0,16–0,22 em |
| Texte courant | Jost | 14–15 / 400 |
| Bouton | Jost | 12 / 500, MAJUSCULES, espacement 0,2 em |

## Espacements et formes
- Marges d'écran : 24 px. Grille de la wishlist : 2 colonnes, 14 px entre colonnes, 22 px entre rangées.
- Photo de la grille : 196 px de haut, recadrée (`cover`).
- Angles : 0 partout.
- **Cibles tactiles ≥ 44 px.**

## Composants
- **En-tête** : icône menu, mot-symbole centré, icône recherche ; filet `ink` dessous.
- **Sur-titre + titre** : « MA SÉLECTION · N PIÈCES » (étiquette), puis « La Wishlist » (dans le Vestiaire : « MON VESTIAIRE · N PIÈCES », « Le Vestiaire ») à gauche et le total à droite, alignés sur la ligne de base.
- **Barre de filtres** (Wishlist et Vestiaire), repliée par défaut : une ligne entre deux filets `ink`, cible de 44 px. À gauche, icône filtre + « FILTRER · » suivi de la sélection (« TOUT », ou « VÊTEMENTS · VESTE »…) en `ink` ; à droite, le tri (« RÉCENTS ») en `inkMuted` et une flèche vers le bas ; la sélection tient sur une ligne (coupée par « … » si besoin). En vue par catégorie, la première section n'a pas de filet : celui de la barre suffit. Un toucher déplie le panneau ; la ligne affiche alors « FERMER » et une flèche vers le haut.
- **Panneau de filtres** (déplié, entre les deux filets) : une ligne par rubrique, rubrique en Cormorant Garamond italique 16 `inkMuted` à gauche (Pièces, Choix, Vue, Tri), choix en capitales à droite. Choix actif = « sélection pleine » : fond `ink`, texte `paper`, sans arrondi ; inactifs = `inkMuted` sans fond. « Choix » ouvre la liste des priorités ou des catégories en dessous.
- **Barre collante** : en faisant défiler, la barre de filtres reste fixée sous la bascule Wishlist / Vestiaire, fond `paper`, filet dessous.
- **Bascule Wishlist / Vestiaire** : sous l'en-tête, « WISHLIST · VESTIAIRE » en capitales, même style que les filtres (actif = `ink` souligné, inactif = `inkMuted`), cibles de 44 px.
- **Carte article** : photo, étiquette de priorité en bas à droite de la photo (fond `paper`, texte `ink`), puis marque (étiquette), nom, prix. Pas de cadre autour de la carte. Dans le Vestiaire, l'étiquette porte le mois d'achat (« ACHETÉ EN NOV. 2026 ») à la place de la priorité.
- **Article sans prix** : « Prix à compléter » en `inkMuted` à la place du prix ; il n'entre pas dans le total, et le total le signale.
- **Article sans photo** : aplat `photo1` à `photo3` (selon l'article) avec la première lettre du nom en Cormorant Garamond.
- **Bouton principal** : fond `ink`, texte `paper`, 52 px de haut.
- **Bouton secondaire** : filet 1 px `ink`, fond transparent, texte `ink`.
- **Bouton « Ajouter »** : bouton principal fixé en bas à droite (24 px des bords), icône + « AJOUTER ».
- **Feuille du bas** (choix du mode d'ajout) : fond `paper`, filet `ink` en haut, une ligne par mode (icône + libellé + phrase courte), 64 px par ligne.
- **Proposition (lot 1b)** : photo + marque + nom + prix + boutique ; une proposition « alternative » porte l'étiquette « ALTERNATIVE » en `tobacco`.
- **Chargement** : texte en italique Cormorant Garamond (« On lit la page… »), sans roue qui tourne plein écran.

## États à toujours prévoir
- Wishlist vide, Vestiaire vide, filtre sans résultat, image qui ne charge pas, relais injoignable, jeton absent ou refusé, extraction partielle, aucune proposition trouvée.

## Textes

ClosetA parle comme un magazine de mode qui te connaît : peu de mots, justes, une action claire. Français, tutoiement.

### Règles
1. Court et précis : un titre de quelques mots, une phrase si besoin, jamais deux paragraphes.
2. Une action claire en fin de message quand il y en a une : « Complète le prix. »
3. Pas de machinerie visible : aucun message d'erreur technique, aucun code, aucun « null », vrais pluriels (jamais « (s) »).
4. Une info manquante est une invitation, pas un défaut : « Prix à compléter », pas « Prix inconnu ».
5. Distinguer clairement ce que l'app a trouvé de ce qui est sûr : un résultat proposé reste « proposé » jusqu'à ta validation.
6. Typographie française : apostrophe ’, guillemets « », espace insécable avant : ; ! ?

### Glossaire (un mot par notion)
| Notion | Mot retenu | À abandonner |
| --- | --- | --- |
| Un vêtement ou une paire de chaussures | pièce (au pluriel dans les compteurs), article (dans les actions) | item, produit, objet |
| La liste d'envies | la Wishlist | liste de souhaits, favoris |
| Les articles achetés | le Vestiaire | garde-robe, dressing |
| Niveau d'envie | priorité : Envie forte, Moyenne, Un jour | importance, urgence |
| Article proche proposé quand l'exact est introuvable | alternative | suggestion, similaire |
| Passage en « acheté » | « Je l'ai acheté » | valider l'achat, marquer acheté |

### Relief
- Un seul élément en relief par message : le chiffre ou l'action, en Cormorant Garamond italique ou en Jost 500.
- Relief balisé `*…*` dans `src/domain/texts/`, rendu par un composant `RichText`.

### Exemples avant / après (le relief est entre astérisques)
| Avant | Après |
| --- | --- |
| Erreur 403 : token invalide | Le relais ne te reconnaît pas. *Vérifie ton jeton* dans les Réglages. |
| Extraction échouée | Cette boutique ne se laisse pas lire. *Complète la fiche* à la main. |
| 3 item(s) – total : 1485 € | 3 pièces · *1 485 €* |
| Aucun résultat | Rien de trouvé pour cette photo. *Essaie un autre angle* ou saisis l'article. |
| Article déplacé vers le vestiaire | Belle pièce. Elle *rejoint ton Vestiaire*. |
