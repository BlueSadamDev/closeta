/**
 * Tous les textes affichés par ClosetA.
 * Charte : DESIGN.md, section « Textes » (tutoiement, typographie française, relief balisé *…*).
 * Le test textGuard.test.ts vérifie automatiquement ces règles.
 * Espaces :   = insécable (avant : ; ! ? et €),   = fine insécable.
 */

const pieces = (n: number) => (n <= 1 ? `${n} pièce` : `${n} pièces`);

export const texts = {
  wishlist: {
    surTitre: (n: number) => `Ma sélection · ${pieces(n)}`,
    titre: 'La Wishlist',
    prixACompleter: (n: number) => `${n} prix à compléter`,
    vide: 'Ta Wishlist est vide. *Ajoute ta première pièce*.',
    aucunResultat: 'Aucune pièce pour cette sélection. *Essaie un autre filtre*.',
    filtres: {
      tout: 'Tout',
      vetements: 'Vêtements',
      chaussures: 'Chaussures',
      priorite: 'Priorité',
      categorie: 'Catégorie',
      aucuneCategorie: 'Aucune catégorie pour l’instant',
    },
    tri: {
      intitule: 'Tri',
      date: 'Récents',
      prix: 'Prix',
      priorite: 'Priorité',
    },
    vue: {
      intitule: 'Vue',
      grille: 'Grille',
      categories: 'Catégories',
    },
    pieces,
    aClasser: 'À classer',
    recherche: 'Une pièce, une marque, une couleur',
    ajouter: 'Ajouter',
  },

  priorites: {
    forte: 'Envie forte',
    moyenne: 'Moyenne',
    un_jour: 'Un jour',
  },

  types: {
    vetement: 'Vêtement',
    chaussures: 'Chaussures',
  },

  fiche: {
    prixACompleter: 'Prix à compléter',
    aCompleter: 'À compléter',
    taille: 'Taille',
    couleur: 'Couleur',
    categorie: 'Catégorie',
    priorite: 'Priorité',
    notes: 'Notes',
    voirEnBoutique: 'Voir en boutique',
    acheter: 'Je l’ai acheté',
    modifier: 'Modifier',
    supprimer: 'Supprimer',
    introuvable: 'Cette pièce n’est plus là. *Retourne à ta Wishlist*.',
    lienIllisible: 'Ce lien ne s’ouvre pas. *Vérifie-le* en modifiant la pièce.',
  },

  /** Fenêtres de confirmation d'Android : pas de relief possible, texte simple. */
  confirmations: {
    achat: {
      titre: 'Tu l’as acheté ?',
      message: 'Belle pièce. Elle quitte ta Wishlist pour rejoindre ton Vestiaire.',
      confirmer: 'Oui, acheté',
    },
    suppression: {
      titre: 'Supprimer cette pièce ?',
      message: 'Elle disparaît pour de bon.',
      confirmer: 'Supprimer',
    },
    annuler: 'Annuler',
  },

  formulaire: {
    titreNouveau: 'Nouvelle pièce',
    titreModifier: 'Modifier la pièce',
    obligatoire: 'Obligatoire',
    champs: {
      nom: 'Nom',
      marque: 'Marque',
      type: 'Type',
      categorie: 'Catégorie',
      taille: 'Taille',
      couleur: 'Couleur',
      prix: 'Prix en euros',
      lien: 'Lien de la boutique',
      priorite: 'Priorité',
      notes: 'Notes',
    },
    exemples: {
      nom: 'Veste en laine',
      marque: 'La marque',
      categorie: 'Choisis ou écris une catégorie',
      taille: 'M, 42, 9 UK…',
      couleur: 'Écru, marine…',
      prix: '129,90',
      lien: 'Colle le lien ici',
      notes: 'Une idée de tenue, un détail à vérifier…',
    },
    erreurs: {
      nomManquant: 'Donne-lui *un nom*.',
      typeManquant: 'Choisis *vêtement ou chaussures*.',
      prixInvalide: 'Écris un prix *comme 129,90*.',
      lienInvalide: 'Ce lien semble incomplet. *Colle-le en entier*.',
    },
    echecEnregistrement: 'La pièce n’a pas pu être enregistrée. *Réessaie*.',
    /** Formulaire ouvert après un lien (collé ou partagé). */
    lien: {
      lecture: 'On lit la page…',
      trouve: 'Fiche remplie depuis la boutique. *Vérifie-la* avant d’enregistrer.',
      aCompleter: 'À compléter : ',
      manquants: {
        nom: 'le nom',
        marque: 'la marque',
        prix: 'le prix',
        image: 'la photo',
      },
      echecs: {
        illisible: 'Cette boutique ne se laisse pas lire. *Complète la fiche* à la main.',
        jeton_absent: 'Aucun jeton pour l’instant. *Ajoute-le dans les Réglages*, puis complète la fiche.',
        jeton_refuse: 'Le relais ne te reconnaît pas. *Vérifie ton jeton* dans les Réglages.',
        limite: 'Trop de demandes en une minute. *Complète la fiche* à la main.',
        injoignable: 'Le relais ne répond pas. *Complète la fiche* à la main.',
      },
    },
    enregistrer: 'Enregistrer',
    annuler: 'Annuler',
  },

  ajout: {
    titre: 'Ajouter une pièce',
    lien: {
      libelle: 'Coller un lien',
      phrase: 'La fiche se remplit depuis la boutique.',
    },
    manuel: {
      libelle: 'Saisir à la main',
      phrase: 'Tu remplis la fiche toi-même.',
    },
  },

  /** Écran « Coller un lien ». */
  lien: {
    titre: 'Coller un lien',
    champ: 'Lien de la boutique',
    exemple: 'Colle le lien ici',
    copie: 'Lien copié',
    utiliser: 'Utiliser ce lien',
    lire: 'Lire la page',
    lienInvalide: 'Ce lien semble incomplet. *Colle-le en entier*.',
    partageSansLien: 'Ce partage ne contient pas de lien. *Colle un lien de boutique*.',
  },

  reglages: {
    titre: 'Réglages',
    jeton: 'Jeton du relais',
    jetonExemple: 'Colle ton jeton ici',
    enregistrer: 'Enregistrer',
    enregistre: 'Jeton *enregistré*.',
    tester: 'Tester la connexion',
    testEnCours: 'On interroge le relais…',
    version: 'Version',
    connexion: {
      ok: 'Le relais te reconnaît. *Tout est prêt*.',
      jeton_absent: 'Aucun jeton pour l’instant. *Colle ton jeton* au-dessus.',
      jeton_refuse: 'Le relais ne te reconnaît pas. *Vérifie ton jeton*.',
      limite: 'Trop de demandes en une minute. *Réessaie dans un instant*.',
      injoignable: 'Le relais ne répond pas. *Vérifie ta connexion* et réessaie.',
      inattendu: 'Le relais a répondu de façon inattendue. *Réessaie plus tard*.',
    },
  },

  accessibilite: {
    reglages: 'Ouvrir les Réglages',
    fermerAjout: 'Fermer',
    rechercher: 'Rechercher',
    fermerRecherche: 'Fermer la recherche',
    retour: 'Retour',
  },
} as const;
