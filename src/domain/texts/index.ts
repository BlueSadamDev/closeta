/**
 * Tous les textes affichés par ClosetA.
 * Charte : DESIGN.md, section « Textes » (tutoiement, typographie française, relief balisé *…*).
 * Le test textGuard.test.ts vérifie automatiquement ces règles.
 * Espaces :   = insécable (avant : ; ! ? et €),   = fine insécable.
 */

/** Relais plus récent que l'app (version minimale non atteinte) : même message partout. */
const miseAJour = '*Mets ClosetA à jour* pour continuer.';

const pieces = (n: number) => (n <= 1 ? `${n} pièce` : `${n} pièces`);
const photos = (n: number) => (n === 0 ? 'aucune photo' : n === 1 ? '1 photo' : `${n} photos`);

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
    /** Étiquettes des cartes, d'après le dernier relevé. */
    alertes: {
      baisse: 'Baisse',
      epuise: 'Épuisé',
    },
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
    /** Étiquette d'une pièce sans date d'achat. */
    nonDate: 'Achat non daté',
    ajouter: 'Ajouter',
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
    /** Prix et disponibilité actualisés (docs/SPEC.md, lot 3, étape 3). Le montant arrive déjà écrit (« 25 € »). */
    baisse: (montant: string) => `*−${montant}* depuis l’ajout`,
    hausse: (montant: string) => `+${montant} depuis l’ajout`,
    enStockEn: (taille: string) => `En stock en ${taille}`,
    epuiseEn: (taille: string) => `Épuisé en ${taille}`,
    epuise: 'Épuisé',
    /** Bandeau en tête de fiche d'une pièce épuisée (docs/SPEC.md, lot 3, étape 4). */
    bandeauEpuiseEn: (taille: string) => `Épuisé en ${taille}. *Voir des alternatives*`,
    bandeauEpuise: 'Épuisé. *Voir des alternatives*',
    verifieLe: (date: string) => `Vérifié le ${date}`,
    historique: 'Historique des prix',
    sansPrix: 'Sans prix',
    /** Fiche d'une pièce ajoutée comme alternative : « Alternative à : <nom> ». */
    alternativeA: 'Alternative à :',
    nonDate: 'Non daté',
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
    /** Restauration d'une sauvegarde (Réglages) : résumé du fichier, puis remplacement de tout. */
    restauration: {
      titre: 'Remplacer tes données ?',
      message: (nbPieces: number, nbPhotos: number = nbPieces) =>
        `${pieces(nbPieces)}, ${photos(nbPhotos)}. Elles remplacent tout ce qui est sur ce téléphone : Wishlist, Vestiaire et photos.`,
      confirmer: 'Remplacer',
    },
    revocation: {
      titre: 'Révoquer ce téléphone ?',
      message: 'Il ne pourra plus utiliser le relais. Les autres téléphones continuent.',
      confirmer: 'Révoquer',
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
      prixPaye: 'Prix payé en euros',
      dateAchat: 'Date d’achat',
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
      dateAchat: '14/11/2026',
      lien: 'Colle le lien ici',
      notes: 'Une idée de tenue, un détail à vérifier…',
    },
    erreurs: {
      nomManquant: 'Donne-lui *un nom*.',
      typeManquant: 'Choisis *vêtement ou chaussures*.',
      prixInvalide: 'Écris un prix *comme 129,90*.',
      lienInvalide: 'Ce lien semble incomplet. *Colle-le en entier*.',
      dateInvalide: 'Écris une date passée, *comme 14/11/2026*.',
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
        mise_a_jour_requise: miseAJour,
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
      /** Vestiaire : photo habillée (pièce détourée sur fond uni) ou photo d'origine. */
      habillee: 'Habillée',
      origine: 'D’origine',
    },
    aujourdhui: 'Aujourd’hui',
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
    /** Rappel sur chaque écran photo : la photo peut partir chez Google Lens (docs/CONFIDENTIALITE.md). */
    rappel: 'Photographie la pièce seule, sans personne.',
    /** Prise de vue guidée du Vestiaire (docs/SPEC.md, « Lot 3 », « Étape 7 »). */
    guidee: {
      consigne: 'Suspends la pièce sur un cintre, devant un mur uni. *Entière dans le cadre*, crochet en haut.',
      prendre: 'Prendre la photo',
      galerie: 'Choisir dans la galerie',
      preparation: 'On prépare ta photo…',
      prete: 'Ta photo est prête. *Identifie la pièce* pour remplir la fiche, ou continue à la main.',
      identifier: 'Identifier la pièce',
      continuer: 'Continuer sans identifier',
      sansHabillage: 'La pièce n’a pas pu être détourée. *La photo d’origine est gardée*.',
    },
    echecs: {
      jeton_absent: 'Aucun jeton pour l’instant. *Ajoute-le dans les Réglages*, ou saisis l’article.',
      jeton_refuse: 'Le relais ne te reconnaît pas. *Vérifie ton jeton* dans les Réglages.',
      limite: 'Trop de demandes en une minute. *Réessaie dans un instant*.',
      quota_atteint: 'Les recherches du mois sont épuisées. *Saisis l’article* à la main.',
      mise_a_jour_requise: miseAJour,
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
      mise_a_jour_requise: miseAJour,
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
    /** Section « Relais » (docs/SPEC.md, « Lot 3 », « Étape 10 »). */
    sectionRelais: 'Relais',
    adresse: 'Adresse du relais',
    adresseRefusee: 'Cette adresse ne convient pas. *Saisis une adresse en https*.',
    jeton: 'Jeton du relais',
    jetonExemple: 'Colle ton jeton ici',
    enregistrer: 'Enregistrer',
    enregistre: 'Réglages *enregistrés*.',
    scanner: 'Scanner un QR de configuration',
    afficherQr: 'Afficher le QR de ce téléphone',
    masquerQr: 'Masquer le QR',
    /** Sous chaque QR de configuration affiché : il contient un jeton. */
    qrMiseEnGarde: 'Ce code donne accès à ton relais. Ne le partage qu’avec le téléphone à configurer.',
    /** Section « Installations » : seulement avec un jeton d'administration rangé sur ce téléphone. */
    sectionInstallations: 'Installations',
    jetonAdmin: 'Jeton d’administration',
    jetonAdminExemple: 'Seulement sur le téléphone qui gère le relais',
    jetonAdminEnregistre: 'Jeton d’administration *enregistré*.',
    jetonAdminEfface: 'Jeton d’administration *effacé*.',
    installations: {
      chargement: 'On interroge le relais…',
      principale: 'Jeton d’origine',
      ajouteLe: (date: string) => `Ajouté le ${date}`,
      recherches: (n: number) => (n <= 1 ? `${n} recherche ce mois` : `${n} recherches ce mois`),
      revoque: 'Révoqué',
      revoquer: 'Révoquer',
      revocationFaite: 'Téléphone *révoqué*. Le relais le refuse d’ici une minute.',
      ajouter: 'Ajouter un téléphone',
      nom: 'Nom du téléphone',
      nomExemple: 'Pixel du salon',
      nomManquant: 'Ce téléphone n’a pas de nom. *Donne-lui un nom*.',
      creer: 'Créer le QR',
      creation: 'On prépare l’accès…',
      /** Le QR d'un téléphone ajouté ne s'affiche qu'une fois (le relais ne redonne jamais son jeton). */
      nouveauQr: (nom: string) => `Scanne ce code depuis *${nom}*. Il ne s’affichera plus.`,
      termine: 'C’est scanné',
      echec: {
        jeton_absent: 'Aucun jeton d’administration. *Colle-le* au-dessus.',
        jeton_refuse: 'Le relais ne reconnaît pas ce jeton d’administration. *Vérifie-le*.',
        limite: 'Trop de demandes en une minute. *Réessaie dans un instant*.',
        injoignable: 'Le relais ne répond pas. *Vérifie ta connexion* et réessaie.',
        inattendu: 'Le relais a répondu de façon inattendue. *Réessaie plus tard*.',
      },
    },
    /** Section « Sauvegarde » (docs/SPEC.md, « Lot 3 », « Étape 11 »). */
    /** Section « Recherches » : genre appliqué aux alternatives (docs/SPEC.md, « Lot 3 », « Étape 12 »). */
    sectionRecherches: 'Recherches',
    genre: 'Je cherche pour',
    genres: { femme: 'Femme', homme: 'Homme', mixte: 'Mixte' },
    genreAide: 'Les alternatives proposées suivent ce choix. Mixte : aucun filtre.',
    sectionSauvegarde: 'Sauvegarde',
    sauvegarde: {
      explication: 'Un fichier avec toutes tes pièces et leurs photos, à ranger où tu veux. Sans jeton ni réglage du relais.',
      sauvegarder: 'Sauvegarder',
      restaurer: 'Restaurer',
      preparation: 'On prépare ta sauvegarde…',
      lecture: 'On lit le fichier…',
      remplacement: 'On remet tes pièces en place…',
      partage_indisponible: 'Le partage ne s’ouvre pas sur ce téléphone. *Réessaie plus tard*.',
      echec: 'La sauvegarde ne s’est pas faite. *Réessaie*.',
      illisible: 'Ce fichier n’est pas une sauvegarde ClosetA lisible. *Choisis un autre fichier*.',
      version_recente: 'Cette sauvegarde vient d’une version plus récente de ClosetA. *Mets l’app à jour*, puis réessaie.',
      restauree: 'Sauvegarde *restaurée*.',
      nonRestauree: 'Rien n’a changé sur ce téléphone. *Réessaie*.',
    },
    /** Section « Confidentialité » (docs/SPEC.md, « Lot 4 », « Étape 8 »). */
    sectionConfidentialite: 'Confidentialité',
    confidentialite: 'Ce que deviennent tes données',
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
      mise_a_jour_requise: miseAJour,
      injoignable: 'Le relais ne répond pas. *Vérifie ta connexion* et réessaie.',
      inattendu: 'Le relais a répondu de façon inattendue. *Réessaie plus tard*.',
    },
  },

  /** Écran « Confidentialité » : résumé de docs/CONFIDENTIALITE.md (docs/SPEC.md, « Lot 4 », « Étape 8 »). */
  confidentialite: {
    titre: 'Confidentialité',
    resume: [
      'Ta Wishlist, ton Vestiaire et tes photos restent *sur ton téléphone*.',
      'Le relais lit les pages des boutiques et lance les recherches. Il garde seulement le nom de ton installation et le nombre de tes recherches du mois.',
      'Il tient aussi un catalogue anonyme des pièces et des prix observés, *sans lien avec toi*.',
      'Une photo envoyée passe par Google Lens, via SerpApi, puis elle est *effacée du relais*.',
      'Aucune publicité, aucune statistique, aucun suivi.',
    ],
    lire: 'Lire le document complet',
    lienEchec: 'Le document ne s’ouvre pas. *Vérifie ta connexion*.',
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
    fermerPriseDeVue: 'Fermer la prise de vue',
    fermerScanner: 'Fermer le lecteur de QR',
    qrConfiguration: 'QR de configuration',
    agrandirPhoto: 'Agrandir la photo',
    photoAgrandie: 'Photo agrandie. Pince pour zoomer, touche pour fermer.',
    fermerPhoto: 'Fermer la photo',
  },

  /** Lecteur de QR de configuration (Réglages). */
  scanner: {
    consigne: 'Vise le QR de configuration affiché sur l’autre téléphone.',
    cameraRefusee: 'L’appareil photo n’est pas autorisé. *Autorise-le dans les réglages d’Android*.',
    etranger: 'Ce code n’est pas un QR de configuration ClosetA. *Vise le bon code*.',
    adresse: 'Ce code donne une adresse de relais non sécurisée. *Demande un nouveau code*.',
    jeton: 'Ce code ne contient pas de jeton. *Demande un nouveau code*.',
  },

  /** Confirmation d'une configuration (QR scanné ou lien closeta://config ouvert). */
  configuration: {
    titre: 'Configurer',
    question: (hote: string) => `Relier ce téléphone au relais *${hote}* ?`,
    remplace: 'L’adresse et le jeton actuels de ce téléphone seront remplacés.',
    confirmer: 'Configurer',
    annuler: 'Annuler',
    enCours: 'On vérifie l’accès…',
    invalide: 'Ce lien de configuration ne convient pas. *Demande un nouveau code*.',
    retour: 'Retour aux Réglages',
  },
} as const;
