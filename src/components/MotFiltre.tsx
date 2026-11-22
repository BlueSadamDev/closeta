import { Pressable, StyleSheet } from 'react-native';

import { colors, spacing } from '@/theme';

import { Etiquette } from './Etiquette';

/** Un mot de filtre ou de bascule : actif = ink souligné, inactif = inkMuted (DESIGN.md, « Filtres »). */
export function MotFiltre({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={onPress} style={styles.zone}>
      <Etiquette style={[styles.mot, actif && styles.actif]}>{libelle}</Etiquette>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: { minHeight: spacing.touchTarget, justifyContent: 'center' },
  mot: { paddingBottom: 4, borderBottomWidth: spacing.hairline, borderBottomColor: 'transparent' },
  actif: { color: colors.ink, borderBottomColor: colors.ink },
});
