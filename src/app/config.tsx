import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Entete } from '@/components/Entete';
import { RichText } from '@/components/RichText';
import { hoteRelais, verifierConfiguration } from '@/domain/configuration';
import { texts } from '@/domain/texts';
import { testerConnexion } from '@/relay/client';
import { enregistrerAdresse, enregistrerJeton } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const t = texts.configuration;

/**
 * Confirmation d'une configuration : QR scanné dans les Réglages, ou lien closeta://config ouvert
 * par Android (QR lu avec l'appareil photo du téléphone). Rien n'est enregistré sans « Configurer ».
 */
export default function Config() {
  const params = useLocalSearchParams<{ relais?: string; jeton?: string }>();
  const config = verifierConfiguration(params.relais, params.jeton);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const versReglages = () => router.dismissTo('/reglages');

  const configurer = async () => {
    if (!config.ok) return;
    setEnCours(true);
    await enregistrerAdresse(config.relais);
    await enregistrerJeton(config.jeton);
    const etat = await testerConnexion(config.jeton, config.relais);
    setEnCours(false);
    setResultat(texts.reglages.connexion[etat]);
  };

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={fermer} />} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={[type.screenTitle, styles.titre]}>{t.titre}</Text>
        {!config.ok ? (
          <>
            <RichText style={styles.texte}>{t.invalide}</RichText>
            <View style={styles.boutons}>
              <Bouton libelle={t.retour} variante="secondaire" onPress={versReglages} />
            </View>
          </>
        ) : resultat ? (
          <>
            <RichText style={styles.texte}>{resultat}</RichText>
            <View style={styles.boutons}>
              <Bouton libelle={t.retour} onPress={versReglages} />
            </View>
          </>
        ) : (
          <>
            <RichText style={styles.texte}>{t.question(hoteRelais(config.relais))}</RichText>
            <Text style={[type.body, styles.secondaire]}>{t.remplace}</Text>
            {enCours ? <Text style={styles.chargement}>{t.enCours}</Text> : null}
            <View style={styles.boutons}>
              <Bouton libelle={t.confirmer} onPress={configurer} desactive={enCours} />
              <Bouton libelle={t.annuler} variante="secondaire" onPress={fermer} desactive={enCours} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 20 },
  texte: { ...type.body, color: colors.ink },
  secondaire: { color: colors.inkMuted, marginTop: 12 },
  chargement: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  boutons: { gap: 12, marginTop: 28 },
});
