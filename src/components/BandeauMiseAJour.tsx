import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import type { VersionPubliee } from '@/domain/miseAJour';
import { texts } from '@/domain/texts';
import { masquerMiseAJour, verifierMiseAJour } from '@/relay/miseAJour';
import { colors, spacing, type } from '@/theme';

import { BoutonIcone } from './BoutonIcone';
import { Icone } from './Icone';
import { RichText } from './RichText';

/**
 * Bandeau discret « Nouvelle version 1.2.0 disponible » (docs/SPEC.md, « Lot 4 », « Étape 7 ») :
 * au toucher, la release s'ouvre dans le navigateur ; la croix masque cette version jusqu'à la suivante.
 * Rien ne s'affiche si le relais ne répond pas ou si l'app est à jour.
 */
export function BandeauMiseAJour() {
  const [annonce, setAnnonce] = useState<VersionPubliee | null>(null);

  useEffect(() => {
    let actif = true;
    verifierMiseAJour().then((v) => {
      if (actif) setAnnonce(v);
    });
    return () => {
      actif = false;
    };
  }, []);

  if (!annonce) return null;

  const masquer = () => {
    setAnnonce(null);
    masquerMiseAJour(annonce.derniere);
  };

  return (
    <View style={styles.bandeau}>
      <Pressable
        accessibilityRole="link"
        onPress={() => Linking.openURL(annonce.url).catch(() => undefined)}
        style={styles.lien}
      >
        <RichText style={[type.body, styles.texte]}>{texts.miseAJour.bandeau(annonce.derniere)}</RichText>
        <Icone nom="suivant" taille={18} />
      </Pressable>
      <BoutonIcone nom="fermer" libelle={texts.accessibilite.masquerMiseAJour} onPress={masquer} />
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    minHeight: spacing.touchTarget,
    marginHorizontal: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: spacing.hairline,
    borderBottomWidth: spacing.hairline,
    borderColor: colors.ink,
  },
  lien: { flex: 1, minHeight: spacing.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 8 },
  texte: { color: colors.ink, flexShrink: 1 },
});
