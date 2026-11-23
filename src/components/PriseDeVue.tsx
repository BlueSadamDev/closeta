import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { settings } from '@/domain/settings';
import { texts } from '@/domain/texts';
import { choisirPourVestiaire, recadrerPourVestiaire } from '@/photo/vestiaire';
import { colors, fonts, spacing, type } from '@/theme';

import { Bouton } from './Bouton';
import { BoutonIcone } from './BoutonIcone';
import { RichText } from './RichText';

const t = texts.photo.guidee;
/** Hauteur réservée sous l'aperçu (consigne et deux boutons) et au-dessus (en-tête). */
const RESERVE = 44 + 72 + spacing.buttonHeight * 2 + 12 + 48;

type Props = {
  visible: boolean;
  /** Photo prête : 3:4, 1200 × 1600 px, JPEG. */
  onPhoto: (uri: string) => void;
  onFermer: () => void;
};

/**
 * Prise de vue guidée du Vestiaire (docs/SPEC.md, « Lot 3 », « Étape 7 ») : aperçu 3:4, cadre 3:4
 * (l'extérieur voilé), silhouette de cintre en haut au centre, consigne. La photo est recadrée sur le cadre.
 */
export function PriseDeVue({ visible, onPhoto, onFermer }: Props) {
  // Le contenu n'existe que pendant l'affichage : tout repart de zéro à chaque ouverture.
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onFermer}>
      {visible ? <Contenu onPhoto={onPhoto} onFermer={onFermer} /> : null}
    </Modal>
  );
}

function Contenu({ onPhoto, onFermer }: Omit<Props, 'visible'>) {
  const insets = useSafeAreaInsets();
  const ecran = useWindowDimensions();
  const [permission, demanderPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [prete, setPrete] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Permission CAMERA demandée à la première ouverture (déjà déclarée pour le parcours photo).
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) demanderPermission();
  }, [permission, demanderPermission]);

  // L'aperçu est en 3:4 (capteur 4:3 tenu en portrait) : la photo correspond exactement à ce qu'on voit.
  const disponible = ecran.height - insets.top - insets.bottom - RESERVE;
  const largeur = Math.min(ecran.width - spacing.screen * 2, (disponible * 3) / 4);
  const hauteur = (largeur * 4) / 3;
  const margeX = largeur * settings.cadreMarge;
  const margeY = hauteur * settings.cadreMarge;

  const refusee = permission !== null && !permission.granted && !permission.canAskAgain;

  const prendre = async () => {
    if (!camera.current || enCours) return;
    setEnCours(true);
    setMessage(null);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1, exif: false });
      const r = await recadrerPourVestiaire(photo.uri, photo.width, photo.height, settings.cadreMarge);
      if (r.ok) onPhoto(r.uri);
      else setMessage(texts.photo.photoIllisible);
    } catch {
      setMessage(texts.photo.photoIllisible);
    }
    setEnCours(false);
  };

  const galerie = async () => {
    if (enCours) return;
    setEnCours(true);
    setMessage(null);
    const r = await choisirPourVestiaire();
    setEnCours(false);
    if (r.ok) onPhoto(r.uri);
    else if (r.raison !== 'annule') setMessage(texts.photo.photoIllisible);
  };

  return (
    <View style={[styles.ecran, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.entete}>
        <BoutonIcone nom="fermer" libelle={texts.accessibilite.fermerPriseDeVue} onPress={onFermer} />
      </View>

      <View style={[styles.apercu, { width: largeur, height: hauteur }]}>
        {permission?.granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            ratio="4:3"
            animateShutter
            onCameraReady={() => setPrete(true)}
          />
        ) : null}
        {/* Voile autour du cadre 3:4. */}
        <View style={[styles.voile, { top: 0, left: 0, right: 0, height: margeY }]} />
        <View style={[styles.voile, { bottom: 0, left: 0, right: 0, height: margeY }]} />
        <View style={[styles.voile, { top: margeY, bottom: margeY, left: 0, width: margeX }]} />
        <View style={[styles.voile, { top: margeY, bottom: margeY, right: 0, width: margeX }]} />
        <View style={[styles.cadre, { top: margeY, bottom: margeY, left: margeX, right: margeX }]}>
          <View style={styles.cintre}>
            <Svg width={largeur * 0.42} height={largeur * 0.42 * (64 / 120)} viewBox="0 0 120 64">
              <Path
                d="M60 24 C60 17 67 15 67 8 C67 3 63 1 59 1 C55 1 52 4 52 8 M60 24 L7 56 Q2 60 8 62 L112 62 Q118 60 113 56 Z"
                fill="none"
                stroke={colors.paper}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          </View>
        </View>
        {enCours ? (
          <View style={styles.attente}>
            <Text style={styles.attenteTexte}>{t.preparation}</Text>
          </View>
        ) : null}
      </View>

      <RichText style={styles.consigne}>{message ?? (refusee ? texts.photo.cameraRefusee : t.consigne)}</RichText>

      <View style={styles.actions}>
        <Bouton libelle={t.prendre} onPress={prendre} desactive={!prete || enCours || !permission?.granted} />
        <Bouton libelle={t.galerie} variante="secondaire" onPress={galerie} desactive={enCours} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.screen },
  entete: { height: 44, flexDirection: 'row', alignItems: 'center', marginLeft: -10 },
  apercu: { alignSelf: 'center', backgroundColor: colors.ink, overflow: 'hidden' },
  voile: { position: 'absolute', backgroundColor: 'rgba(21, 19, 15, 0.45)' },
  cadre: { position: 'absolute', borderWidth: spacing.hairline, borderColor: colors.paper, alignItems: 'center' },
  cintre: { marginTop: 10, opacity: 0.85 },
  attente: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(21, 19, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attenteTexte: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.paper },
  consigne: { ...type.body, color: colors.ink, marginTop: 16, minHeight: 44 },
  actions: { marginTop: 12, gap: 12 },
});
