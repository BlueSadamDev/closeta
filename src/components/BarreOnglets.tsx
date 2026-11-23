import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { MotFiltre } from './MotFiltre';

/**
 * Barre fixée en bas : un mot en capitales par onglet, sans icône ; actif = ink souligné
 * (DESIGN.md, « Barre d'onglets »).
 */
export function BarreOnglets({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.barre, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const actif = index === state.index;
        const libelle = descriptors[route.key]?.options.title ?? route.name;
        const toucher = () => {
          const evenement = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!actif && !evenement.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <View key={route.key} style={styles.onglet}>
            <MotFiltre libelle={libelle} actif={actif} onPress={toucher} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.ink,
    marginHorizontal: spacing.screen,
  },
  onglet: { flex: 1, alignItems: 'center', minHeight: spacing.touchTarget + 8, justifyContent: 'center' },
});
