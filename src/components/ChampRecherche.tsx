import { StyleSheet, TextInput, View } from 'react-native';

import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

/** Champ de recherche texte, ouvert par l'icône loupe de l'en-tête. */
export function ChampRecherche({ valeur, onChange }: { valeur: string; onChange: (texte: string) => void }) {
  return (
    <View style={styles.recherche}>
      <TextInput
        autoFocus
        value={valeur}
        onChangeText={onChange}
        placeholder={texts.wishlist.recherche}
        placeholderTextColor={colors.inkMuted}
        style={styles.champ}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  recherche: { marginTop: 16, borderBottomWidth: spacing.hairline, borderBottomColor: colors.ink },
  champ: { ...type.body, color: colors.ink, height: spacing.touchTarget, paddingHorizontal: 0 },
});
