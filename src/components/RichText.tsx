import { Text, type StyleProp, type TextStyle } from 'react-native';

import { parseRelief } from '@/domain/texts/relief';
import { type } from '@/theme';

type Props = {
  /** Texte venant de src/domain/texts/, avec le relief balisé *…*. */
  children: string;
  style?: StyleProp<TextStyle>;
};

/** Affiche un texte de la charte : le morceau entre astérisques est mis en relief. */
export function RichText({ children, style }: Props) {
  return (
    <Text style={style}>
      {parseRelief(children).map((s, i) =>
        s.relief ? (
          <Text key={i} style={type.relief}>
            {s.texte}
          </Text>
        ) : (
          s.texte
        ),
      )}
    </Text>
  );
}
