import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { BoutonIcone } from '@/components/BoutonIcone';
import { Champ, Saisie } from '@/components/Champ';
import { Choix } from '@/components/Choix';
import { Entete } from '@/components/Entete';
import { enregistrerArticle, lireArticle } from '@/db/articles';
import { CATEGORIES, PRIORITES, type Article, type TypeArticle } from '@/domain/article';
import { prixPourSaisie } from '@/domain/prix';
import { texts } from '@/domain/texts';
import { BROUILLON_VIDE, validerBrouillon, type Brouillon, type Erreurs } from '@/domain/validation';
import { colors, spacing, type } from '@/theme';

const TYPES: { valeur: TypeArticle; libelle: string }[] = [
  { valeur: 'vetement', libelle: texts.types.vetement },
  { valeur: 'chaussures', libelle: texts.types.chaussures },
];
const OPTIONS_PRIORITE = PRIORITES.map((p) => ({ valeur: p, libelle: texts.priorites[p] }));

const versBrouillon = (a: Article): Brouillon => ({
  nom: a.nom,
  marque: a.marque ?? '',
  type: a.type,
  categorie: a.categorie ?? '',
  taille: a.taille ?? '',
  couleur: a.couleur ?? '',
  prix: prixPourSaisie(a.prix),
  urlBoutique: a.urlBoutique ?? '',
  priorite: a.priorite,
  notes: a.notes ?? '',
});

/** Formulaire de saisie (ajout manuel et modification) — docs/SPEC.md, « 4. Formulaire de validation ». */
export default function Formulaire() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useSQLiteContext();
  const [existant, setExistant] = useState<Article | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon>(BROUILLON_VIDE);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!id) return;
    lireArticle(db, id).then((a) => {
      if (a) {
        setExistant(a);
        setBrouillon(versBrouillon(a));
      }
    });
  }, [db, id]);

  const changer = <K extends keyof Brouillon>(champ: K, valeur: Brouillon[K]) => {
    setBrouillon((b) => ({ ...b, [champ]: valeur }));
    // Le message disparaît dès que l'utilisateur corrige le champ.
    setErreurs((e) => (champ in e ? { ...e, [champ]: undefined } : e));
  };

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const enregistrer = async () => {
    const r = validerBrouillon(brouillon);
    if (!r.ok) {
      setErreurs(r.erreurs);
      return;
    }
    const maintenant = new Date().toISOString();
    const article: Article = existant
      ? { ...existant, ...r.champs, dateMaj: maintenant }
      : {
          id: randomUUID(),
          ...r.champs,
          devise: 'EUR',
          imageLocale: null,
          imageSource: null,
          statut: 'souhaite',
          origine: 'manuel',
          estAlternative: false,
          dateAjout: maintenant,
          dateAchat: null,
          dateMaj: maintenant,
        };
    setEnCours(true);
    try {
      await enregistrerArticle(db, article);
      fermer();
    } catch {
      setEnCours(false);
      Alert.alert('', texts.formulaire.echecEnregistrement.replace(/\*/g, ''));
    }
  };

  const f = texts.formulaire;
  const message = (cle: keyof Erreurs) => {
    const e = erreurs[cle];
    return e ? f.erreurs[e] : undefined;
  };
  const suggestions = brouillon.type ? CATEGORIES[brouillon.type] : [];

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="fermer" libelle={f.annuler} onPress={fermer} />} />
      <KeyboardAvoidingView behavior="padding" style={styles.ecran}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[type.screenTitle, styles.titre]}>{existant ? f.titreModifier : f.titreNouveau}</Text>

          <Champ libelle={f.champs.nom} obligatoire erreur={message('nom')}>
            <Saisie
              value={brouillon.nom}
              onChangeText={(v) => changer('nom', v)}
              placeholder={f.exemples.nom}
              enErreur={!!erreurs.nom}
              autoCapitalize="sentences"
            />
          </Champ>

          <Champ libelle={f.champs.type} obligatoire erreur={message('type')}>
            <Choix options={TYPES} valeur={brouillon.type} onChange={(v) => changer('type', v)} />
          </Champ>

          <Champ libelle={f.champs.categorie}>
            <Saisie
              value={brouillon.categorie}
              onChangeText={(v) => changer('categorie', v)}
              placeholder={f.exemples.categorie}
              autoCapitalize="sentences"
            />
            {suggestions.length > 0 ? (
              <Choix
                options={suggestions.map((c) => ({ valeur: c, libelle: c }))}
                valeur={suggestions.find((c) => c.toLowerCase() === brouillon.categorie.trim().toLowerCase()) ?? null}
                onChange={(v) => changer('categorie', v)}
              />
            ) : null}
          </Champ>

          <Champ libelle={f.champs.marque}>
            <Saisie value={brouillon.marque} onChangeText={(v) => changer('marque', v)} placeholder={f.exemples.marque} autoCapitalize="words" />
          </Champ>

          <Champ libelle={f.champs.prix} erreur={message('prix')}>
            <Saisie
              value={brouillon.prix}
              onChangeText={(v) => changer('prix', v)}
              placeholder={f.exemples.prix}
              keyboardType="decimal-pad"
              enErreur={!!erreurs.prix}
            />
          </Champ>

          <View style={styles.deuxColonnes}>
            <View style={styles.colonne}>
              <Champ libelle={f.champs.taille}>
                <Saisie value={brouillon.taille} onChangeText={(v) => changer('taille', v)} placeholder={f.exemples.taille} />
              </Champ>
            </View>
            <View style={styles.colonne}>
              <Champ libelle={f.champs.couleur}>
                <Saisie value={brouillon.couleur} onChangeText={(v) => changer('couleur', v)} placeholder={f.exemples.couleur} />
              </Champ>
            </View>
          </View>

          <Champ libelle={f.champs.priorite}>
            <Choix options={OPTIONS_PRIORITE} valeur={brouillon.priorite} onChange={(v) => changer('priorite', v)} />
          </Champ>

          <Champ libelle={f.champs.lien} erreur={message('urlBoutique')}>
            <Saisie
              value={brouillon.urlBoutique}
              onChangeText={(v) => changer('urlBoutique', v)}
              placeholder={f.exemples.lien}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              enErreur={!!erreurs.urlBoutique}
            />
          </Champ>

          <Champ libelle={f.champs.notes}>
            <Saisie value={brouillon.notes} onChangeText={(v) => changer('notes', v)} placeholder={f.exemples.notes} multiline />
          </Champ>

          <View style={styles.actions}>
            <Bouton libelle={f.enregistrer} onPress={enregistrer} desactive={enCours} />
            <Bouton libelle={f.annuler} variante="secondaire" onPress={fermer} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 6 },
  deuxColonnes: { flexDirection: 'row', gap: spacing.gridColumnGap },
  colonne: { flex: 1 },
  actions: { marginTop: 36, gap: 12 },
});
