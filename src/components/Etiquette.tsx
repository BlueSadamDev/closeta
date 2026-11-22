import { Text, type StyleProp, type TextStyle } from 'react-native';

import { colors, type } from '@/theme';

/** Petite étiquette en capitales (marque, filtres, sur-titre). */
export function Etiquette({
  children,
  style,
  lignes,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Nombre de lignes au plus (coupé par « … » au-delà). */
  lignes?: number;
}) {
  return (
    <Text style={[type.label, { color: colors.inkMuted }, style]} numberOfLines={lignes}>
      {children}
    </Text>
  );
}
