import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { FlatList, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { parPaires, regrouperParCategorie, type Section, type Vue } from '@/domain/wishlist';
import { colors, fonts, spacing, type } from '@/theme';

import { Etiquette } from './Etiquette';
import { RichText } from './RichText';

/**
 * Les pièces en grille de 2 colonnes, ou regroupées par catégorie avec sous-totaux
 * (docs/SPEC.md, « Vue par catégorie »). Commun à la Wishlist et au Vestiaire.
 */
export function ListePieces({
  articles,
  vue,
  enTete,
  carte,
  margeBas,
}: {
  /** Pièces déjà filtrées et triées. */
  articles: Article[];
  vue: Vue;
  enTete: ReactElement;
  carte: (article: Article, largeur: number) => ReactElement;
  /** Place laissée sous la liste (bouton « Ajouter » de la Wishlist). */
  margeBas: number;
}) {
  const { width } = useWindowDimensions();
  const largeur = (width - 2 * spacing.screen - spacing.gridColumnGap) / 2;
  const sections = useMemo(
    () =>
      vue === 'categories'
        ? regrouperParCategorie(articles).map((section) => ({ section, data: parPaires(section.articles) }))
        : [],
    [vue, articles],
  );
  const aucunResultat = <RichText style={styles.aucunResultat}>{texts.wishlist.aucunResultat}</RichText>;

  if (vue === 'categories') {
    return (
      <SectionList
        sections={sections}
        keyExtractor={(paire) => paire[0].id}
        ListHeaderComponent={enTete}
        ListEmptyComponent={aucunResultat}
        contentContainerStyle={[styles.sections, { paddingBottom: margeBas }]}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <EnTeteSection section={section.section} />}
        renderItem={({ item: paire }) => (
          <View style={styles.rangee}>
            {paire.map((article) => (
              <View key={article.id}>{carte(article, largeur)}</View>
            ))}
          </View>
        )}
      />
    );
  }

  return (
    <FlatList
      data={articles}
      keyExtractor={(a) => a.id}
      numColumns={2}
      ListHeaderComponent={enTete}
      ListEmptyComponent={aucunResultat}
      columnWrapperStyle={styles.colonnes}
      contentContainerStyle={[styles.grille, { paddingBottom: margeBas }]}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => carte(item, largeur)}
    />
  );
}

/** En-tête d'une section de la vue par catégorie : filet, catégorie et nombre de pièces, sous-total. */
function EnTeteSection({ section }: { section: Section }) {
  const { categorie, total } = section;
  return (
    <View style={styles.enTeteSection}>
      <Etiquette style={styles.titreSection}>{`${categorie ?? texts.wishlist.aClasser} · ${texts.wishlist.pieces(total.pieces)}`}</Etiquette>
      <View style={styles.blocTotal}>
        <Text style={[styles.sousTotal, { color: colors.ink }]}>{formaterPrix(total.euros)}</Text>
        {total.sansPrix > 0 ? (
          <Text style={[type.gridPrice, { color: colors.inkMuted }]}>{texts.wishlist.prixACompleter(total.sansPrix)}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grille: { paddingHorizontal: spacing.screen, gap: spacing.gridRowGap },
  colonnes: { gap: spacing.gridColumnGap },
  sections: { paddingHorizontal: spacing.screen },
  enTeteSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.ink,
    paddingTop: 14,
    marginTop: 14,
    marginBottom: 16,
  },
  titreSection: { color: colors.ink, flexShrink: 1, paddingBottom: 4, marginRight: 12 },
  blocTotal: { alignItems: 'flex-end', paddingBottom: 4 },
  sousTotal: { fontFamily: fonts.serifSemiBold, fontSize: 19 },
  rangee: { flexDirection: 'row', gap: spacing.gridColumnGap, marginBottom: spacing.gridRowGap },
  aucunResultat: { ...type.body, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: 'center', marginTop: 48 },
});
