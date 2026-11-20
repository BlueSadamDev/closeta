import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Article } from '@/domain/article';
import { indiceAplat } from '@/domain/wishlist';
import { colors, fonts } from '@/theme';

const APLATS = [colors.photo1, colors.photo2, colors.photo3];

/**
 * Photo de l'article, recadrée. Sans photo (ou si elle ne charge pas) :
 * aplat photo1 à photo3 avec la première lettre du nom (DESIGN.md, « Article sans photo »).
 */
export function PhotoArticle({
  article,
  hauteur,
  tailleLettre = 64,
  style,
}: {
  article: Pick<Article, 'id' | 'nom' | 'imageLocale' | 'imageSource'>;
  hauteur: number;
  tailleLettre?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [echec, setEchec] = useState(false);
  const source = article.imageLocale ?? article.imageSource;
  const fond = APLATS[indiceAplat(article.id)];

  return (
    <View style={[{ height: hauteur, backgroundColor: fond }, styles.cadre, style]}>
      {source && !echec ? (
        <Image source={{ uri: source }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setEchec(true)} />
      ) : (
        <Text style={[styles.lettre, { fontSize: tailleLettre }]}>{article.nom.trim().charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  lettre: { fontFamily: fonts.serifMedium, color: colors.ink },
});
