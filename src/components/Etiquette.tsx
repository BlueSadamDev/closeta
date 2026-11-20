import { Text, type StyleProp, type TextStyle } from 'react-native';

import { colors, type } from '@/theme';

/** Petite étiquette en capitales (marque, filtres, sur-titre). */
export function Etiquette({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.label, { color: colors.inkMuted }, style]}>{children}</Text>;
}
