import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Wordmark } from './Wordmark';

/** En-tête : un élément à gauche, le mot-symbole centré, un élément à droite ; filet ink dessous. */
export function Entete({ gauche, droite }: { gauche?: ReactNode; droite?: ReactNode }) {
  return (
    <View style={styles.entete}>
      <View style={styles.cote}>{gauche}</View>
      <Wordmark />
      <View style={[styles.cote, styles.droite]}>{droite}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: {
    height: spacing.touchTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: spacing.hairline,
    borderBottomColor: colors.ink,
    marginHorizontal: spacing.screen,
  },
  cote: { width: spacing.touchTarget, marginLeft: -10 },
  droite: { marginLeft: 0, marginRight: -10, alignItems: 'flex-end' },
});
