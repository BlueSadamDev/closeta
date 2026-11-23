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
import { nettoyerJeton, niveauQuota, type Quota } from '@/domain/relais';
import { texts } from '@/domain/texts';
import { lireQuotaRelais, testerConnexion } from '@/relay/client';
import { enregistrerJeton, lireJeton } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const r = texts.reglages;

/**
 * Écran Réglages : jeton du relais, test de connexion, recherches du mois, version
 * (docs/SPEC.md, « 5. Réglages » et « Lot 3 », étape 1).
 */
export default function Reglages() {
  const [jeton, setJeton] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  // Recherches du mois : undefined = pas de jeton (ligne masquée), null = le relais n'a pas répondu.
  const [quota, setQuota] = useState<Quota | null | undefined>(undefined);

  const actualiserQuota = async (j: string) => setQuota(j ? await lireQuotaRelais(j) : undefined);

  useEffect(() => {
    lireJeton().then((j) => {
      setJeton(j);
      actualiserQuota(j);
    });
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
    actualiserQuota(propre);
  };

  const tester = async () => {
    setEnCours(true);
    setMessage(null);
    const etat = await testerConnexion(nettoyerJeton(jeton));
    setEnCours(false);
    setMessage(r.connexion[etat]);
    if (etat === 'ok') actualiserQuota(nettoyerJeton(jeton));
  };

  const niveau = quota ? niveauQuota(quota) : 'normal';

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

          <View style={styles.lignes}>
            {quota !== undefined ? (
              <View style={styles.ligne}>
                <View style={styles.ligneHaut}>
                  <Etiquette>{r.recherches}</Etiquette>
                  {quota ? (
                    <Text style={[type.body, styles.valeur]}>
                      {r.recherchesValeur.replace('{utilise}', String(quota.utilise)).replace('{limite}', String(quota.limite))}
                    </Text>
                  ) : (
                    <Text style={[type.body, styles.manquant]}>{r.recherchesSansReponse}</Text>
                  )}
                </View>
                {niveau !== 'normal' ? <RichText style={styles.miseEnGarde}>{r.quota[niveau]}</RichText> : null}
              </View>
            ) : null}
            <View style={[styles.ligne, styles.ligneHaut]}>
              <Etiquette>{r.version}</Etiquette>
              <Text style={[type.body, styles.valeur]}>{Constants.expoConfig?.version ?? ''}</Text>
            </View>
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
  lignes: { marginTop: 48 },
  ligne: { paddingVertical: 16, borderTopWidth: spacing.hairline, borderTopColor: colors.ink },
  ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valeur: { color: colors.ink },
  manquant: { color: colors.inkMuted },
  miseEnGarde: { ...type.body, color: colors.ink, marginTop: 8 },
});
