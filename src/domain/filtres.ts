import { texts } from './texts';
import type { Filtre } from './wishlist';

/**
 * Ce que montre la barre de filtres repliée après « Filtrer · » :
 * « Tout » sans filtre, sinon les choix actifs (type, priorité, catégorie). La recherche n'y figure pas.
 */
export function resumeDuFiltre(filtre: Filtre): string {
  const choix = [
    filtre.type === 'vetement' ? texts.wishlist.filtres.vetements : null,
    filtre.type === 'chaussures' ? texts.wishlist.filtres.chaussures : null,
    filtre.priorite ? texts.priorites[filtre.priorite] : null,
    filtre.categorie,
  ].filter((c): c is string => !!c);
  return choix.length === 0 ? texts.wishlist.filtres.tout : choix.join(' · ');
}
