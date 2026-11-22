/** Réponses fictives du relais /identify (boutique.example est un domaine réservé aux exemples). */
export const DESCRIPTION_FICTIVE = {
  type: 'vetement',
  categorie: 'Veste',
  couleur: 'marron',
  matiere: 'velours côtelé',
  marque: 'Maison Fictive',
  recherche: 'veste velours côtelé marron',
};

export const PROPOSITION_EXACTE = {
  nom: 'Veste en velours Maison Fictive',
  marque: 'Maison Fictive',
  image: 'https://cdn.boutique.example/veste.jpg',
  prix: 249,
  devise: 'EUR',
  boutique: 'Boutique Exemple',
  url: 'https://boutique.example/veste-velours',
  alternative: false,
};

export const ALTERNATIVE_SANS_PRIX = {
  nom: 'Veste velours camel',
  marque: null,
  image: null,
  prix: null,
  devise: null,
  boutique: 'Autre Boutique',
  url: 'https://autre.example/veste',
  alternative: true,
};

export const REPONSE_IDENTIFY = {
  description: DESCRIPTION_FICTIVE,
  resultats: [PROPOSITION_EXACTE, ALTERNATIVE_SANS_PRIX],
};
