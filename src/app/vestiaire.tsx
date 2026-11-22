import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarreFiltres } from '@/components/BarreFiltres';
import { BasculeEcran } from '@/components/BasculeEcran';
import { BoutonIcone } from '@/components/BoutonIcone';
import { CarteArticle } from '@/components/CarteArticle';
import { ChampRecherche } from '@/components/ChampRecherche';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { ListePieces } from '@/components/ListePieces';
import { RichText } from '@/components/RichText';
import { lireVestiaire } from '@/db/articles';
import type { Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { moisAchat, trierVestiaire, TRIS_VESTIAIRE, type TriVestiaire } from '@/domain/vestiaire';
import { categoriesPresentes, FILTRE_VIDE, filtrer, totalWishlist, type Filtre, type Vue } from '@/domain/wishlist';
import { colors, spacing, type } from '@/theme';

/** Le Vestiaire : les pièces achetées (docs/SPEC.md, « Lot 2 — Vestiaire »). */
export default function Vestiaire() {
  const db = useSQLiteContext();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [filtre, setFiltre] = useState<Filtre>(FILTRE_VIDE);
  const [tri, setTri] = useState<TriVestiaire>('achat');
  const [vue, setVue] = useState<Vue>('grille');
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  // Relit la base à chaque retour sur l'écran (après une modification, une suppression…).
  useFocusEffect(
    useCallback(() => {
      lireVestiaire(db).then(setArticles);
    }, [db]),
  );

  const visibles = useMemo(() => trierVestiaire(filtrer(articles ?? [], filtre), tri), [articles, filtre, tri]);
  const total = totalWishlist(visibles);
  const categories = useMemo(() => categoriesPresentes(articles ?? []), [articles]);

  if (articles === null) return <SafeAreaView style={styles.ecran} />;

  const fermerRecherche = () => {
    setRechercheOuverte(false);
    setFiltre((f) => ({ ...f, recherche: '' }));
  };

  const etiquette = (a: Article) => {
    const mois = moisAchat(a.dateAchat);
    return mois ? texts.vestiaire.acheteEn(mois) : null;
  };

  const enTeteDeListe = (
    <View>
      {rechercheOuverte ? (
        <ChampRecherche valeur={filtre.recherche} onChange={(recherche) => setFiltre((f) => ({ ...f, recherche }))} />
      ) : null}

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

      <BarreFiltres
        filtre={filtre}
        onFiltre={setFiltre}
        avecPriorite={false}
        categories={categories}
        tri={tri}
        tris={TRIS_VESTIAIRE}
        libellesTri={texts.vestiaire.tri}
        onTri={setTri}
        vue={vue}
        onVue={setVue}
      />
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
      <BasculeEcran actif="vestiaire" />

      {articles.length === 0 ? (
        <View style={styles.vide}>
          <RichText style={styles.phrase}>{texts.vestiaire.vide}</RichText>
        </View>
      ) : (
        <ListePieces
          articles={visibles}
          vue={vue}
          enTete={enTeteDeListe}
          margeBas={48}
          carte={(article, largeur) => (
            <CarteArticle
              article={article}
              largeur={largeur}
              etiquette={etiquette(article)}
              onPress={() => router.push(`/article/${article.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  surTitre: { marginTop: 16 },
  ligneTitre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  titre: { color: colors.ink, paddingTop: 6 },
  blocTotal: { alignItems: 'flex-end', paddingBottom: 4 },
  vide: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.screen },
  phrase: { ...type.body, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: 'center' },
});
