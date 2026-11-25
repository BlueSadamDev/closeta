import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Champ, Saisie } from '@/components/Champ';
import { CodeQR } from '@/components/CodeQR';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { RichText } from '@/components/RichText';
import { SectionInstallations } from '@/components/SectionInstallations';
import { SectionRecherches } from '@/components/SectionRecherches';
import { SectionSauvegarde } from '@/components/SectionSauvegarde';
import { lienConfiguration, lireAdresseRelais } from '@/domain/configuration';
import { nettoyerJeton, niveauQuota, type Quota } from '@/domain/relais';
import { settings } from '@/domain/settings';
import { texts } from '@/domain/texts';
import { lireQuotaRelais, testerConnexion } from '@/relay/client';
import {
  enregistrerAdresse,
  enregistrerJeton,
  enregistrerJetonAdmin,
  lireAdresse,
  lireJeton,
  lireJetonAdmin,
} from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const r = texts.reglages;

/**
 * Écran Réglages : relais (adresse, jeton, test, QR de configuration), recherches du mois,
 * sauvegarde et restauration, installations (avec un jeton d'administration), version
 * (docs/SPEC.md, « 5. Réglages » et « Lot 3 », étapes 1, 10 et 11).
 */
export default function Reglages() {
  const ecran = useWindowDimensions();
  const [adresse, setAdresse] = useState('');
  const [jeton, setJeton] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  // Recherches du mois : undefined = pas de jeton (ligne masquée), null = le relais n'a pas répondu.
  const [quota, setQuota] = useState<Quota | null | undefined>(undefined);
  // QR de ce téléphone : affiché seulement à la demande (il contient le jeton).
  const [qr, setQr] = useState<string | null>(null);
  const [saisieAdmin, setSaisieAdmin] = useState('');
  const [jetonAdmin, setJetonAdmin] = useState('');
  const [messageAdmin, setMessageAdmin] = useState<string | null>(null);

  const actualiserQuota = async (j: string) => setQuota(j ? await lireQuotaRelais(j) : undefined);

  // Relu à chaque retour sur l'écran : une configuration par QR a pu tout changer.
  useFocusEffect(
    useCallback(() => {
      Promise.all([lireAdresse(), lireJeton(), lireJetonAdmin()]).then(([a, j, admin]) => {
        setAdresse(a);
        setJeton(j);
        setSaisieAdmin(admin);
        setJetonAdmin(admin);
        actualiserQuota(j);
      });
    }, []),
  );

  const changerAdresse = (valeur: string) => {
    setAdresse(valeur);
    setMessage(null);
    setQr(null);
  };

  const changer = (valeur: string) => {
    setJeton(valeur);
    setMessage(null);
    setQr(null);
  };

  /** Adresse saisie, vérifiée ; une saisie vide revient à l'adresse par défaut. null si elle ne convient pas. */
  const adresseSaisie = (): string | null => {
    if (adresse.trim() === '') return settings.relayUrl;
    const lue = lireAdresseRelais(adresse);
    return lue.ok ? lue.adresse : null;
  };

  const enregistrer = async () => {
    const a = adresseSaisie();
    if (!a) {
      setMessage(r.adresseRefusee);
      return;
    }
    const propre = nettoyerJeton(jeton);
    await enregistrerAdresse(a);
    await enregistrerJeton(propre);
    setAdresse(a);
    setJeton(propre);
    setMessage(propre ? r.enregistre : r.connexion.jeton_absent);
    actualiserQuota(propre);
  };

  const tester = async () => {
    const a = adresseSaisie();
    if (!a) {
      setMessage(r.adresseRefusee);
      return;
    }
    setEnCours(true);
    setMessage(null);
    const etat = await testerConnexion(nettoyerJeton(jeton), a);
    setEnCours(false);
    setMessage(r.connexion[etat]);
  };

  const basculerQr = () => {
    if (qr) {
      setQr(null);
      return;
    }
    const a = adresseSaisie();
    const propre = nettoyerJeton(jeton);
    if (!a) setMessage(r.adresseRefusee);
    else if (!propre) setMessage(r.connexion.jeton_absent);
    else {
      setMessage(null);
      setQr(lienConfiguration({ relais: a, jeton: propre }));
    }
  };

  const enregistrerAdmin = async () => {
    const propre = nettoyerJeton(saisieAdmin);
    await enregistrerJetonAdmin(propre);
    setSaisieAdmin(propre);
    setJetonAdmin(propre);
    setMessageAdmin(propre ? r.jetonAdminEnregistre : r.jetonAdminEfface);
  };

  const niveau = quota ? niveauQuota(quota) : 'normal';
  const tailleQr = Math.min(ecran.width - spacing.screen * 2, 320);

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={() => router.back()} />} />
      <KeyboardAvoidingView behavior="padding" style={styles.ecran}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[type.screenTitle, styles.titre]}>{r.titre}</Text>

          <Etiquette style={styles.section}>{r.sectionRelais}</Etiquette>
          <Champ libelle={r.adresse}>
            <Saisie
              value={adresse}
              onChangeText={changerAdresse}
              placeholder={settings.relayUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Champ>
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
            <Bouton libelle={r.scanner} variante="secondaire" onPress={() => router.push('/scanner')} desactive={enCours} />
            <Bouton libelle={qr ? r.masquerQr : r.afficherQr} variante="secondaire" onPress={basculerQr} desactive={enCours} />
          </View>

          {enCours ? <Text style={styles.chargement}>{r.testEnCours}</Text> : null}
          {message ? <RichText style={styles.message}>{message}</RichText> : null}

          {qr ? (
            <View style={styles.qr}>
              <CodeQR valeur={qr} taille={tailleQr} libelle={texts.accessibilite.qrConfiguration} />
              <Text style={[type.body, styles.miseEnGarde]}>{r.qrMiseEnGarde}</Text>
            </View>
          ) : null}

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
                {niveau !== 'normal' ? <RichText style={styles.miseEnGardeQuota}>{r.quota[niveau]}</RichText> : null}
              </View>
            ) : null}
            <View style={[styles.ligne, styles.ligneHaut]}>
              <Etiquette>{r.version}</Etiquette>
              <Text style={[type.body, styles.valeur]}>{Constants.expoConfig?.version ?? ''}</Text>
            </View>
          </View>

          <Etiquette style={styles.section}>{r.sectionRecherches}</Etiquette>
          <SectionRecherches />

          <Etiquette style={styles.section}>{r.sectionSauvegarde}</Etiquette>
          <SectionSauvegarde />

          <Etiquette style={styles.section}>{r.sectionConfidentialite}</Etiquette>
          <View style={styles.boutons}>
            <Bouton libelle={r.confidentialite} variante="secondaire" onPress={() => router.push('/confidentialite')} />
          </View>

          <Etiquette style={styles.section}>{r.sectionInstallations}</Etiquette>
          <Champ libelle={r.jetonAdmin}>
            <Saisie
              value={saisieAdmin}
              onChangeText={(v) => {
                setSaisieAdmin(v);
                setMessageAdmin(null);
              }}
              placeholder={r.jetonAdminExemple}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Champ>
          <View style={styles.boutons}>
            <Bouton libelle={r.enregistrer} variante="secondaire" onPress={enregistrerAdmin} />
          </View>
          {messageAdmin ? <RichText style={styles.message}>{messageAdmin}</RichText> : null}
          {jetonAdmin ? (
            <View style={styles.installations}>
              <SectionInstallations jetonAdmin={jetonAdmin} tailleQr={tailleQr} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 6 },
  section: { marginTop: 32, marginBottom: 8, paddingTop: 16, borderTopWidth: spacing.hairline, borderTopColor: colors.ink },
  boutons: { gap: 12, marginTop: 28 },
  chargement: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  message: { ...type.body, color: colors.ink, marginTop: 20 },
  qr: { marginTop: 24, gap: 16 },
  miseEnGarde: { color: colors.inkMuted },
  lignes: { marginTop: 48 },
  ligne: { paddingVertical: 16, borderTopWidth: spacing.hairline, borderTopColor: colors.ink },
  ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valeur: { color: colors.ink },
  manquant: { color: colors.inkMuted },
  miseEnGardeQuota: { ...type.body, color: colors.ink, marginTop: 8 },
  installations: { marginTop: 20 },
});
