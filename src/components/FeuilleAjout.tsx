import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

import { BoutonIcone } from './BoutonIcone';
import { Etiquette } from './Etiquette';
import { Icone, type NomIcone } from './Icone';

type Props = {
  visible: boolean;
  onFermer: () => void;
  onManuel: () => void;
};

/** Feuille du bas « Ajouter une pièce » : une ligne par mode d'ajout (DESIGN.md, « Feuille du bas »). */
export function FeuilleAjout({ visible, onFermer, onManuel }: Props) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onFermer}>
      <Pressable style={styles.voile} onPress={onFermer} accessible={false} />
      <View style={[styles.feuille, { paddingBottom: bottom + 16 }]}>
        <View style={styles.entete}>
          <Etiquette style={styles.titre}>{texts.ajout.titre}</Etiquette>
          <BoutonIcone nom="fermer" libelle={texts.accessibilite.fermerAjout} onPress={onFermer} />
        </View>
        {/* L'ajout par lien arrive à l'étape 5 : la ligne est visible mais inactive d'ici là. */}
        <LigneMode icone="lien" {...texts.ajout.lien} desactive />
        <LigneMode icone="crayon" {...texts.ajout.manuel} onPress={onManuel} />
      </View>
    </Modal>
  );
}

function LigneMode({
  icone,
  libelle,
  phrase,
  onPress,
  desactive = false,
}: {
  icone: NomIcone;
  libelle: string;
  phrase: string;
  onPress?: () => void;
  desactive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desactive }}
      disabled={desactive}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, (pressed || desactive) && styles.estompe]}
    >
      <Icone nom={icone} />
      <View style={styles.textes}>
        <Text style={[type.button, styles.libelle]}>{libelle}</Text>
        <Text style={[type.body, styles.phrase]}>{phrase}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: 'rgba(21, 19, 15, 0.3)' },
  feuille: {
    backgroundColor: colors.paper,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.ink,
    paddingHorizontal: spacing.screen,
  },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: -10, paddingTop: 6 },
  titre: { color: colors.ink },
  ligne: {
    height: spacing.sheetRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.photo1,
  },
  estompe: { opacity: 0.4 },
  textes: { flex: 1 },
  libelle: { color: colors.ink },
  phrase: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
});
