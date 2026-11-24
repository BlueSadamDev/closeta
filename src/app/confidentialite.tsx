import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Entete } from '@/components/Entete';
import { RichText } from '@/components/RichText';
import { settings } from '@/domain/settings';
import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

const t = texts.confidentialite;

/**
 * Écran « Confidentialité », ouvert depuis les Réglages : résumé en quelques lignes et lien vers
 * docs/CONFIDENTIALITE.md, ouvert dans le navigateur (docs/SPEC.md, « Lot 4 », « Étape 8 »).
 */
export default function Confidentialite() {
  const [echec, setEchec] = useState(false);

  const lire = async () => {
    setEchec(false);
    try {
      await Linking.openURL(settings.urlConfidentialite);
    } catch {
      setEchec(true);
    }
  };

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={[type.screenTitle, styles.titre]}>{t.titre}</Text>
        <View style={styles.lignes}>
          {t.resume.map((ligne) => (
            <RichText key={ligne} style={styles.ligne}>
              {ligne}
            </RichText>
          ))}
        </View>
        <View style={styles.actions}>
          <Bouton libelle={t.lire} variante="secondaire" onPress={lire} />
        </View>
        {echec ? <RichText style={styles.message}>{t.lienEchec}</RichText> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 6 },
  lignes: { marginTop: 24 },
  ligne: {
    ...type.body,
    color: colors.ink,
    paddingVertical: 14,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.ink,
  },
  actions: { marginTop: 28 },
  message: { ...type.body, color: colors.ink, marginTop: 20 },
});
