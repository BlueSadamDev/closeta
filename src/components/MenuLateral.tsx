import { router, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

import { BoutonIcone } from './BoutonIcone';
import { Wordmark } from './Wordmark';

const DUREE_MS = 220;

const MenuContexte = createContext<() => void>(() => {});

/** Ouvre le menu depuis l'icône en haut à gauche d'un onglet. */
export const useOuvrirMenu = () => useContext(MenuContexte);

/**
 * Menu qui glisse depuis la gauche : Wishlist, Vestiaire, Réglages (DESIGN.md, « Menu »).
 * Il entoure les onglets ; chaque onglet l'ouvre avec `useOuvrirMenu()`.
 */
export function MenuLateral({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { width } = useWindowDimensions();
  const largeur = Math.min(320, Math.round(width * 0.8));
  const [position] = useState(() => new Animated.Value(0)); // 0 = caché, 1 = ouvert
  const { top, bottom } = useSafeAreaInsets();
  const chemin = usePathname();

  useEffect(() => {
    if (visible) Animated.timing(position, { toValue: 1, duration: DUREE_MS, useNativeDriver: true }).start();
  }, [visible, position]);

  const ouvrir = useCallback(() => {
    position.setValue(0);
    setVisible(true);
  }, [position]);

  const fermer = useCallback(
    (ensuite?: () => void) => {
      Animated.timing(position, { toValue: 0, duration: DUREE_MS, useNativeDriver: true }).start(() => {
        setVisible(false);
        ensuite?.();
      });
    },
    [position],
  );

  const lignes = useMemo(
    () => [
      { libelle: texts.ecrans.wishlist, actif: chemin === '/', aller: () => router.navigate('/') },
      { libelle: texts.ecrans.vestiaire, actif: chemin === '/vestiaire', aller: () => router.navigate('/vestiaire') },
      { libelle: texts.ecrans.reglages, actif: false, aller: () => router.push('/reglages') },
    ],
    [chemin],
  );

  const decalage = position.interpolate({ inputRange: [0, 1], outputRange: [-largeur, 0] });

  return (
    <MenuContexte.Provider value={ouvrir}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => fermer()}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.voile, { opacity: position }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => fermer()} accessible={false} />
        </Animated.View>
        <Animated.View
          style={[
            styles.panneau,
            { width: largeur, paddingTop: top, paddingBottom: bottom + 16, transform: [{ translateX: decalage }] },
          ]}
        >
          <View style={styles.entete}>
            <BoutonIcone nom="fermer" libelle={texts.accessibilite.fermerMenu} onPress={() => fermer()} />
            <Wordmark />
            <View style={styles.cale} />
          </View>
          {lignes.map((l) => (
            <Pressable
              key={l.libelle}
              accessibilityRole="button"
              accessibilityState={{ selected: l.actif }}
              onPress={() => fermer(l.actif ? undefined : l.aller)}
              style={styles.ligne}
            >
              <Text style={[styles.libelle, { color: l.actif ? colors.ink : colors.inkMuted }]}>{l.libelle}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </Modal>
    </MenuContexte.Provider>
  );
}

const styles = StyleSheet.create({
  voile: { backgroundColor: 'rgba(21, 19, 15, 0.35)' },
  panneau: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.paper,
    borderRightWidth: spacing.hairline,
    borderRightColor: colors.ink,
    paddingHorizontal: spacing.screen,
  },
  entete: {
    height: spacing.touchTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: spacing.hairline,
    borderBottomColor: colors.ink,
    marginBottom: 8,
  },
  cale: { width: spacing.touchTarget },
  ligne: {
    height: spacing.sheetRowHeight,
    justifyContent: 'center',
    borderBottomWidth: spacing.hairline,
    borderBottomColor: colors.ink,
  },
  libelle: { ...type.gridName, fontSize: 24 },
});
