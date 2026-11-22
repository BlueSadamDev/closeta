import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BasculeEcran } from '@/components/BasculeEcran';
import { BoutonIcone } from '@/components/BoutonIcone';
import { CarteArticle } from '@/components/CarteArticle';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { RichText } from '@/components/RichText';
import { lireVestiaire } from '@/db/articles';
import type { Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { moisAchat, trierParAchat } from '@/domain/vestiaire';
import { totalWishlist } from '@/domain/wishlist';
import { colors, spacing, type } from '@/theme';

/** Le Vestiaire : les pièces achetées (docs/SPEC.md, « Lot 2 — Vestiaire »). */
export default function Vestiaire() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [articles, setArticles] = useState<Article[] | null>(null);

  // Relit la base à chaque retour sur l'écran (après une modification, une suppression…).
  useFocusEffect(
    useCallback(() => {
      lireVestiaire(db).then(setArticles);
    }, [db]),
  );

  const visibles = useMemo(() => trierParAchat(articles ?? []), [articles]);
  const total = totalWishlist(visibles);
  const largeurCarte = (width - 2 * spacing.screen - spacing.gridColumnGap) / 2;

  if (articles === null) return <SafeAreaView style={styles.ecran} />;

  const etiquette = (a: Article) => {
    const mois = moisAchat(a.dateAchat);
    return mois ? texts.vestiaire.acheteEn(mois) : null;
  };

  const enTeteDeListe = (
    <View style={styles.enTete}>
      <Etiquette style={styles.surTitre}>{texts.vestiaire.surTitre(total.pieces)}</Etiquette>
      <View style={styles.ligneTitre}>
        <Text style={[type.screenTitle, styles.titre]}>{texts.vestiaire.titre}</Text>
        <View style={styles.blocTotal}>
          <Text style={[type.total, { color: colors.ink }]}>{formaterPrix(total.euros)}</Text>
          {total.sansPrix > 0 ? (
            <Text style={[type.gridPrice, { color: colors.inkMuted }]}>{texts.wishlist.prixACompleter(total.sansPrix)}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete
        gauche={<BoutonIcone nom="menu" libelle={texts.accessibilite.reglages} onPress={() => router.push('/reglages')} />}
      />
      <BasculeEcran actif="vestiaire" />

      {articles.length === 0 ? (
        <View style={styles.vide}>
          <RichText style={styles.phrase}>{texts.vestiaire.vide}</RichText>
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(a) => a.id}
          numColumns={2}
          ListHeaderComponent={enTeteDeListe}
          columnWrapperStyle={styles.colonnes}
          contentContainerStyle={styles.grille}
          renderItem={({ item }) => (
            <CarteArticle
              article={item}
              largeur={largeurCarte}
              etiquette={etiquette(item)}
              onPress={() => router.push(`/article/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  grille: { paddingHorizontal: spacing.screen, paddingBottom: 48, gap: spacing.gridRowGap },
  colonnes: { gap: spacing.gridColumnGap },
  enTete: { marginBottom: 14 },
  surTitre: { marginTop: 16 },
  ligneTitre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  titre: { color: colors.ink, paddingTop: 6 },
  blocTotal: { alignItems: 'flex-end', paddingBottom: 4 },
  vide: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.screen },
  phrase: { ...type.body, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: 'center' },
});
