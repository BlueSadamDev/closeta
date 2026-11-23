import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { PhotoArticle } from '@/components/PhotoArticle';
import { RichText } from '@/components/RichText';
import { enregistrerArticle, lireArticle, supprimerArticle } from '@/db/articles';
import { marquerAchete, remettreEnWishlist, type Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { niveauQuota, type Quota } from '@/domain/relais';
import { texts } from '@/domain/texts';
import { dateAchatLongue } from '@/domain/vestiaire';
import { lireQuotaRelais } from '@/relay/client';
import { effacerImage } from '@/relay/image';
import { lireJeton } from '@/relay/jeton';
import { colors, spacing, type } from '@/theme';

/** Fiche article (docs/SPEC.md, « 2. Fiche article »). */
export default function Fiche() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  // undefined = en cours de lecture, null = introuvable.
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  // Pièce dont celle-ci est une alternative (null si aucune, ou si elle a été supprimée).
  const [origine, setOrigine] = useState<Article | null>(null);
  // Recherches SerpApi du mois, affichées avant « Voir des alternatives » (null = pas de réponse).
  const [quota, setQuota] = useState<Quota | null>(null);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireArticle(db, id).then(async (a) => {
        if (!actif) return;
        setArticle(a);
        const o = a?.alternativeDe ? await lireArticle(db, a.alternativeDe) : null;
        if (actif) setOrigine(o);
        // Le compteur ne sert qu'aux pièces de la Wishlist ; le lire ne consomme aucune recherche.
        if (a?.statut === 'souhaite') {
          const q = await lireQuotaRelais(await lireJeton());
          if (actif) setQuota(q);
        }
      });
      return () => {
        actif = false;
      };
    }, [db, id]),
  );

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (article === undefined) return <SafeAreaView style={styles.ecran} />;

  if (article === null) {
    return (
      <SafeAreaView style={styles.ecran}>
        <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={retour} />} />
        <View style={styles.introuvable}>
          <RichText style={styles.phrase}>{texts.fiche.introuvable}</RichText>
        </View>
      </SafeAreaView>
    );
  }

  const acheter = () => {
    const c = texts.confirmations;
    Alert.alert(c.achat.titre, c.achat.message, [
      { text: c.annuler, style: 'cancel' },
      {
        text: c.achat.confirmer,
        onPress: async () => {
          await enregistrerArticle(db, marquerAchete(article, new Date()));
          retour();
        },
      },
    ]);
  };

  const remettre = () => {
    const c = texts.confirmations;
    Alert.alert(c.remise.titre, c.remise.message, [
      { text: c.annuler, style: 'cancel' },
      {
        text: c.remise.confirmer,
        onPress: async () => {
          await enregistrerArticle(db, remettreEnWishlist(article, new Date()));
          retour();
        },
      },
    ]);
  };

  const supprimer = () => {
    const c = texts.confirmations;
    Alert.alert(c.suppression.titre, c.suppression.message, [
      { text: c.annuler, style: 'cancel' },
      {
        text: c.suppression.confirmer,
        style: 'destructive',
        onPress: async () => {
          await supprimerArticle(db, article.id);
          effacerImage(article.id, article.imageLocale);
          retour();
        },
      },
    ]);
  };

  const ouvrirBoutique = async () => {
    try {
      if (article.urlBoutique) await Linking.openURL(article.urlBoutique);
    } catch {
      Alert.alert('', texts.fiche.lienIllisible.replace(/\*/g, ''));
    }
  };

  const achete = article.statut === 'achete';
  const enWishlist = article.statut === 'souhaite';
  const quotaAtteint = quota !== null && niveauQuota(quota) === 'atteint';
  const dateAchat = dateAchatLongue(article.dateAchat);
  const details: [string, string | null][] = [
    [texts.fiche.taille, article.taille],
    [texts.fiche.couleur, article.couleur],
    [texts.fiche.categorie, article.categorie],
    // Pièce achetée : la date d'achat remplace la priorité (docs/SPEC.md, « Fiche d'une pièce achetée »).
    achete
      ? [texts.fiche.achat, dateAchat ? texts.fiche.acheteLe(dateAchat) : texts.fiche.nonDate]
      : [texts.fiche.priorite, texts.priorites[article.priorite]],
  ];

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={retour} />} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <PhotoArticle article={article} hauteur={420} tailleLettre={120} />

        {article.marque ? <Etiquette style={styles.marque}>{article.marque}</Etiquette> : null}
        <Text style={[type.sheetName, styles.nom]}>{article.nom}</Text>
        {article.prix === null ? (
          <Text style={[type.body, { color: colors.inkMuted }]}>{texts.fiche.prixACompleter}</Text>
        ) : (
          <Text style={[type.sheetPrice, { color: colors.ink }]}>{formaterPrix(article.prix)}</Text>
        )}

        {origine ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/article/${origine.id}`)} style={styles.origine}>
            <Etiquette>{texts.fiche.alternativeA}</Etiquette>
            <Text style={[type.body, styles.texteOrigine]} numberOfLines={1}>
              {origine.nom}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.details}>
          {details.map(([libelle, valeur]) => (
            <View key={libelle} style={styles.ligne}>
              <Etiquette>{libelle}</Etiquette>
              <Text style={[type.body, { color: valeur ? colors.ink : colors.inkMuted }]}>{valeur ?? texts.fiche.aCompleter}</Text>
            </View>
          ))}
        </View>

        {article.notes ? (
          <View style={styles.notes}>
            <Etiquette>{texts.fiche.notes}</Etiquette>
            <Text style={[type.body, styles.texteNotes]}>{article.notes}</Text>
          </View>
        ) : null}

        {article.urlBoutique ? (
          <Pressable accessibilityRole="link" onPress={ouvrirBoutique} style={styles.lien}>
            <Text style={[type.button, styles.texteLien]}>{texts.fiche.voirEnBoutique}</Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          {achete ? null : <Bouton libelle={texts.fiche.acheter} onPress={acheter} />}
          {enWishlist ? (
            <View style={styles.alternatives}>
              <Bouton
                libelle={texts.alternatives.voir}
                variante="secondaire"
                desactive={quotaAtteint}
                onPress={() => router.push(`/alternatives?id=${article.id}`)}
              />
              {quota ? (
                <Text style={[type.body, styles.discret]}>
                  {texts.alternatives.recherches
                    .replace('{utilise}', String(quota.utilise))
                    .replace('{limite}', String(quota.limite))}
                  {quotaAtteint ? '' : ` · ${texts.alternatives.cout}`}
                </Text>
              ) : null}
              {quotaAtteint ? <RichText style={[type.body, styles.discret]}>{texts.alternatives.quotaAtteint}</RichText> : null}
            </View>
          ) : null}
          <Bouton libelle={texts.fiche.modifier} variante="secondaire" onPress={() => router.push(`/formulaire?id=${article.id}`)} />
          {achete ? <Bouton libelle={texts.fiche.remettre} variante="secondaire" onPress={remettre} /> : null}
          <Bouton libelle={texts.fiche.supprimer} variante="danger" onPress={supprimer} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  marque: { marginTop: 24 },
  nom: { color: colors.ink, marginTop: 6, marginBottom: 6 },
  details: { marginTop: 24, borderTopWidth: spacing.hairline, borderTopColor: colors.ink },
  ligne: {
    minHeight: spacing.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: spacing.hairline,
    borderBottomColor: colors.ink,
  },
  notes: { marginTop: 24, gap: 8 },
  texteNotes: { color: colors.ink },
  lien: { marginTop: 24, minHeight: spacing.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  texteLien: { color: colors.ink, textDecorationLine: 'underline' },
  actions: { marginTop: 32, gap: 12 },
  alternatives: { gap: 8 },
  discret: { color: colors.inkMuted },
  origine: {
    marginTop: 12,
    minHeight: spacing.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  texteOrigine: { flexShrink: 1, color: colors.ink, textDecorationLine: 'underline' },
  introuvable: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.screen },
  phrase: { ...type.body, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: 'center' },
});
