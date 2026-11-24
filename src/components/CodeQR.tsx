import genererQr from 'qrcode-generator';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  /** Texte du code (un lien closeta://config…). */
  valeur: string;
  /** Côté du code, en px. */
  taille: number;
  libelle: string;
};

/** Marge blanche autour du code, en modules : 4 selon la norme des QR, nécessaire pour la lecture. */
const MARGE = 4;

/**
 * QR code dessiné au trait plein `ink` sur fond `paper` (aucun arrondi).
 * Niveau de correction « M » : assez robuste pour un écran lu par un autre téléphone.
 */
export function CodeQR({ valeur, taille, libelle }: Props) {
  const { chemin, cote } = useMemo(() => {
    const qr = genererQr(0, 'M');
    qr.addData(valeur, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let ligne = 0; ligne < n; ligne++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(ligne, col)) d += `M${col + MARGE} ${ligne + MARGE}h1v1h-1z`;
      }
    }
    return { chemin: d, cote: n + MARGE * 2 };
  }, [valeur]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={libelle} style={[styles.fond, { width: taille, height: taille }]}>
      <Svg width={taille} height={taille} viewBox={`0 0 ${cote} ${cote}`}>
        <Path d={chemin} fill={colors.ink} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { backgroundColor: colors.paper, alignSelf: 'center' },
});
