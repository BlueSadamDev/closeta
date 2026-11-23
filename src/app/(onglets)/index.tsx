import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarreFiltres } from '@/components/BarreFiltres';
import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { CarteArticle } from '@/components/CarteArticle';
import { ChampRecherche } from '@/components/ChampRecherche';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { FeuilleAjout } from '@/components/FeuilleAjout';
import { ListePieces } from '@/components/ListePieces';
import { useOuvrirMenu } from '@/components/MenuLateral';
import { RichText } from '@/components/RichText';
import { lireWishlist } from '@/db/articles';
import type { Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import {
  categoriesPresentes,
  FILTRE_VIDE,
  filtrer,
  totalWishlist,
  trier,
  TRIS,
  type Filtre,
  type Tri,
  type Vue,
} from '@/domain/wishlist';
import { colors, spacing, type } from '@/theme';

/** Écran d'accueil : la Wishlist (docs/SPEC.md, « 1. Wishlist »). */
export default function Wishlist() {
  const db = useSQLiteContext();
  const ouvrirMenu = useOuvrirMenu();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [filtre, setFiltre] = useState<Filtre>(FILTRE_VIDE);
  const [tri, setTri] = useState<Tri>('date');
  const [vue, setVue] = useState<Vue>('grille');
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  // Relit la base à chaque retour sur l'écran (après un ajout, une modification, un achat…).
  useFocusEffect(
    useCallback(() => {
      lireWishlist(db).then(setArticles);
    }, [db]),
  );

  const visibles = useMemo(() => trier(filtrer(articles ?? [], filtre), tri), [articles, filtre, tri]);
  const total = totalWishlist(visibles);
  const categories = useMemo(() => categoriesPresentes(articles ?? []), [articles]);

  if (articles === null) return <SafeAreaView style={styles.ecran} />;

  const fermerRecherche = () => {
    setRechercheOuverte(false);
    setFiltre((f) => ({ ...f, recherche: '' }));
  };

  const enTeteDeListe = (
    <View>
      {rechercheOuverte ? (
        <ChampRecherche valeur={filtre.recherche} onChange={(recherche) => setFiltre((f) => ({ ...f, recherche }))} />
      ) : null}

      <Etiquette style={styles.surTitre}>{texts.wishlist.surTitre(total.pieces)}</Etiquette>
      <View style={styles.ligneTitre}>
        <Text style={[type.screenTitle, styles.titre]}>{texts.wishlist.titre}</Text>
        <View style={styles.blocTotal}>
          <Text style={[type.total, { color: colors.ink }]}>{formaterPrix(total.euros)}</Text>
          {total.sansPrix > 0 ? (
            <Text style={[type.gridPrice, { color: colors.inkMuted }]}>
              {texts.wishlist.prixACompleter(total.sansPrix)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  const barreFiltres = (
    <BarreFiltres
      filtre={filtre}
      onFiltre={setFiltre}
      avecPriorite
      categories={categories}
      tri={tri}
      tris={TRIS}
      libellesTri={texts.wishlist.tri}
      onTri={setTri}
      vue={vue}
      onVue={setVue}
      ouvert={filtresOuverts}
      onBasculer={() => setFiltresOuverts((o) => !o)}
    />
  );

  return (
    <SafeAreaView style={styles.ecran} edges={['top']}>
      <Entete
        gauche={
          <BoutonIcone nom="menu" libelle={texts.accessibilite.menu} onPress={ouvrirMenu} />
        }
        droite={
          rechercheOuverte ? (
            <BoutonIcone nom="fermer" libelle={texts.accessibilite.fermerRecherche} onPress={fermerRecherche} />
          ) : (
            <BoutonIcone
              nom="recherche"
              libelle={texts.accessibilite.rechercher}
              onPress={() => setRechercheOuverte(true)}
            />
          )
        }
      />

      <View style={styles.corps}>
        {articles.length === 0 ? (
          <View style={styles.vide}>
            <RichText style={styles.phrase}>{texts.wishlist.vide}</RichText>
          </View>
        ) : (
          <ListePieces
            articles={visibles}
            vue={vue}
            enTete={enTeteDeListe}
            barre={barreFiltres}
            margeBas={120}
            carte={(article, largeur) => (
              <CarteArticle article={article} largeur={largeur} onPress={() => router.push(`/article/${article.id}`)} />
            )}
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
          onPhoto={() => {
            setFeuilleOuverte(false);
            router.push('/photo');
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

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  corps: { flex: 1 },
  surTitre: { marginTop: 16 },
  ligneTitre: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  titre: { color: colors.ink, paddingTop: 6 },
  blocTotal: { alignItems: 'flex-end', paddingBottom: 4 },
  vide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  phrase: {
    ...type.body,
    fontSize: 22,
    lineHeight: 30,
    color: colors.ink,
    textAlign: 'center',
  },
  ajouter: {
    position: 'absolute',
    right: spacing.screen,
    bottom: spacing.screen,
  },
});
