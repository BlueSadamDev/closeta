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
      filtrer: 'Filtrer',
      fermer: 'Fermer',
      /** Rubriques du panneau déplié (DESIGN.md, « Panneau de filtres »). */
      rubriques: {
        pieces: 'Pièces',
        choix: 'Choix',
        vue: 'Vue',
        tri: 'Tri',
      },
    },
    tri: {
      intitule: 'Tri',
      date: 'Récents',
      prix: 'Prix',
      priorite: 'Priorité',
      marque: 'Marque',
    },
    vue: {
      intitule: 'Vue',
      grille: 'Grille',
      categories: 'Catégories',
      marques: 'Marques',
    },
    pieces,
    aClasser: 'À classer',
    sansMarque: 'Sans marque',
    recherche: 'Une pièce, une marque, une couleur',
    ajouter: 'Ajouter',
  },

  vestiaire: {
    surTitre: (n: number) => `Mon Vestiaire · ${pieces(n)}`,
    titre: 'Le Vestiaire',
    vide: 'Ton Vestiaire est vide. Sur une fiche, *Je l’ai acheté* y range la pièce.',
    acheteEn: (mois: string) => `Acheté en ${mois}`,
    tri: {
      achat: 'Achats récents',
      prix: 'Prix',
      marque: 'Marque',
    },
  },

  /** Bascule sous l'en-tête (DESIGN.md, « Bascule Wishlist / Vestiaire »). */
  ecrans: {
    wishlist: 'Wishlist',
    vestiaire: 'Vestiaire',
    reglages: 'Réglages',
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
    achat: 'Achat',
    notes: 'Notes',
    voirEnBoutique: 'Voir en boutique',
    acheter: 'Je l’ai acheté',
    remettre: 'Remettre dans la Wishlist',
    modifier: 'Modifier',
    supprimer: 'Supprimer',
    acheteLe: (date: string) => `Acheté le ${date}`,
    /** Fiche d'une pièce ajoutée comme alternative : « Alternative à : <nom> ». */
    alternativeA: 'Alternative à :',
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
    remise: {
      titre: 'Remettre dans la Wishlist ?',
      message: 'Elle quitte ton Vestiaire.',
      confirmer: 'Remettre',
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
    /** Formulaire ouvert après une photo. */
    photo: {
      proposition: 'Fiche remplie depuis la proposition. *Vérifie-la* avant d’enregistrer.',
      alternative: 'C’est une alternative, pas l’article exact. *Vérifie la fiche* avant d’enregistrer.',
      depuisPhoto: 'Fiche commencée depuis ta photo. *Complète-la* avant d’enregistrer.',
      image: 'Photo de la pièce',
      maPhoto: 'Ma photo',
      boutique: 'Celle de la boutique',
      changer: 'Changer la photo',
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
    photo: {
      libelle: 'Prendre ou choisir une photo',
      phrase: 'On cherche la pièce en ligne.',
    },
    manuel: {
      libelle: 'Saisir à la main',
      phrase: 'Tu remplis la fiche toi-même.',
    },
  },

  /** Écran « Ajouter par photo » (docs/SPEC.md, « Parcours par photo »). */
  photo: {
    titre: 'Par photo',
    conseil: 'Cadre la pièce seule, en pleine lumière. *Une étiquette lisible* aide à trouver la marque.',
    prendre: 'Prendre une photo',
    choisir: 'Choisir dans la galerie',
    recherche: 'On cherche ta pièce…',
    resultats: 'Voici ce qu’on a trouvé. *Choisis la bonne pièce*.',
    seulementAlternatives: 'Pas l’article exact, mais des *pièces proches*.',
    aucun: 'Rien de trouvé pour cette photo. *Essaie un autre angle* ou saisis l’article.',
    propositions: (n: number) => (n <= 1 ? `${n} proposition` : `${n} propositions`),
    alternative: 'Alternative',
    alternativeAccessible: 'Alternative, pas l’article exact',
    autrePhoto: 'Une autre photo',
    saisir: 'Saisir à la main',
    cameraRefusee: 'L’appareil photo n’est pas autorisé. *Autorise-le dans les réglages d’Android*, ou choisis une photo.',
    photoIllisible: 'Cette photo ne s’ouvre pas. *Essaie-en une autre*.',
    echecs: {
      jeton_absent: 'Aucun jeton pour l’instant. *Ajoute-le dans les Réglages*, ou saisis l’article.',
      jeton_refuse: 'Le relais ne te reconnaît pas. *Vérifie ton jeton* dans les Réglages.',
      limite: 'Trop de demandes en une minute. *Réessaie dans un instant*.',
      quota_atteint: 'Les recherches du mois sont épuisées. *Saisis l’article* à la main.',
      injoignable: 'Le relais ne répond pas. *Vérifie ta connexion*, ou saisis l’article.',
      indisponible: 'La recherche est indisponible pour l’instant. *Saisis l’article* à la main.',
      photo_refusee: 'Cette photo ne passe pas. *Essaie-en une autre*.',
    },
  },

  /** Écran « Alternatives » d'une pièce de la Wishlist (docs/SPEC.md, lot 3, étape 2). */
  alternatives: {
    voir: 'Voir des alternatives',
    titre: 'Alternatives',
    /** {utilise} et {limite} sont remplacés par les nombres. */
    recherches: 'Recherches ce mois : {utilise} sur {limite}',
    cout: 'Une recherche en coûte une ou deux.',
    quotaAtteint: 'Les recherches du mois sont épuisées. *Elles reviennent le 1er*.',
    recherche: 'On cherche des pièces proches…',
    resultats: 'Les plus ressemblantes d’abord. *Touche une pièce* pour l’ajouter.',
    aucun: 'Rien de proche pour cette pièce. *Réessaie plus tard*.',
    compte: (n: number) => (n <= 1 ? `${n} alternative` : `${n} alternatives`),
    /** Écart de prix avec la pièce d'origine ; le montant arrive déjà écrit (« 30 € »). */
    ecart: {
      moins: (montant: string) => `${montant} de moins`,
      plus: (montant: string) => `${montant} de plus`,
      egal: 'Même prix',
    },
    reessayer: 'Réessayer',
    annonce: 'C’est une alternative à ta pièce. *Vérifie la fiche* avant d’enregistrer.',
    echecs: {
      jeton_absent: 'Aucun jeton pour l’instant. *Ajoute-le dans les Réglages*.',
      jeton_refuse: 'Le relais ne te reconnaît pas. *Vérifie ton jeton* dans les Réglages.',
      limite: 'Trop de demandes en une minute. *Réessaie dans un instant*.',
      quota_atteint: 'Les recherches du mois sont épuisées. *Elles reviennent le 1er*.',
      injoignable: 'Le relais ne répond pas. *Vérifie ta connexion* et réessaie.',
      indisponible: 'La recherche est indisponible pour l’instant. *Réessaie plus tard*.',
      photo_refusee: 'La photo de cette pièce ne passe pas. *Change-la* en modifiant la pièce.',
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
    /** Recherches par photo du mois (offre SerpApi limitée). */
    recherches: 'Recherches ce mois',
    /** {utilise} et {limite} sont remplacés par les nombres. */
    recherchesValeur: '{utilise} sur {limite}',
    recherchesSansReponse: 'Pas de réponse',
    quota: {
      alerte: 'Il reste *peu de recherches* ce mois-ci.',
      atteint: 'Les recherches du mois sont épuisées. *Elles reviennent le 1er*.',
    },
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
    menu: 'Ouvrir le menu',
    fermerMenu: 'Fermer le menu',
    fermerAjout: 'Fermer',
    rechercher: 'Rechercher',
    fermerRecherche: 'Fermer la recherche',
    ouvrirFiltres: 'Ouvrir les filtres',
    fermerFiltres: 'Fermer les filtres',
    retour: 'Retour',
  },
} as const;
