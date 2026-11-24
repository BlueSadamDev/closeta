import { Image, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { settings } from '@/domain/settings';
import { texts } from '@/domain/texts';
import { bornerDeplacement, bornerZoom } from '@/domain/zoom';
import { colors, spacing } from '@/theme';

import { BoutonIcone } from './BoutonIcone';

const { zoomMax, zoomDouble } = settings.photoPleinEcran;

/**
 * Photo d'une fiche agrandie en plein écran, sur fond papier (docs/SPEC.md, « Étape 12 »).
 * Pincer pour zoomer, glisser pour se déplacer, double toucher pour zoomer ou revenir ;
 * un toucher, la croix ou le retour Android referment.
 */
export function PhotoPleinEcran({ uri, visible, onFermer }: { uri: string; visible: boolean; onFermer: () => void }) {
  return (
    <Modal visible={visible} onRequestClose={onFermer} animationType="fade" statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.ecran}>
        <PhotoZoomable uri={uri} onFermer={onFermer} />
        <SafeAreaView style={styles.haut} edges={['top']} pointerEvents="box-none">
          <BoutonIcone nom="fermer" libelle={texts.accessibilite.fermerPhoto} onPress={onFermer} />
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function PhotoZoomable({ uri, onFermer }: { uri: string; onFermer: () => void }) {
  const { width, height } = useWindowDimensions();
  const zoom = useSharedValue(1);
  const zoomDepart = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xDepart = useSharedValue(0);
  const yDepart = useSharedValue(0);

  const pincement = usePinchGesture({
    onActivate: () => {
      zoomDepart.value = zoom.value;
    },
    onUpdate: (e) => {
      zoom.value = bornerZoom(zoomDepart.value * e.scale, zoomMax);
      x.value = bornerDeplacement(x.value, zoom.value, width);
      y.value = bornerDeplacement(y.value, zoom.value, height);
    },
  });

  const glissement = usePanGesture({
    onActivate: () => {
      xDepart.value = x.value;
      yDepart.value = y.value;
    },
    onUpdate: (e) => {
      x.value = bornerDeplacement(xDepart.value + e.translationX, zoom.value, width);
      y.value = bornerDeplacement(yDepart.value + e.translationY, zoom.value, height);
    },
  });

  const doubleToucher = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (e) => {
      if (e.canceled) return;
      const cible = zoom.value > 1 ? 1 : zoomDouble;
      zoom.value = withTiming(cible);
      if (cible === 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
      }
    },
  });

  const toucher = useTapGesture({
    runOnJS: true,
    onDeactivate: (e) => {
      if (!e.canceled) onFermer();
    },
  });

  const gestes = useSimultaneousGestures(pincement, glissement, useExclusiveGestures(doubleToucher, toucher));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: zoom.value }],
  }));

  return (
    <GestureDetector gesture={gestes}>
      <View style={styles.ecran} accessibilityLabel={texts.accessibilite.photoAgrandie}>
        <Animated.View style={[{ width, height }, style]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  haut: { position: 'absolute', top: 0, right: 0, paddingHorizontal: spacing.screen / 3 },
});
