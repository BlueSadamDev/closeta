import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { CarteArticle } from '@/components/CarteArticle';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { FeuilleAjout } from '@/components/FeuilleAjout';
import { RichText } from '@/components/RichText';
import { lireWishlist } from '@/db/articles';
import { PRIORITES, type Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import {
  categoriesPresentes,
  FILTRE_VIDE,
  filtrer,
  parPaires,
  regrouperParCategorie,
  totalWishlist,
  trier,
  TRIS,
  VUES,
  type Filtre,
  type Section,
  type Tri,
  type Vue,
} from '@/domain/wishlist';
import { colors, fonts, spacing, type } from '@/theme';

type SousMenu = 'priorite' | 'categorie' | null;

/** Écran d'accueil : la Wishlist (docs/SPEC.md, « 1. Wishlist »). */
export default function Wishlist() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [filtre, setFiltre] = useState<Filtre>(FILTRE_VIDE);
  const [tri, setTri] = useState<Tri>('date');
  const [vue, setVue] = useState<Vue>('grille');
  const [sousMenu, setSousMenu] = useState<SousMenu>(null);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  // Relit la base à chaque retour sur l'écran (après un ajout, une modification, un achat…).
  useFocusEffect(
    useCallback(() => {
      lireWishlist(db).then(setArticles);
    }, [db]),
  );

  const visibles = useMemo(() => trier(filtrer(articles ?? [], filtre), tri), [articles, filtre, tri]);
  const total = totalWishlist(visibles);
  const sections = useMemo(
    () =>
      vue === 'categories'
        ? regrouperParCategorie(visibles).map((section) => ({ section, data: parPaires(section.articles) }))
        : [],
    [vue, visibles],
  );
  const categories = useMemo(() => categoriesPresentes(articles ?? []), [articles]);
  const largeurCarte = (width - 2 * spacing.screen - spacing.gridColumnGap) / 2;

  if (articles === null) return <SafeAreaView style={styles.ecran} />;

  const fermerRecherche = () => {
    setRechercheOuverte(false);
    setFiltre((f) => ({ ...f, recherche: '' }));
  };

  const triSuivant = () => setTri(TRIS[(TRIS.indexOf(tri) + 1) % TRIS.length]);
  const vueSuivante = () => setVue(VUES[(VUES.indexOf(vue) + 1) % VUES.length]);

  const carte = (article: Article) => (
    <CarteArticle article={article} largeur={largeurCarte} onPress={() => router.push(`/article/${article.id}`)} />
  );
  const aucunResultat = <RichText style={[styles.phrase, styles.aucunResultat]}>{texts.wishlist.aucunResultat}</RichText>;

  const enTeteDeListe = (
    <View>
      {rechercheOuverte ? (
        <View style={styles.recherche}>
          <TextInput
            autoFocus
            value={filtre.recherche}
            onChangeText={(recherche) => setFiltre((f) => ({ ...f, recherche }))}
            placeholder={texts.wishlist.recherche}
            placeholderTextColor={colors.inkMuted}
            style={styles.champRecherche}
            returnKeyType="search"
          />
        </View>
      ) : null}

      <Etiquette style={styles.surTitre}>{texts.wishlist.surTitre(total.pieces)}</Etiquette>
      <View style={styles.ligneTitre}>
        <Text style={[type.screenTitle, styles.titre]}>{texts.wishlist.titre}</Text>
        <View style={styles.blocTotal}>
          <Text style={[type.total, { color: colors.ink }]}>{formaterPrix(total.euros)}</Text>
          {total.sansPrix > 0 ? (
            <Text style={[type.gridPrice, { color: colors.inkMuted }]}>{texts.wishlist.prixACompleter(total.sansPrix)}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtres}>
        <MotFiltre
          libelle={texts.wishlist.filtres.tout}
          actif={filtre.type === null && filtre.priorite === null && filtre.categorie === null}
          onPress={() => {
            setFiltre((f) => ({ ...FILTRE_VIDE, recherche: f.recherche }));
            setSousMenu(null);
          }}
        />
        <MotFiltre
          libelle={texts.wishlist.filtres.vetements}
          actif={filtre.type === 'vetement'}
          onPress={() => setFiltre((f) => ({ ...f, type: f.type === 'vetement' ? null : 'vetement' }))}
        />
        <MotFiltre
          libelle={texts.wishlist.filtres.chaussures}
          actif={filtre.type === 'chaussures'}
          onPress={() => setFiltre((f) => ({ ...f, type: f.type === 'chaussures' ? null : 'chaussures' }))}
        />
        <MotFiltre
          libelle={filtre.priorite ? texts.priorites[filtre.priorite] : texts.wishlist.filtres.priorite}
          actif={filtre.priorite !== null || sousMenu === 'priorite'}
          onPress={() => setSousMenu(sousMenu === 'priorite' ? null : 'priorite')}
        />
        <MotFiltre
          libelle={filtre.categorie ?? texts.wishlist.filtres.categorie}
          actif={filtre.categorie !== null || sousMenu === 'categorie'}
          onPress={() => setSousMenu(sousMenu === 'categorie' ? null : 'categorie')}
        />
      </ScrollView>

      {sousMenu === 'priorite' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousFiltres}>
          {PRIORITES.map((p) => (
            <MotFiltre
              key={p}
              libelle={texts.priorites[p]}
              actif={filtre.priorite === p}
              onPress={() => setFiltre((f) => ({ ...f, priorite: f.priorite === p ? null : p }))}
            />
          ))}
        </ScrollView>
      ) : null}

      {sousMenu === 'categorie' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousFiltres}>
          {categories.length === 0 ? (
            <Etiquette style={styles.motFiltre}>{texts.wishlist.filtres.aucuneCategorie}</Etiquette>
          ) : (
            categories.map((c) => (
              <MotFiltre
                key={c}
                libelle={c}
                actif={filtre.categorie === c}
                onPress={() => setFiltre((f) => ({ ...f, categorie: f.categorie === c ? null : c }))}
              />
            ))
          )}
        </ScrollView>
      ) : null}

      <View style={styles.ligneTri}>
        <Pressable accessibilityRole="button" onPress={vueSuivante} style={styles.boutonTri} hitSlop={8}>
          <Etiquette>{`${texts.wishlist.vue.intitule} · ${texts.wishlist.vue[vue]}`}</Etiquette>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={triSuivant} style={styles.boutonTri} hitSlop={8}>
          <Etiquette>{`${texts.wishlist.tri.intitule} · ${texts.wishlist.tri[tri]}`}</Etiquette>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete
        gauche={<BoutonIcone nom="menu" libelle={texts.accessibilite.reglages} onPress={() => router.push('/reglages')} />}
        droite={
          rechercheOuverte ? (
            <BoutonIcone nom="fermer" libelle={texts.accessibilite.fermerRecherche} onPress={fermerRecherche} />
          ) : (
            <BoutonIcone nom="recherche" libelle={texts.accessibilite.rechercher} onPress={() => setRechercheOuverte(true)} />
          )
        }
      />

      <View style={styles.corps}>
      {articles.length === 0 ? (
        <View style={styles.vide}>
          <RichText style={styles.phrase}>{texts.wishlist.vide}</RichText>
        </View>
      ) : vue === 'categories' ? (
        <SectionList
          sections={sections}
          keyExtractor={(paire) => paire[0].id}
          ListHeaderComponent={enTeteDeListe}
          ListEmptyComponent={aucunResultat}
          contentContainerStyle={styles.sections}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <EnTeteSection section={section.section} />}
          renderItem={({ item: paire }) => (
            <View style={styles.rangee}>
              {paire.map((article) => (
                <View key={article.id}>{carte(article)}</View>
              ))}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(a) => a.id}
          numColumns={2}
          ListHeaderComponent={enTeteDeListe}
          ListEmptyComponent={aucunResultat}
          columnWrapperStyle={styles.colonnes}
          contentContainerStyle={styles.grille}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => carte(item)}
        />
      )}

      <View style={styles.ajouter}>
        <Bouton libelle={texts.wishlist.ajouter} icone="plus" onPress={() => setFeuilleOuverte(true)} />
      </View>
      <FeuilleAjout
        visible={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        onLien={() => {
          setFeuilleOuverte(false);
          router.push('/lien');
        }}
        onManuel={() => {
          setFeuilleOuverte(false);
          router.push('/formulaire');
        }}
      />
      </View>
    </SafeAreaView>
  );
}

/** Un mot de la ligne de filtres : actif = ink souligné, inactif = inkMuted. */
function MotFiltre({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={onPress} style={styles.zoneFiltre}>
      <Etiquette style={[styles.motFiltre, actif && styles.motFiltreActif]}>{libelle}</Etiquette>
    </Pressable>
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
  ecran: { flex: 1, backgroundColor: colors.paper },
  corps: { flex: 1 },
  grille: { paddingHorizontal: spacing.screen, paddingBottom: 120, gap: spacing.gridRowGap },
  colonnes: { gap: spacing.gridColumnGap },
  sections: { paddingHorizontal: spacing.screen, paddingBottom: 120 },
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
  sousTotal: { fontFamily: fonts.serifSemiBold, fontSize: 19 },
  rangee: { flexDirection: 'row', gap: spacing.gridColumnGap, marginBottom: spacing.gridRowGap },
  recherche: { marginTop: 16, borderBottomWidth: spacing.hairline, borderBottomColor: colors.ink },
  champRecherche: { ...type.body, color: colors.ink, height: spacing.touchTarget, paddingHorizontal: 0 },
  surTitre: { marginTop: 28 },
  ligneTitre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  titre: { color: colors.ink, paddingTop: 6 },
  blocTotal: { alignItems: 'flex-end', paddingBottom: 4 },
  filtres: { gap: 18, marginTop: 22 },
  sousFiltres: { gap: 18 },
  zoneFiltre: { minHeight: spacing.touchTarget, justifyContent: 'center' },
  motFiltre: { paddingBottom: 4, borderBottomWidth: spacing.hairline, borderBottomColor: 'transparent' },
  motFiltreActif: { color: colors.ink, borderBottomColor: colors.ink },
  ligneTri: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  boutonTri: { minHeight: spacing.touchTarget, justifyContent: 'center' },
  vide: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.screen },
  phrase: { ...type.body, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: 'center' },
  aucunResultat: { marginTop: 48, fontFamily: fonts.sans },
  ajouter: { position: 'absolute', right: spacing.screen, bottom: spacing.screen },
});
