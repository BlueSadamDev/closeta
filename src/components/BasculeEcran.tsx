import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

import { MotFiltre } from './MotFiltre';

/**
 * « WISHLIST · VESTIAIRE » sous l'en-tête (DESIGN.md, « Bascule Wishlist / Vestiaire »).
 * Le Vestiaire s'ouvre par-dessus la Wishlist : le retour Android y ramène.
 */
export function BasculeEcran({ actif }: { actif: 'wishlist' | 'vestiaire' }) {
  const allerA = (ecran: 'wishlist' | 'vestiaire') => {
    if (ecran === actif) return;
    if (ecran === 'vestiaire') router.push('/vestiaire');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View style={styles.ligne}>
      <MotFiltre libelle={texts.ecrans.wishlist} actif={actif === 'wishlist'} onPress={() => allerA('wishlist')} />
      <Text style={[type.label, styles.point]}>·</Text>
      <MotFiltre libelle={texts.ecrans.vestiaire} actif={actif === 'vestiaire'} onPress={() => allerA('vestiaire')} />
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', columnGap: 10, paddingHorizontal: spacing.screen },
  point: { color: colors.inkMuted, paddingBottom: 4 },
});
