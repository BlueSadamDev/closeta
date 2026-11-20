import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '@/theme';

type Option<T extends string> = { valeur: T; libelle: string };

/** Choix parmi quelques options : l'option choisie est en ink plein, les autres au filet fin. */
export function Choix<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: readonly Option<T>[];
  valeur: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.ligne}>
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <Pressable
            key={o.valeur}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
            onPress={() => onChange(o.valeur)}
            style={[styles.option, actif && styles.actif]}
          >
            <Text style={[type.button, { color: actif ? colors.paper : colors.ink }]}>{o.libelle}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  option: {
    minHeight: spacing.touchTarget,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: spacing.hairline,
    borderColor: colors.ink,
  },
  actif: { backgroundColor: colors.ink },
});
