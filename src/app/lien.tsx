import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Champ, Saisie } from '@/components/Champ';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { RichText } from '@/components/RichText';
import { nomDuSite, trouverLien } from '@/domain/lien';
import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

const t = texts.lien;

/** Écran « Coller un lien » (docs/SPEC.md, « Parcours par lien », point 1). */
export default function CollerUnLien() {
  const { partage } = useLocalSearchParams<{ partage?: string }>();
  const [saisie, setSaisie] = useState('');
  const [copie, setCopie] = useState<string | null>(null);
  const [invalide, setInvalide] = useState(false);

  // Si le presse-papiers contient déjà un lien, l'app le propose.
  useEffect(() => {
    Clipboard.getStringAsync()
      .then((texte) => setCopie(trouverLien(texte)))
      .catch(() => setCopie(null));
  }, []);

  const changer = (valeur: string) => {
    setSaisie(valeur);
    setInvalide(false);
  };

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const lire = (texte: string) => {
    const lien = trouverLien(texte);
    if (!lien) {
      setInvalide(true);
      return;
    }
    router.replace({ pathname: '/formulaire', params: { lien } });
  };

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="fermer" libelle={texts.formulaire.annuler} onPress={fermer} />} />
      <KeyboardAvoidingView behavior="padding" style={styles.ecran}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[type.screenTitle, styles.titre]}>{t.titre}</Text>

          {partage === 'sans-lien' ? <RichText style={styles.message}>{t.partageSansLien}</RichText> : null}

          {copie && copie !== saisie.trim() ? (
            <View style={styles.copie}>
              <Etiquette>{t.copie}</Etiquette>
              <Text style={[type.body, styles.site]} numberOfLines={1}>
                {nomDuSite(copie)}
              </Text>
              <Bouton libelle={t.utiliser} variante="secondaire" onPress={() => lire(copie)} />
            </View>
          ) : null}

          <Champ libelle={t.champ} erreur={invalide ? t.lienInvalide : undefined}>
            <Saisie
              value={saisie}
              onChangeText={changer}
              placeholder={t.exemple}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              enErreur={invalide}
              onSubmitEditing={() => lire(saisie)}
              returnKeyType="go"
            />
          </Champ>

          <View style={styles.actions}>
            <Bouton libelle={t.lire} onPress={() => lire(saisie)} />
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
  message: { ...type.body, color: colors.ink, marginTop: 12 },
  copie: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.ink,
    gap: 8,
  },
  site: { color: colors.ink, marginBottom: 4 },
  actions: { marginTop: 36 },
});
