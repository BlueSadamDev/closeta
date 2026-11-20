import { Text } from 'react-native';

import { colors, letterSpacing, type } from '@/theme';

/** Mot-symbole « CLOSETA » (DESIGN.md, « Identité »). */
export function Wordmark({ size = type.wordmark.fontSize }: { size?: number }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: type.wordmark.fontFamily,
        fontSize: size,
        letterSpacing: letterSpacing(0.32, size),
        color: colors.ink,
        // L'espacement s'ajoute aussi après la dernière lettre : on le compense pour bien centrer.
        marginRight: -letterSpacing(0.32, size),
      }}
    >
      CLOSETA
    </Text>
  );
}
