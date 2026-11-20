import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Champ, Saisie } from '@/components/Champ';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { RichText } from '@/components/RichText';
import { nettoyerJeton } from '@/domain/relais';
import { texts } from '@/domain/texts';
import { testerConnexion } from '@/relay/client';
import { enregistrerJeton, lireJeton } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const r = texts.reglages;

/** Écran Réglages : jeton du relais, test de connexion, version (docs/SPEC.md, « 5. Réglages »). */
export default function Reglages() {
  const [jeton, setJeton] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    lireJeton().then(setJeton);
  }, []);

  const changer = (valeur: string) => {
    setJeton(valeur);
    setMessage(null);
  };

  const enregistrer = async () => {
    const propre = nettoyerJeton(jeton);
    await enregistrerJeton(propre);
    setJeton(propre);
    setMessage(propre ? r.enregistre : r.connexion.jeton_absent);
  };

  const tester = async () => {
    setEnCours(true);
    setMessage(null);
    const etat = await testerConnexion(nettoyerJeton(jeton));
    setEnCours(false);
    setMessage(r.connexion[etat]);
  };

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={() => router.back()} />} />
      <KeyboardAvoidingView behavior="padding" style={styles.ecran}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[type.screenTitle, styles.titre]}>{r.titre}</Text>

          <Champ libelle={r.jeton}>
            <Saisie
              value={jeton}
              onChangeText={changer}
              placeholder={r.jetonExemple}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Champ>

          <View style={styles.boutons}>
            <Bouton libelle={r.enregistrer} onPress={enregistrer} desactive={enCours} />
            <Bouton libelle={r.tester} variante="secondaire" onPress={tester} desactive={enCours} />
          </View>

          {enCours ? <Text style={styles.chargement}>{r.testEnCours}</Text> : null}
          {message ? <RichText style={styles.message}>{message}</RichText> : null}

          <View style={styles.version}>
            <Etiquette>{r.version}</Etiquette>
            <Text style={[type.body, styles.valeur]}>{Constants.expoConfig?.version ?? ''}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 6 },
  boutons: { gap: 12, marginTop: 28 },
  chargement: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  message: { ...type.body, color: colors.ink, marginTop: 20 },
  version: {
    marginTop: 48,
    paddingTop: 16,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.ink,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valeur: { color: colors.ink },
});
