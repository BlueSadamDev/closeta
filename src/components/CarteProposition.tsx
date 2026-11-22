import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Proposition } from '@/domain/photo';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

import { Etiquette } from './Etiquette';
import { PhotoArticle } from './PhotoArticle';

const LARGEUR_PHOTO = 96;
const HAUTEUR_PHOTO = 120;

/**
 * Une proposition de l'ajout par photo : photo, marque, nom, prix, boutique.
 * Une alternative porte l'étiquette « ALTERNATIVE » en tabac (DESIGN.md, « Proposition »).
 */
export function CarteProposition({ proposition: p, onPress }: { proposition: Proposition; onPress: () => void }) {
  const enEuros = p.devise === null || p.devise === 'EUR';
  const prix = p.prix !== null && enEuros ? formaterPrix(p.prix) : null;
  const accessible = [p.alternative ? texts.photo.alternativeAccessible : null, p.marque, p.nom, prix ?? texts.fiche.prixACompleter, p.boutique]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessible}
      onPress={onPress}
      style={({ pressed }) => [styles.carte, pressed && styles.appuye]}
    >
      <PhotoArticle
        article={{ id: p.url, nom: p.nom, imageLocale: null, imageSource: p.image }}
        hauteur={HAUTEUR_PHOTO}
        tailleLettre={40}
        style={styles.photo}
      />
      <View style={styles.textes}>
        {p.alternative ? <Etiquette style={styles.alternative}>{texts.photo.alternative}</Etiquette> : null}
        {p.marque ? <Etiquette>{p.marque}</Etiquette> : null}
        <Text style={[type.gridName, styles.nom]} numberOfLines={3}>
          {p.nom}
        </Text>
        <Text style={[type.gridPrice, { color: prix ? colors.ink : colors.inkMuted }]}>{prix ?? texts.fiche.prixACompleter}</Text>
        {p.boutique ? (
          <Text style={[type.gridPrice, styles.boutique]} numberOfLines={1}>
            {p.boutique}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 16,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.photo1,
  },
  appuye: { opacity: 0.6 },
  photo: { width: LARGEUR_PHOTO },
  textes: { flex: 1, gap: 3, justifyContent: 'center' },
  alternative: { color: colors.tobacco },
  nom: { color: colors.ink, lineHeight: 22 },
  boutique: { color: colors.inkMuted },
});
