/**
 * Prix : lecture de ce que tape l'utilisateur et affichage à la française.
 * Les calculs se font en centimes (nombres entiers) pour éviter les erreurs d'arrondi.
 */

const ESPACE_FINE = ' '; // séparateur des milliers : 1 485
const ESPACE_INSECABLE = ' '; // avant le symbole : 1 485 €

export const enCentimes = (euros: number) => Math.round(euros * 100);

/** « 1 485 € », ou « 129,90 € » quand il y a des centimes. */
export function formaterPrix(euros: number): string {
  const centimes = enCentimes(euros);
  const entiers = Math.floor(centimes / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE);
  const reste = centimes % 100;
  const decimales = reste === 0 ? '' : ',' + reste.toString().padStart(2, '0');
  return `${entiers}${decimales}${ESPACE_INSECABLE}€`;
}

/**
 * Lit un prix saisi (« 129,90 », « 1 485 € », « 89.5 »).
 * Renvoie null si le champ est vide, 'invalide' s'il ne ressemble pas à un prix.
 */
export function lirePrix(saisie: string): number | null | 'invalide' {
  const nettoye = saisie.replace(/[\s  €]/g, '').replace(',', '.');
  if (nettoye === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(nettoye)) return 'invalide';
  return Number(nettoye);
}

/** Texte à remettre dans le champ prix quand on modifie un article : « 129,9 » → « 129,90 ». */
export function prixPourSaisie(euros: number | null): string {
  if (euros === null) return '';
  const centimes = enCentimes(euros);
  return centimes % 100 === 0 ? String(centimes / 100) : (centimes / 100).toFixed(2).replace('.', ',');
}
