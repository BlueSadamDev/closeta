/**
 * Thème ClosetA : couleurs, polices, tailles de texte et espacements.
 * Source : DESIGN.md (piste A « Éditorial »). Si une valeur change, modifier DESIGN.md d'abord.
 */

export const colors = {
  paper: '#F6F3EE',
  ink: '#15130F',
  inkMuted: '#6B6258',
  tobacco: '#8A5A3B',
  photo1: '#D9CFC1',
  photo2: '#C9B9A4',
  photo3: '#E4DDD2',
  danger: '#9B2C2C',
} as const;

/** Noms des polices tels qu'ils sont chargés dans src/app/_layout.tsx. */
export const fonts = {
  serifMedium: 'CormorantGaramond_500Medium',
  serifSemiBold: 'CormorantGaramond_600SemiBold',
  serifItalic: 'CormorantGaramond_500Medium_Italic',
  sans: 'Jost_400Regular',
  sansMedium: 'Jost_500Medium',
} as const;

/** Fichiers des polices, à charger au démarrage de l'app. */
export const fontFiles = {
  [fonts.serifMedium]: require('../assets/fonts/CormorantGaramond_500Medium.ttf'),
  [fonts.serifSemiBold]: require('../assets/fonts/CormorantGaramond_600SemiBold.ttf'),
  [fonts.serifItalic]: require('../assets/fonts/CormorantGaramond_500Medium_Italic.ttf'),
  [fonts.sans]: require('../assets/fonts/Jost_400Regular.ttf'),
  [fonts.sansMedium]: require('../assets/fonts/Jost_500Medium.ttf'),
};

/** Convertit un espacement des lettres en em (DESIGN.md) en pixels pour React Native. */
export const letterSpacing = (em: number, fontSize: number) => em * fontSize;

/** Rôles typographiques (DESIGN.md, « Typographie »). */
export const type = {
  wordmark: { fontFamily: fonts.serifSemiBold, fontSize: 22, letterSpacing: letterSpacing(0.32, 22) },
  screenTitle: { fontFamily: fonts.serifItalic, fontSize: 44, lineHeight: 44 },
  total: { fontFamily: fonts.serifSemiBold, fontSize: 22 },
  gridName: { fontFamily: fonts.serifMedium, fontSize: 19 },
  sheetName: { fontFamily: fonts.serifMedium, fontSize: 32 },
  gridPrice: { fontFamily: fonts.sans, fontSize: 13 },
  sheetPrice: { fontFamily: fonts.serifSemiBold, fontSize: 24 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: letterSpacing(0.18, 11),
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  button: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: letterSpacing(0.2, 12),
    textTransform: 'uppercase',
  },
  /** Mise en relief d'un mot dans un texte (balise *…* dans src/domain/texts/). */
  relief: { fontFamily: fonts.serifItalic },
} as const;

/** Espacements et formes (DESIGN.md, « Espacements et formes »). */
export const spacing = {
  screen: 24,
  gridColumnGap: 14,
  gridRowGap: 22,
  gridPhotoHeight: 196,
  touchTarget: 44,
  buttonHeight: 52,
  sheetRowHeight: 64,
  hairline: 1,
} as const;
