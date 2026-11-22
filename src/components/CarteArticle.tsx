import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

import { Etiquette } from './Etiquette';
import { PhotoArticle } from './PhotoArticle';

/**
 * Carte de la grille : photo + étiquette, marque, nom, prix (DESIGN.md, « Carte article »).
 * L'étiquette est la priorité, sauf si une autre est donnée (mois d'achat dans le Vestiaire).
 */
export function CarteArticle({
  article,
  largeur,
  onPress,
  etiquette,
}: {
  article: Article;
  largeur: number;
  onPress: () => void;
  etiquette?: string | null;
}) {
  const texteEtiquette = etiquette === undefined ? texts.priorites[article.priorite] : etiquette;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ width: largeur }}>
      <View>
        <PhotoArticle article={article} hauteur={spacing.gridPhotoHeight} />
        {texteEtiquette ? (
          <View style={styles.priorite}>
            <Text style={[type.label, styles.prioriteTexte]}>{texteEtiquette}</Text>
          </View>
        ) : null}
      </View>
      {article.marque ? (
        <Etiquette style={styles.marque}>{article.marque}</Etiquette>
      ) : null}
      <Text style={[type.gridName, styles.nom]} numberOfLines={2}>
        {article.nom}
      </Text>
      <Text style={[type.gridPrice, { color: article.prix === null ? colors.inkMuted : colors.ink }]}>
        {article.prix === null ? texts.fiche.prixACompleter : formaterPrix(article.prix)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  priorite: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.paper, paddingHorizontal: 8, paddingVertical: 5 },
  prioriteTexte: { color: colors.ink, fontSize: 10 },
  marque: { marginTop: 10 },
  nom: { color: colors.ink, marginTop: 2, lineHeight: 22 },
});
