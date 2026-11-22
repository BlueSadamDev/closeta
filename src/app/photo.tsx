import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { CarteProposition } from '@/components/CarteProposition';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { PhotoArticle } from '@/components/PhotoArticle';
import { RichText } from '@/components/RichText';
import { DESCRIPTION_VIDE, seulementDesAlternatives, type DescriptionPhoto, type Proposition } from '@/domain/photo';
import { texts } from '@/domain/texts';
import { prendrePhoto, type SourcePhoto } from '@/photo/prise';
import { identifier } from '@/relay/client';
import { lireJeton } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const t = texts.photo;

type Etat =
  | { etape: 'choix'; message: string | null }
  | { etape: 'recherche'; photo: string }
  | { etape: 'resultats'; photo: string; description: DescriptionPhoto; propositions: Proposition[] }
  | { etape: 'echec'; photo: string; message: string };

/** Écran « Par photo » (docs/SPEC.md, « Parcours par photo »). */
export default function ParPhoto() {
  const [etat, setEtat] = useState<Etat>({ etape: 'choix', message: null });
  // Évite d'afficher le résultat d'une recherche abandonnée (« Une autre photo » pendant l'attente).
  const recherche = useRef(0);

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const choisir = async (source: SourcePhoto) => {
    const prise = await prendrePhoto(source);
    if (!prise.ok) {
      if (prise.raison !== 'annule') {
        setEtat({ etape: 'choix', message: prise.raison === 'camera_refusee' ? t.cameraRefusee : t.photoIllisible });
      }
      return;
    }
    const numero = ++recherche.current;
    setEtat({ etape: 'recherche', photo: prise.uri });
    const resultat = await identifier(prise.uri, await lireJeton());
    if (numero !== recherche.current) return;
    setEtat(
      resultat.ok
        ? { etape: 'resultats', photo: prise.uri, description: resultat.description, propositions: resultat.propositions }
        : { etape: 'echec', photo: prise.uri, message: t.echecs[resultat.raison] },
    );
  };

  const autrePhoto = () => {
    recherche.current++;
    setEtat({ etape: 'choix', message: null });
  };

  // Un échec ne bloque jamais l'ajout : le formulaire s'ouvre avec la photo et ce que l'IA a vu.
  const ouvrirFormulaire = (photo: string, description: DescriptionPhoto, proposition?: Proposition) =>
    router.replace({
      pathname: '/formulaire',
      params: {
        photo,
        description: JSON.stringify(description),
        ...(proposition ? { proposition: JSON.stringify(proposition) } : {}),
      },
    });

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="fermer" libelle={texts.formulaire.annuler} onPress={fermer} />} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={[type.screenTitle, styles.titre]}>{t.titre}</Text>

        {etat.etape === 'choix' ? (
          <>
            <RichText style={styles.texte}>{etat.message ?? t.conseil}</RichText>
            <View style={styles.actions}>
              <Bouton libelle={t.prendre} onPress={() => choisir('camera')} />
              <Bouton libelle={t.choisir} variante="secondaire" onPress={() => choisir('galerie')} />
            </View>
          </>
        ) : null}

        {etat.etape === 'recherche' ? (
          <>
            <Apercu photo={etat.photo} />
            <Text style={styles.attente}>{t.recherche}</Text>
            <View style={styles.actions}>
              <Bouton libelle={t.autrePhoto} variante="secondaire" onPress={autrePhoto} />
            </View>
          </>
        ) : null}

        {etat.etape === 'resultats' ? (
          <>
            <Apercu photo={etat.photo} />
            {etat.propositions.length === 0 ? (
              <RichText style={styles.texte}>{t.aucun}</RichText>
            ) : (
              <>
                <RichText style={styles.texte}>
                  {seulementDesAlternatives(etat.propositions) ? t.seulementAlternatives : t.resultats}
                </RichText>
                <Etiquette style={styles.compte}>{t.propositions(etat.propositions.length)}</Etiquette>
                <View style={styles.liste}>
                  {etat.propositions.map((p) => (
                    <CarteProposition
                      key={p.url}
                      proposition={p}
                      onPress={() => ouvrirFormulaire(etat.photo, etat.description, p)}
                    />
                  ))}
                </View>
              </>
            )}
            <View style={styles.actions}>
              <Bouton libelle={t.autrePhoto} variante="secondaire" onPress={autrePhoto} />
              <Bouton libelle={t.saisir} variante="secondaire" onPress={() => ouvrirFormulaire(etat.photo, etat.description)} />
            </View>
          </>
        ) : null}

        {etat.etape === 'echec' ? (
          <>
            <Apercu photo={etat.photo} />
            <RichText style={styles.texte}>{etat.message}</RichText>
            <View style={styles.actions}>
              <Bouton libelle={t.saisir} onPress={() => ouvrirFormulaire(etat.photo, DESCRIPTION_VIDE)} />
              <Bouton libelle={t.autrePhoto} variante="secondaire" onPress={autrePhoto} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Apercu({ photo }: { photo: string }) {
  return (
    <PhotoArticle
      article={{ id: photo, nom: ' ', imageLocale: photo, imageSource: null }}
      hauteur={spacing.gridPhotoHeight}
      style={styles.apercu}
    />
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 6 },
  texte: { ...type.body, color: colors.ink, marginTop: 16 },
  attente: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  apercu: { marginTop: 12 },
  compte: { marginTop: 20, marginBottom: 4 },
  liste: { borderBottomWidth: spacing.hairline, borderBottomColor: colors.photo1 },
  actions: { marginTop: 32, gap: 12 },
});
