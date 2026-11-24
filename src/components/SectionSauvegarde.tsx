import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/Bouton';
import { RichText } from '@/components/RichText';
import { choisirSauvegarde, remplacerParSauvegarde, sauvegarder } from '@/db/fichier';
import { texts } from '@/domain/texts';
import { colors, fonts, type } from '@/theme';

const t = texts.reglages.sauvegarde;

type EnCours = 'preparation' | 'lecture' | 'remplacement' | null;

/**
 * Réglages, section « Sauvegarde » (docs/SPEC.md, « Lot 3 », « Étape 11 ») :
 * « Sauvegarder » propose le fichier au partage Android ; « Restaurer » lit un fichier, en donne le résumé
 * et, après confirmation, remplace toutes les données du téléphone.
 */
export function SectionSauvegarde() {
  const db = useSQLiteContext();
  const [enCours, setEnCours] = useState<EnCours>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lancerSauvegarde = async () => {
    setMessage(null);
    setEnCours('preparation');
    const resultat = await sauvegarder(db);
    setEnCours(null);
    if (resultat !== 'partagee') setMessage(t[resultat]);
  };

  const lancerRestauration = async () => {
    setMessage(null);
    setEnCours('lecture');
    const lecture = await choisirSauvegarde();
    setEnCours(null);
    if (!lecture) return;
    if (!lecture.ok) {
      setMessage(t[lecture.raison]);
      return;
    }
    const c = texts.confirmations;
    Alert.alert(c.restauration.titre, c.restauration.message(lecture.resume.pieces, lecture.resume.photos), [
      { text: c.annuler, style: 'cancel' },
      {
        text: c.restauration.confirmer,
        style: 'destructive',
        onPress: async () => {
          setEnCours('remplacement');
          const fait = await remplacerParSauvegarde(db, lecture.sauvegarde);
          setEnCours(null);
          setMessage(fait ? t.restauree : t.nonRestauree);
        },
      },
    ]);
  };

  return (
    <View>
      <Text style={[type.body, styles.explication]}>{t.explication}</Text>
      <View style={styles.boutons}>
        <Bouton libelle={t.sauvegarder} variante="secondaire" onPress={lancerSauvegarde} desactive={enCours !== null} />
        <Bouton libelle={t.restaurer} variante="secondaire" onPress={lancerRestauration} desactive={enCours !== null} />
      </View>
      {enCours ? <Text style={styles.chargement}>{t[enCours]}</Text> : null}
      {message ? <RichText style={styles.message}>{message}</RichText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  explication: { color: colors.inkMuted },
  boutons: { gap: 12, marginTop: 20 },
  chargement: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  message: { ...type.body, color: colors.ink, marginTop: 20 },
});
