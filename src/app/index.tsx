import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RichText } from '@/components/RichText';
import { Wordmark } from '@/components/Wordmark';
import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

/** Accueil provisoire (étape 1) : en-tête et une phrase. La Wishlist arrive à l'étape 2. */
export default function Accueil() {
  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <View style={styles.entete}>
        <Wordmark />
      </View>
      <View style={styles.contenu}>
        <RichText style={styles.phrase}>{texts.accueil.attente}</RichText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  entete: {
    minHeight: spacing.touchTarget + 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: spacing.hairline,
    borderBottomColor: colors.ink,
    marginHorizontal: spacing.screen,
  },
  contenu: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.screen },
  phrase: { ...type.body, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: 'center' },
});
