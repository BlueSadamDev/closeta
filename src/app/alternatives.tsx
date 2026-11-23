import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { CarteProposition } from '@/components/CarteProposition';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { RichText } from '@/components/RichText';
import { lireArticle } from '@/db/articles';
import { ecartPrix, imagePourRecherche, type Alternative } from '@/domain/alternatives';
import type { Article } from '@/domain/article';
import { formaterPrix } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { photoEnBase64 } from '@/photo/prise';
import { chercherAlternatives } from '@/relay/client';
import { lireJeton } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

const t = texts.alternatives;

type Etat =
  | { etape: 'recherche' }
  | { etape: 'resultats'; alternatives: Alternative[] }
  | { etape: 'echec'; message: string };

/** « 30 € de moins », « 12 € de plus », « Même prix », ou rien si un prix manque. */
function texteEcart(piece: Article, a: Alternative): string | null {
  const e = ecartPrix(piece.prix, a);
  if (!e) return null;
  return e.sens === 'egal' ? t.ecart.egal : t.ecart[e.sens](formaterPrix(e.euros));
}

/** Écran « Alternatives » d'une pièce de la Wishlist (docs/SPEC.md, lot 3, étape 2). */
export default function Alternatives() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [piece, setPiece] = useState<Article | null>(null);
  const [etat, setEtat] = useState<Etat>({ etape: 'recherche' });
  // Évite d'afficher le résultat d'une recherche relancée entre-temps, ou après la fermeture de l'écran.
  const recherche = useRef(0);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const chercher = useCallback(async (a: Article) => {
    const numero = ++recherche.current;
    setEtat({ etape: 'recherche' });
    // Sans image de boutique, la photo du téléphone est envoyée ; illisible, la recherche se fait sans elle.
    const image = imagePourRecherche(a);
    const photo = image && 'fichier' in image ? await photoEnBase64(image.fichier) : null;
    const resultat = await chercherAlternatives(a, photo, await lireJeton());
    if (numero !== recherche.current) return;
    setEtat(
      resultat.ok ? { etape: 'resultats', alternatives: resultat.alternatives } : { etape: 'echec', message: t.echecs[resultat.raison] },
    );
  }, []);

  useEffect(() => {
    // Un compteur, pas un élément affiché : le relire au nettoyage est voulu.
    const compteur = recherche;
    lireArticle(db, id).then((a) => {
      setPiece(a);
      if (a) chercher(a);
      else setEtat({ etape: 'echec', message: texts.fiche.introuvable });
    });
    return () => {
      compteur.current++;
    };
  }, [db, id, chercher]);

  // L'alternative choisie ouvre le formulaire pré-rempli, liée à la pièce d'origine.
  const ajouter = (a: Alternative) =>
    router.push({ pathname: '/formulaire', params: { alternative: JSON.stringify(a), alternativeDe: id } });

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="retour" libelle={texts.accessibilite.retour} onPress={retour} />} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={[type.screenTitle, styles.titre]}>{t.titre}</Text>
        {piece ? <Text style={[type.body, styles.discret]}>{piece.nom}</Text> : null}

        {etat.etape === 'recherche' ? <Text style={styles.attente}>{t.recherche}</Text> : null}

        {etat.etape === 'resultats' && piece ? (
          etat.alternatives.length === 0 ? (
            <RichText style={styles.texte}>{t.aucun}</RichText>
          ) : (
            <>
              <RichText style={styles.texte}>{t.resultats}</RichText>
              <Etiquette style={styles.compte}>{t.compte(etat.alternatives.length)}</Etiquette>
              <View style={styles.liste}>
                {etat.alternatives.map((a) => (
                  <CarteProposition
                    key={a.url}
                    proposition={{ ...a, alternative: false }}
                    ecart={texteEcart(piece, a)}
                    onPress={() => ajouter(a)}
                  />
                ))}
              </View>
            </>
          )
        ) : null}

        {etat.etape === 'echec' ? <RichText style={styles.texte}>{etat.message}</RichText> : null}

        {etat.etape === 'echec' && piece ? (
          <View style={styles.actions}>
            <Bouton libelle={t.reessayer} variante="secondaire" onPress={() => chercher(piece)} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 6 },
  discret: { color: colors.inkMuted },
  texte: { ...type.body, color: colors.ink, marginTop: 16 },
  attente: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20 },
  compte: { marginTop: 20, marginBottom: 4 },
  liste: { borderBottomWidth: spacing.hairline, borderBottomColor: colors.photo1 },
  actions: { marginTop: 32, gap: 12 },
});
