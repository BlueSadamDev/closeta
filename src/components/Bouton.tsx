import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '@/theme';

import { Icone, type NomIcone } from './Icone';

type Props = {
  libelle: string;
  onPress: () => void;
  /** principal : fond ink ; secondaire : filet ink ; danger : texte rouge, sans fond. */
  variante?: 'principal' | 'secondaire' | 'danger';
  icone?: NomIcone;
  desactive?: boolean;
};

/** Boutons de DESIGN.md (« Composants »). */
export function Bouton({ libelle, onPress, variante = 'principal', icone, desactive = false }: Props) {
  const couleurTexte = variante === 'principal' ? colors.paper : variante === 'danger' ? colors.danger : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desactive }}
      disabled={desactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variante === 'principal' && styles.principal,
        variante === 'secondaire' && styles.secondaire,
        (pressed || desactive) && styles.appuye,
      ]}
    >
      <View style={styles.contenu}>
        {icone ? <Icone nom={icone} couleur={couleurTexte} taille={18} /> : null}
        <Text style={[type.button, { color: couleurTexte }]}>{libelle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: spacing.buttonHeight,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principal: { backgroundColor: colors.ink },
  secondaire: { borderWidth: spacing.hairline, borderColor: colors.ink },
  appuye: { opacity: 0.6 },
  contenu: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
