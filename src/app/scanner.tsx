import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoutonIcone } from '@/components/BoutonIcone';
import { RichText } from '@/components/RichText';
import { lireLienConfiguration } from '@/domain/configuration';
import { lireLienInvitation } from '@/domain/invitation';
import { settings } from '@/domain/settings';
import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

const t = texts.scanner;

/**
 * Lecteur de QR de configuration (Réglages, docs/SPEC.md, « Lot 3 », « Étape 10 »).
 * Un QR valide ouvre la confirmation ; un QR étranger est signalé et le lecteur continue.
 */
export default function Scanner() {
  const ecran = useWindowDimensions();
  const [permission, demanderPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  // Un même code est lu plusieurs fois par seconde : on l'ignore pendant la pause, puis à nouveau s'il est refusé.
  const pause = useRef(false);
  const fini = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) demanderPermission();
  }, [permission, demanderPermission]);

  const refusee = permission !== null && !permission.granted && !permission.canAskAgain;
  const cote = ecran.width - spacing.screen * 2;

  const lu = ({ data }: BarcodeScanningResult) => {
    if (pause.current || fini.current) return;
    const config = lireLienConfiguration(data);
    if (config.ok) {
      fini.current = true;
      router.replace({ pathname: '/config', params: { relais: config.relais, jeton: config.jeton } });
      return;
    }
    // QR d'invitation (sans jeton) : même parcours que le lien closeta://invitation.
    const invitation = lireLienInvitation(data);
    if (invitation.ok) {
      fini.current = true;
      router.replace({ pathname: '/invitation', params: { relais: invitation.relais, code: invitation.code } });
      return;
    }
    setMessage(t[invitation.raison === 'etranger' ? config.raison : invitation.raison]);
    pause.current = true;
    setTimeout(() => {
      pause.current = false;
    }, settings.scanPauseMs);
  };

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <View style={styles.entete}>
        <BoutonIcone nom="fermer" libelle={texts.accessibilite.fermerScanner} onPress={() => router.back()} />
      </View>
      <View style={[styles.apercu, { width: cote, height: cote }]}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={lu}
          />
        ) : null}
        <View style={styles.cadre} pointerEvents="none" />
      </View>
      <RichText style={styles.consigne}>{refusee ? t.cameraRefusee : (message ?? t.consigne)}</RichText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.screen },
  entete: { height: 44, flexDirection: 'row', alignItems: 'center', marginLeft: -10 },
  apercu: { alignSelf: 'center', backgroundColor: colors.ink, overflow: 'hidden', marginTop: 24 },
  cadre: { position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', borderWidth: 1, borderColor: colors.paper },
  consigne: { ...type.body, color: colors.ink, marginTop: 16, minHeight: 44 },
});
