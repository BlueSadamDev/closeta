import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import {
  FlatList,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { parPaires, regrouperParCategorie, regrouperParMarque, type Section, type Vue } from '@/domain/wishlist';
import { colors, fonts, spacing, type } from '@/theme';

import { Etiquette } from './Etiquette';
import { RichText } from './RichText';

/**
 * Les pièces en grille de 2 colonnes, ou regroupées par catégorie ou par marque avec sous-totaux
 * (docs/SPEC.md, « Vue par catégorie » et « Tri et vue par marque »). Commun à la Wishlist et au Vestiaire.
 * La barre de filtres suit l'en-tête ; en faisant défiler, une copie reste fixée en haut
 * (DESIGN.md, « Barre collante »).
 */
export function ListePieces({
  articles,
  vue,
  enTete,
  barre,
  carte,
  margeBas,
}: {
  /** Pièces déjà filtrées et triées. */
  articles: Article[];
  vue: Vue;
  enTete: ReactElement;
  barre: ReactElement;
  carte: (article: Article, largeur: number) => ReactElement;
  /** Place laissée sous la liste (bouton « Ajouter » de la Wishlist). */
  margeBas: number;
}) {
  const { width } = useWindowDimensions();
  const largeur = (width - 2 * spacing.screen - spacing.gridColumnGap) / 2;
  const sections = useMemo(
    () =>
      vue === 'grille'
        ? []
        : (vue === 'marques' ? regrouperParMarque : regrouperParCategorie)(articles).map((section) => ({
            section,
            data: parPaires(section.articles),
          })),
    [vue, articles],
  );
  const aucunResultat = <RichText style={styles.aucunResultat}>{texts.wishlist.aucunResultat}</RichText>;

  // Position de la barre dans l'en-tête, puis « collée » dès qu'on a défilé au-delà.
  const [hauteurAvantBarre, setHauteurAvantBarre] = useState<number | null>(null);
  const [collee, setCollee] = useState(false);
  const surDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const auDela = hauteurAvantBarre !== null && e.nativeEvent.contentOffset.y > hauteurAvantBarre;
    if (auDela !== collee) setCollee(auDela);
  };
  const enTeteComplet = (
    <View>
      {enTete}
      <View style={styles.placeBarre} onLayout={(e: LayoutChangeEvent) => setHauteurAvantBarre(e.nativeEvent.layout.y)}>
        {barre}
      </View>
    </View>
  );
  const barreCollee = collee ? <View style={styles.barreCollee}>{barre}</View> : null;

  if (vue !== 'grille') {
    return (
      <View style={styles.conteneur}>
        <SectionList
          onScroll={surDefilement}
          scrollEventThrottle={16}
          sections={sections}
          keyExtractor={(paire) => paire[0].id}
          ListHeaderComponent={enTeteComplet}
          ListEmptyComponent={aucunResultat}
          contentContainerStyle={[styles.sections, { paddingBottom: margeBas }]}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <EnTeteSection
              section={section.section}
              sansTitre={vue === 'marques' ? texts.wishlist.sansMarque : texts.wishlist.aClasser}
              premiere={section === sections[0]}
            />
          )}
          renderItem={({ item: paire }) => (
            <View style={styles.rangee}>
              {paire.map((article) => (
                <View key={article.id}>{carte(article, largeur)}</View>
              ))}
            </View>
          )}
        />
        {barreCollee}
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      <FlatList
        onScroll={surDefilement}
        scrollEventThrottle={16}
        data={articles}
        keyExtractor={(a) => a.id}
        numColumns={2}
        ListHeaderComponent={enTeteComplet}
        ListEmptyComponent={aucunResultat}
        columnWrapperStyle={styles.colonnes}
        contentContainerStyle={[styles.grille, { paddingBottom: margeBas }]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => carte(item, largeur)}
      />
      {barreCollee}
    </View>
  );
}

/** En-tête d'une section (catégorie ou marque) : filet, titre et nombre de pièces, sous-total. */
function EnTeteSection({ section, sansTitre, premiere }: { section: Section; sansTitre: string; premiere: boolean }) {
  const { titre, total } = section;
  // La première section suit directement le filet de la barre de filtres : pas de second filet.
  return (
    <View style={[styles.enTeteSection, premiere && styles.premiereSection]}>
      <Etiquette
        style={styles.titreSection}
      >{`${titre ?? sansTitre} · ${texts.wishlist.pieces(total.pieces)}`}</Etiquette>
      <View style={styles.blocTotal}>
        <Text style={[styles.sousTotal, { color: colors.ink }]}>{formaterPrix(total.euros)}</Text>
        {total.sansPrix > 0 ? (
          <Text style={[type.gridPrice, { color: colors.inkMuted }]}>
            {texts.wishlist.prixACompleter(total.sansPrix)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1 },
  placeBarre: { marginTop: 22 },
  barreCollee: {
    position: 'absolute',
    top: 0,
    left: spacing.screen,
    right: spacing.screen,
  },
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
  premiereSection: { borderTopWidth: 0, marginTop: 0 },
  titreSection: {
    color: colors.ink,
    flexShrink: 1,
    paddingBottom: 4,
    marginRight: 12,
  },
  blocTotal: { alignItems: 'flex-end', paddingBottom: 4 },
  sousTotal: { fontFamily: fonts.serifSemiBold, fontSize: 19 },
  rangee: {
    flexDirection: 'row',
    gap: spacing.gridColumnGap,
    marginBottom: spacing.gridRowGap,
  },
  aucunResultat: {
    ...type.body,
    fontSize: 22,
    lineHeight: 30,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 48,
  },
});
