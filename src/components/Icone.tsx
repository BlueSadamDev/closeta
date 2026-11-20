import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Icônes au trait fin (1,4 px), couleur du texte (DESIGN.md, « Principes »). */
const TRACES = {
  recherche: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.2 15.2 20 20',
  fermer: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  retour: 'M15 5l-7 7 7 7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  lien: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  crayon: 'M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4',
} as const;

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, couleur = colors.ink, taille = 22 }: { nom: NomIcone; couleur?: string; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none">
      <Path d={TRACES[nom]} stroke={couleur} strokeWidth={1.4} strokeLinecap="square" strokeLinejoin="miter" />
    </Svg>
  );
}
