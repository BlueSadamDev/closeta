import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { CarteProposition } from '@/components/CarteProposition';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { PhotoArticle } from '@/components/PhotoArticle';
import { PriseDeVue } from '@/components/PriseDeVue';
import { RichText } from '@/components/RichText';
import { DESCRIPTION_VIDE, seulementDesAlternatives, type DescriptionPhoto, type Proposition } from '@/domain/photo';
import { texts } from '@/domain/texts';
import { prendrePhoto, type SourcePhoto } from '@/photo/prise';
import { habiller } from '@/photo/habillage';
import { choisirPourVestiaire, copiePourRelais } from '@/photo/vestiaire';
import { identifier } from '@/relay/client';
import { lireJeton } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const t = texts.photo;

type Etat =
  | { etape: 'choix'; message: string | null }
  /** Vestiaire : habillage en cours (pièce détourée sur fond uni). */
  | { etape: 'preparation'; photo: string }
  /** Vestiaire : photo 3:4 prête (et habillée si possible), identification proposée, facultative. */
  | { etape: 'prete'; photo: string }
  | { etape: 'recherche'; photo: string }
  | { etape: 'resultats'; photo: string; description: DescriptionPhoto; propositions: Proposition[] }
  | { etape: 'echec'; photo: string; message: string };

/** Écran « Par photo » (docs/SPEC.md, « Parcours par photo »). */
export default function ParPhoto() {
  // destination : « vestiaire » pour un ajout direct au Vestiaire, transmise au formulaire.
  const { destination } = useLocalSearchParams<{ destination?: string }>();
  const pourVestiaire = destination === 'vestiaire';
  const [etat, setEtat] = useState<Etat>({ etape: 'choix', message: null });
  // Vestiaire : la prise de vue guidée s'ouvre d'emblée (docs/SPEC.md, « Lot 3 », « Étape 7 »).
  const [guidee, setGuidee] = useState(pourVestiaire);
  // Vestiaire : version habillée de la photo, transmise au formulaire (l'identification utilise l'origine).
  const [habillee, setHabillee] = useState<string | null>(null);
  const [messageHabillage, setMessageHabillage] = useState<string | null>(null);

  const photoPrete = (origine: string, version: string | null) => {
    recherche.current++;
    setHabillee(version);
    setMessageHabillage(version ? null : t.guidee.sansHabillage);
    setEtat({ etape: 'prete', photo: origine });
  };
  // Évite d'afficher le résultat d'une recherche abandonnée (« Une autre photo » pendant l'attente).
  const recherche = useRef(0);

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const choisir = async (source: SourcePhoto) => {
    // Vestiaire : prise de vue guidée, ou galerie recadrée en 3:4 ; l'identification est ensuite proposée.
    if (pourVestiaire) {
      if (source === 'camera') {
        setGuidee(true);
        return;
      }
      const prise = await choisirPourVestiaire();
      if (prise.ok) {
        setEtat({ etape: 'preparation', photo: prise.uri });
        photoPrete(prise.uri, await habiller(prise.uri));
      } else if (prise.raison !== 'annule') setEtat({ etape: 'choix', message: t.photoIllisible });
      return;
    }
    const prise = await prendrePhoto(source);
    if (!prise.ok) {
      if (prise.raison !== 'annule') {
        setEtat({ etape: 'choix', message: prise.raison === 'camera_refusee' ? t.cameraRefusee : t.photoIllisible });
      }
      return;
    }
    chercher(prise.uri);
  };

  // Le relais reçoit une copie réduite pour le Vestiaire (1024 px au plus) ; la photo 1200 × 1600 est gardée.
  const chercher = async (photo: string) => {
    const numero = ++recherche.current;
    setEtat({ etape: 'recherche', photo });
    const envoi = pourVestiaire ? await copiePourRelais(photo) : photo;
    const resultat = await identifier(envoi, await lireJeton());
    if (numero !== recherche.current) return;
    setEtat(
      resultat.ok
        ? { etape: 'resultats', photo, description: resultat.description, propositions: resultat.propositions }
        : { etape: 'echec', photo, message: t.echecs[resultat.raison] },
    );
  };

  const autrePhoto = () => {
    recherche.current++;
    setEtat({ etape: 'choix', message: null });
    if (pourVestiaire) setGuidee(true);
  };

  // Un échec ne bloque jamais l'ajout : le formulaire s'ouvre avec la photo et ce que l'IA a vu.
  const ouvrirFormulaire = (photo: string, description: DescriptionPhoto, proposition?: Proposition) =>
    router.replace({
      pathname: '/formulaire',
      params: {
        photo,
        description: JSON.stringify(description),
        ...(proposition ? { proposition: JSON.stringify(proposition) } : {}),
        ...(destination ? { destination } : {}),
        ...(pourVestiaire && habillee ? { habillee } : {}),
      },
    });

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="fermer" libelle={texts.formulaire.annuler} onPress={fermer} />} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={[type.screenTitle, styles.titre]}>{t.titre}</Text>

        {etat.etape === 'choix' ? (
          <>
            <RichText style={styles.texte}>{etat.message ?? (pourVestiaire ? t.guidee.consigne : t.conseil)}</RichText>
            <Text style={styles.rappel}>{t.rappel}</Text>
            <View style={styles.actions}>
              <Bouton libelle={t.prendre} onPress={() => choisir('camera')} />
              <Bouton libelle={t.choisir} variante="secondaire" onPress={() => choisir('galerie')} />
            </View>
          </>
        ) : null}

        {etat.etape === 'preparation' ? (
          <>
            <Apercu photo={etat.photo} />
            <Text style={styles.attente}>{t.guidee.preparation}</Text>
          </>
        ) : null}

        {etat.etape === 'prete' ? (
          <>
            <Apercu photo={habillee ?? etat.photo} />
            <RichText style={styles.texte}>{messageHabillage ?? t.guidee.prete}</RichText>
            <View style={styles.actions}>
              <Bouton libelle={t.guidee.identifier} onPress={() => chercher(etat.photo)} />
              <Bouton
                libelle={t.guidee.continuer}
                variante="secondaire"
                onPress={() => ouvrirFormulaire(etat.photo, DESCRIPTION_VIDE)}
              />
              <Bouton libelle={t.autrePhoto} variante="secondaire" onPress={autrePhoto} />
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

      {pourVestiaire ? (
        <PriseDeVue
          visible={guidee}
          onFermer={() => setGuidee(false)}
          onPhoto={(origine, version) => {
            setGuidee(false);
            photoPrete(origine, version);
          }}
        />
      ) : null}
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
  rappel: { ...type.body, color: colors.inkMuted, marginTop: 8 },
  attente: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  apercu: { marginTop: 12 },
  compte: { marginTop: 20, marginBottom: 4 },
  liste: { borderBottomWidth: spacing.hairline, borderBottomColor: colors.photo1 },
  actions: { marginTop: 32, gap: 12 },
});
