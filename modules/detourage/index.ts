import { requireOptionalNativeModule } from 'expo';

/** Résultat du détourage : la photo détourée (PNG transparent) et le nombre de pixels de la pièce par ligne et par colonne. */
export type Segmentation = {
  decoupe: string;
  largeur: number;
  hauteur: number;
  lignes: number[];
  colonnes: number[];
};

export type OptionsComposition = {
  decoupe: string;
  sourceX: number;
  sourceY: number;
  sourceLargeur: number;
  sourceHauteur: number;
  destX: number;
  destY: number;
  destLargeur: number;
  destHauteur: number;
  sortieLargeur: number;
  sortieHauteur: number;
  /** Couleur du fond, « #RRGGBB ». */
  fond: string;
  ombreDx: number;
  ombreDy: number;
  ombreOpacite: number;
  ombreFlou: number;
  /** Qualité JPEG, de 0 à 1. */
  qualite: number;
};

type ModuleDetourage = {
  segmenterAsync(uri: string, confiance: number): Promise<Segmentation>;
  composerAsync(options: OptionsComposition): Promise<string>;
};

/** null hors de l'APK (tests, web) : l'habillage est alors simplement ignoré. */
export default requireOptionalNativeModule<ModuleDetourage>('Detourage');
