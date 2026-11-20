import { Pressable, StyleSheet } from 'react-native';

import { spacing } from '@/theme';

import { Icone, type NomIcone } from './Icone';

/** Icône touchable, avec une zone tactile de 44 px minimum. */
export function BoutonIcone({ nom, libelle, onPress }: { nom: NomIcone; libelle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress} hitSlop={4} style={styles.zone}>
      <Icone nom={nom} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: { width: spacing.touchTarget, height: spacing.touchTarget, alignItems: 'center', justifyContent: 'center' },
});
