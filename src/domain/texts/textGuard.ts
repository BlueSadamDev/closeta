/**
 * Vérifie qu'un texte respecte la charte de DESIGN.md (« Textes »).
 * Renvoie la liste des problèmes trouvés (vide si tout va bien).
 */

/** Mots à abandonner (glossaire) et traces de machinerie. */
const MOTS_INTERDITS = [
  'item',
  'items',
  'produit',
  'produits',
  'objet',
  'objets',
  'liste de souhaits',
  'favoris',
  'garde-robe',
  'dressing',
  'suggestion',
  'suggestions',
  'similaire',
  'similaires',
  'null',
  'undefined',
  'NaN',
  'erreur',
  'token',
  'inconnu',
  'inconnue',
];

const ESPACES_INSECABLES = [' ', ' '];

export function problemesDeTexte(texte: string): string[] {
  const problemes: string[] = [];

  if (texte.includes("'")) problemes.push('apostrophe droite : utiliser ’');
  if (texte.includes('"')) problemes.push('guillemets droits : utiliser « »');
  if (texte.includes('...')) problemes.push('trois points : utiliser …');
  if (/\(s\)|\(e\)|\(es\)/.test(texte)) problemes.push('faux pluriel « (s) » : écrire le vrai pluriel');
  if (/\p{Extended_Pictographic}/u.test(texte)) problemes.push('emoji interdit');

  for (const mot of MOTS_INTERDITS) {
    const motif = new RegExp(`(^|[^\\p{L}])${mot}($|[^\\p{L}])`, 'iu');
    if (motif.test(texte)) problemes.push(`mot à abandonner : « ${mot} »`);
  }

  [...texte].forEach((car, i) => {
    if ([':', ';', '!', '?'].includes(car) && i > 0 && !ESPACES_INSECABLES.includes(texte[i - 1])) {
      problemes.push(`espace insécable manquante avant « ${car} »`);
    }
  });

  const asterisques = (texte.match(/\*/g) ?? []).length;
  if (asterisques % 2 !== 0) problemes.push('relief mal fermé : astérisque seule');
  if (asterisques > 2) problemes.push('un seul élément en relief par message');

  return problemes;
}

/** Parcourt un objet de textes et renvoie chaque texte avec son chemin (ex. « accueil.attente »). */
export function listerTextes(objet: unknown, chemin = ''): { chemin: string; texte: string }[] {
  if (typeof objet === 'string') return [{ chemin, texte: objet }];
  if (typeof objet === 'function') {
    // Textes avec un nombre (pluriels) : on les vérifie pour 0, 1 et 2.
    return [0, 1, 2].flatMap((n) => listerTextes((objet as (n: number) => unknown)(n), `${chemin}(${n})`));
  }
  if (objet && typeof objet === 'object') {
    return Object.entries(objet).flatMap(([cle, valeur]) =>
      listerTextes(valeur, chemin ? `${chemin}.${cle}` : cle),
    );
  }
  return [];
}
