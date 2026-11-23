/**
 * Habillage d'une photo du Vestiaire : pièce détourée sur le téléphone, centrée sur le fond `photo3`
 * (docs/SPEC.md, « Lot 3 », « Étape 8 »). Aucune photo n'est envoyée.
 * Renvoie null si l'habillage échoue : l'app garde alors la photo d'origine.
 */
import Detourage from '../../modules/detourage';
import { boiteSujet, placement } from '@/domain/habillage';
import { settings } from '@/domain/settings';
import { colors } from '@/theme';

export async function habiller(uri: string): Promise<string | null> {
  if (!Detourage) return null;
  const h = settings.habillage;
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<null>((resoudre) => {
    minuteur = setTimeout(() => resoudre(null), h.delaiMs);
  });
  const travail = (async () => {
    const s = await Detourage.segmenterAsync(uri, h.confiance);
    const boite = boiteSujet(s.lignes, s.colonnes, h.bruit, h.partMinimale);
    if (!boite) return null;
    const sortie = { largeur: settings.photoVestiaire.largeur, hauteur: settings.photoVestiaire.hauteur };
    const { source, destination } = placement(boite, sortie, h.marges);
    return Detourage.composerAsync({
      decoupe: s.decoupe,
      sourceX: source.x,
      sourceY: source.y,
      sourceLargeur: source.largeur,
      sourceHauteur: source.hauteur,
      destX: destination.x,
      destY: destination.y,
      destLargeur: destination.largeur,
      destHauteur: destination.hauteur,
      sortieLargeur: sortie.largeur,
      sortieHauteur: sortie.hauteur,
      fond: colors.photo3,
      ombreDx: h.ombre.dx,
      ombreDy: h.ombre.dy,
      ombreOpacite: h.ombre.opacite,
      ombreFlou: h.ombre.flou,
      qualite: settings.photoVestiaireCompression,
    });
  })().catch(() => null);
  try {
    return await Promise.race([travail, delai]);
  } finally {
    clearTimeout(minuteur);
  }
}
