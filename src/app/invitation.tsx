import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Champ, Saisie } from '@/components/Champ';
import { Entete } from '@/components/Entete';
import { RichText } from '@/components/RichText';
import { hoteRelais } from '@/domain/configuration';
import { verifierInvitation } from '@/domain/invitation';
import { texts } from '@/domain/texts';
import { testerConnexion, utiliserInvitation } from '@/relay/client';
import { enregistrerAdresse, enregistrerJeton, lireAdresse } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const t = texts.invitation;

/**
 * Utilisation d'un code d'invitation (docs/SPEC.md, « Lot 4 », « Étape 6 ») : code saisi depuis les
 * Réglages (relais de ce téléphone), ou lien closeta://invitation ouvert par Android ou lu dans un QR.
 * Rien n'est utilisé ni enregistré sans « Utiliser le code » : le code ne sert qu'une fois.
 */
export default function Invitation() {
  const params = useLocalSearchParams<{ relais?: string; code?: string }>();
  // Arrivée par un lien : adresse et code viennent du lien ; sinon, saisie du code pour le relais rangé.
  const parLien = params.relais !== undefined || params.code !== undefined;
  const lien = parLien ? verifierInvitation(params.relais, params.code) : null;
  const [relaisRange, setRelaisRange] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);

  useEffect(() => {
    if (!parLien) lireAdresse().then(setRelaisRange);
  }, [parLien]);

  const relais = lien?.ok ? lien.relais : relaisRange;
  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const versReglages = () => router.dismissTo('/reglages');

  const utiliser = async () => {
    const lecture = lien ?? (relais ? verifierInvitation(relais, saisie) : null);
    if (!lecture?.ok) {
      setMessage(t.codeMalForme);
      return;
    }
    setEnCours(true);
    setMessage(null);
    const r = await utiliserInvitation(lecture.relais, lecture.code);
    if (!r.ok) {
      setEnCours(false);
      setMessage(t.echec[r.raison]);
      return;
    }
    await enregistrerAdresse(lecture.relais);
    await enregistrerJeton(r.jeton);
    const etat = await testerConnexion(r.jeton, lecture.relais);
    setEnCours(false);
    setResultat(texts.reglages.connexion[etat]);
  };

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={fermer} />} />
      <KeyboardAvoidingView behavior="padding" style={styles.ecran}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[type.screenTitle, styles.titre]}>{t.titre}</Text>
          {lien && !lien.ok ? (
            <>
              <RichText style={styles.texte}>{t.lienInvalide}</RichText>
              <View style={styles.boutons}>
                <Bouton libelle={texts.configuration.retour} variante="secondaire" onPress={versReglages} />
              </View>
            </>
          ) : resultat ? (
            <>
              <RichText style={styles.texte}>{resultat}</RichText>
              <View style={styles.boutons}>
                <Bouton libelle={texts.configuration.retour} onPress={versReglages} />
              </View>
            </>
          ) : relais ? (
            <>
              {lien?.ok ? (
                <>
                  <RichText style={styles.texte}>{t.question(hoteRelais(relais))}</RichText>
                  <Text style={[type.body, styles.code]}>{lien.code}</Text>
                </>
              ) : (
                <>
                  <RichText style={styles.texte}>{t.saisie(hoteRelais(relais))}</RichText>
                  <View style={styles.champ}>
                    <Champ libelle={t.code}>
                      <Saisie
                        value={saisie}
                        onChangeText={(v) => {
                          setSaisie(v);
                          setMessage(null);
                        }}
                        placeholder={t.codeExemple}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        autoFocus
                      />
                    </Champ>
                  </View>
                </>
              )}
              <Text style={[type.body, styles.secondaire]}>{texts.configuration.remplace}</Text>
              {enCours ? <Text style={styles.chargement}>{t.enCours}</Text> : null}
              {message ? <RichText style={styles.message}>{message}</RichText> : null}
              <View style={styles.boutons}>
                <Bouton libelle={t.utiliser} onPress={utiliser} desactive={enCours} />
                <Bouton libelle={t.annuler} variante="secondaire" onPress={fermer} desactive={enCours} />
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 20 },
  texte: { ...type.body, color: colors.ink },
  code: { fontFamily: fonts.sansMedium, color: colors.ink, marginTop: 12, letterSpacing: 1 },
  champ: { marginTop: 20 },
  secondaire: { color: colors.inkMuted, marginTop: 12 },
  chargement: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  message: { ...type.body, color: colors.ink, marginTop: 20 },
  boutons: { gap: 12, marginTop: 28 },
});
