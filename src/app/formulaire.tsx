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
import { PhotoArticle } from '@/components/PhotoArticle';
import { RichText } from '@/components/RichText';
import { enregistrerArticle, lireArticle } from '@/db/articles';
import { lireParametreAlternative, preremplirDepuisAlternative } from '@/domain/alternatives';
import { CATEGORIES, PRIORITES, type Article, type TypeArticle } from '@/domain/article';
import { brouillonDepuisLien, listeFrancaise, nomDuSite, preremplir, type ChampManquant } from '@/domain/lien';
import { brouillonDepuisDescription, lireParametresPhoto, preremplirDepuisProposition, type Proposition } from '@/domain/photo';
import { prixPourSaisie } from '@/domain/prix';
import { releveAEnregistrer } from '@/domain/releve';
import { texts } from '@/domain/texts';
import { dateAchatPourSaisie, etatDeDepart } from '@/domain/vestiaire';
import { BROUILLON_VIDE, validerBrouillon, type Brouillon, type Erreurs } from '@/domain/validation';
import { extraire } from '@/relay/client';
import { prendrePhoto, type SourcePhoto } from '@/photo/prise';
import { copierImage, effacerFichier, rangerPhoto } from '@/relay/image';
import { lireJeton } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

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
  dateAchat: dateAchatPourSaisie(a.dateAchat),
});

/** Formulaire de départ d'un ajout par photo : proposition choisie, ou seulement ce que l'IA a vu. */
function departPhoto(description: string | undefined, proposition: string | undefined) {
  const lu = lireParametresPhoto(description, proposition);
  if (lu.proposition) {
    const p = preremplirDepuisProposition(lu.proposition, lu.description);
    return {
      proposition: lu.proposition,
      brouillon: p.brouillon,
      manquants: p.manquants,
      annonce: lu.proposition.alternative ? texts.formulaire.photo.alternative : texts.formulaire.photo.proposition,
    };
  }
  return {
    proposition: null as Proposition | null,
    brouillon: brouillonDepuisDescription(lu.description),
    manquants: [] as ChampManquant[],
    annonce: texts.formulaire.photo.depuisPhoto,
  };
}

/**
 * Formulaire de départ d'une alternative choisie depuis une fiche : pré-rempli avec ce que la recherche a trouvé.
 * Le type et la catégorie de la pièce d'origine sont ajoutés une fois celle-ci relue.
 */
function departAlternative(alternative: string | undefined) {
  const a = lireParametreAlternative(alternative);
  if (!a) return null;
  const p = preremplirDepuisAlternative(a, { type: null, categorie: null });
  return {
    proposition: { ...a, alternative: true } as Proposition,
    brouillon: p.brouillon,
    manquants: p.manquants,
    annonce: texts.alternatives.annonce,
  };
}

/** Formulaire de saisie (ajout manuel et modification) — docs/SPEC.md, « 4. Formulaire de validation ». */
export default function Formulaire() {
  const { id, lien, photo, description, proposition, destination, alternative, alternativeDe } = useLocalSearchParams<{
    id?: string;
    lien?: string;
    photo?: string;
    description?: string;
    proposition?: string;
    /** « vestiaire » : ajout direct au Vestiaire (docs/SPEC.md, « Lot 3 », « Étape 6 »). */
    destination?: string;
    /** Alternative choisie (texte JSON) et identifiant de la pièce d'origine. */
    alternative?: string;
    alternativeDe?: string;
  }>();
  const db = useSQLiteContext();
  const [existant, setExistant] = useState<Article | null>(null);
  // Ajout par photo : formulaire préparé une fois, à l'ouverture, depuis la photo et la proposition choisie.
  // Ajout d'une alternative : même principe, depuis l'alternative choisie sur l'écran « Alternatives ».
  const [depart] = useState(() =>
    id ? null : photo ? departPhoto(description, proposition) : alternativeDe ? departAlternative(alternative) : null,
  );
  // Pièce d'origine, seulement si l'alternative a bien été relue.
  const lieeA = !id && !photo && alternativeDe && depart ? alternativeDe : null;
  const [brouillon, setBrouillon] = useState<Brouillon>(depart?.brouillon ?? BROUILLON_VIDE);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [enCours, setEnCours] = useState(false);
  // Ajout par lien : lecture de la page, photo trouvée, message et champs à compléter.
  const [lecture, setLecture] = useState(!id && !!lien);
  const [imageSource, setImageSource] = useState<string | null>(depart?.proposition?.image ?? null);
  const [annonce, setAnnonce] = useState<string | null>(depart?.annonce ?? null);
  const [manquants, setManquants] = useState<ChampManquant[]>(depart?.manquants ?? []);
  // Ajout par photo : proposition choisie.
  const choisie = depart?.proposition ?? null;
  // Photo prise ou choisie par l'utilisateur (parcours photo, ou ajoutée depuis le formulaire),
  // et photo gardée quand la boutique en fournit une aussi.
  const [maPhoto, setMaPhoto] = useState<string | null>(!id && photo ? photo : null);
  const [photoGardee, setPhotoGardee] = useState<'maPhoto' | 'boutique'>(choisie?.image ? 'boutique' : 'maPhoto');
  const [choixPhotoOuvert, setChoixPhotoOuvert] = useState(false);
  const [messagePhoto, setMessagePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    lireArticle(db, id).then((a) => {
      if (a) {
        setExistant(a);
        setBrouillon(versBrouillon(a));
      }
    });
  }, [db, id]);

  // Alternative : type et catégorie repris de la pièce d'origine (même genre de pièce).
  useEffect(() => {
    if (!lieeA) return;
    lireArticle(db, lieeA).then((o) => {
      if (o) setBrouillon((b) => ({ ...b, type: b.type ?? o.type, categorie: b.categorie || (o.categorie ?? '') }));
    });
  }, [db, lieeA]);

  useEffect(() => {
    if (id || !lien) return;
    let actif = true;
    (async () => {
      const resultat = await extraire(lien, await lireJeton());
      if (!actif) return;
      if (resultat.ok) {
        const p = preremplir(resultat.extraction);
        setBrouillon(p.brouillon);
        setImageSource(p.image);
        setManquants(p.manquants);
        setAnnonce(texts.formulaire.lien.trouve);
      } else {
        // Un échec ne bloque jamais l'ajout : formulaire vide, lien conservé.
        setBrouillon(brouillonDepuisLien(lien));
        setAnnonce(texts.formulaire.lien.echecs[resultat.raison]);
      }
      setLecture(false);
    })();
    return () => {
      actif = false;
    };
  }, [id, lien]);

  const changer = <K extends keyof Brouillon>(champ: K, valeur: Brouillon[K]) => {
    setBrouillon((b) => ({ ...b, [champ]: valeur }));
    // Le message disparaît dès que l'utilisateur corrige le champ.
    setErreurs((e) => (champ in e ? { ...e, [champ]: undefined } : e));
  };

  // Pièce du Vestiaire (ajout direct ou modification) : sans priorité, avec prix payé et date d'achat.
  const pourVestiaire = existant ? existant.statut === 'achete' : !id && destination === 'vestiaire';

  const fermer = () =>
    router.canGoBack() ? router.back() : router.replace(pourVestiaire ? '/vestiaire' : '/');

  const ajouterPhoto = async (source: SourcePhoto) => {
    setMessagePhoto(null);
    const prise = await prendrePhoto(source);
    if (prise.ok) {
      setMaPhoto(prise.uri);
      setPhotoGardee('maPhoto');
      setChoixPhotoOuvert(false);
    } else if (prise.raison !== 'annule') {
      setMessagePhoto(prise.raison === 'camera_refusee' ? texts.photo.cameraRefusee : texts.photo.photoIllisible);
    }
  };

  const enregistrer = async () => {
    const r = validerBrouillon(brouillon);
    if (!r.ok) {
      setErreurs(r.erreurs);
      return;
    }
    setEnCours(true);
    const maintenant = new Date().toISOString();
    const nouvelId = randomUUID();
    // La photo trouvée sur la boutique est copiée sur le téléphone ; en cas d'échec, on garde son adresse.
    // « Ma photo » : la photo prise ou choisie est rangée dans le stockage de l'app.
    const garderMaPhoto = !!maPhoto && (photoGardee === 'maPhoto' || !imageSource);
    const source = garderMaPhoto ? null : imageSource;
    // Modification avec une nouvelle photo : rangée sous un nouveau nom, l'ancienne est effacée après l'enregistrement.
    const remplacee = existant && maPhoto ? await rangerPhoto(maPhoto, `${existant.id}-${Date.now()}`) : null;
    const imageLocale = existant
      ? null
      : garderMaPhoto && maPhoto
        ? await rangerPhoto(maPhoto, nouvelId)
        : source
          ? await copierImage(source, nouvelId)
          : null;
    // Une alternative vient d'une page de boutique : même origine qu'un ajout par lien.
    const origine = photo ? 'photo' : lien || lieeA ? 'lien' : 'manuel';
    // Date d'achat : seulement pour le Vestiaire ; inchangée à la saisie, elle garde son heure d'origine.
    const dateAchat = !pourVestiaire
      ? null
      : existant && dateAchatPourSaisie(existant.dateAchat) === brouillon.dateAchat.trim()
        ? existant.dateAchat
        : r.champs.dateAchat;
    const article: Article = existant
      ? {
          ...existant,
          ...r.champs,
          ...(remplacee ? { imageLocale: remplacee, imageSource: null } : {}),
          dateAchat,
          dateMaj: maintenant,
        }
      : {
          id: nouvelId,
          ...r.champs,
          devise: 'EUR',
          imageLocale,
          imageSource: source,
          origine,
          estAlternative: choisie?.alternative ?? false,
          dateAjout: maintenant,
          dateAchat,
          dateMaj: maintenant,
          prixAjout: r.champs.prix,
          disponibilite: 'inconnue',
          dispoTaille: 'inconnue',
          // Statut ; page boutique lue (ajout par lien dans la Wishlist), jamais pour le Vestiaire.
          ...etatDeDepart(pourVestiaire ? 'vestiaire' : 'wishlist', origine, maintenant),
          // Alternative : la page boutique n'a pas été relue (fiche remplie depuis la recherche).
          ...(lieeA ? { dateVerif: null } : {}),
          alternativeDe: lieeA,
        };
    try {
      // Historique des prix (Wishlist seulement) : relevé à l'ajout par lien ou photo, ou à chaque prix modifié à la main.
      await enregistrerArticle(db, article, releveAEnregistrer(existant, article, randomUUID()));
      if (remplacee && existant?.imageLocale) effacerFichier(existant.imageLocale);
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
  const aujourdhui = dateAchatPourSaisie(new Date().toISOString());

  // Pendant la lecture de la page : texte d'attente, sans roue qui tourne (DESIGN.md, « Chargement »).
  if (lecture) {
    return (
      <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
        <Entete gauche={<BoutonIcone nom="fermer" libelle={f.annuler} onPress={fermer} />} />
        <View style={styles.contenu}>
          <Text style={[type.screenTitle, styles.titre]}>{f.titreNouveau}</Text>
          <Text style={styles.lectureTexte}>{f.lien.lecture}</Text>
          {lien ? <Text style={[type.body, styles.discret]}>{nomDuSite(lien)}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <Entete gauche={<BoutonIcone nom="fermer" libelle={f.annuler} onPress={fermer} />} />
      <KeyboardAvoidingView behavior="padding" style={styles.ecran}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[type.screenTitle, styles.titre]}>{existant ? f.titreModifier : f.titreNouveau}</Text>

          {annonce ? (
            <View style={styles.annonce}>
              <RichText style={styles.annonceTexte}>{annonce}</RichText>
              {manquants.length > 0 ? (
                <Text style={[type.body, styles.discret]}>
                  {f.lien.aCompleter + listeFrancaise(manquants.map((m) => f.lien.manquants[m]))}.
                </Text>
              ) : null}
            </View>
          ) : null}

          <BlocPhoto
            apercu={
              maPhoto && (photoGardee === 'maPhoto' || !imageSource)
                ? { imageLocale: maPhoto, imageSource: null }
                : !existant && imageSource
                  ? { imageLocale: null, imageSource }
                  : existant && (existant.imageLocale || existant.imageSource)
                    ? { imageLocale: existant.imageLocale, imageSource: existant.imageSource }
                    : null
            }
            nom={brouillon.nom}
            choixBoutique={!!maPhoto && !!imageSource && !existant}
            photoGardee={photoGardee}
            onPhotoGardee={setPhotoGardee}
            choixOuvert={choixPhotoOuvert}
            onOuvrirChoix={() => setChoixPhotoOuvert(true)}
            onAjouter={ajouterPhoto}
            message={messagePhoto}
          />

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

          <Champ libelle={pourVestiaire ? f.champs.prixPaye : f.champs.prix} erreur={message('prix')}>
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

          {pourVestiaire ? (
            <Champ libelle={f.champs.dateAchat} erreur={message('dateAchat')}>
              <Saisie
                value={brouillon.dateAchat}
                onChangeText={(v) => changer('dateAchat', v)}
                placeholder={f.exemples.dateAchat}
                keyboardType="numbers-and-punctuation"
                enErreur={!!erreurs.dateAchat}
              />
              <Choix
                options={[{ valeur: aujourdhui, libelle: f.aujourdhui }]}
                valeur={brouillon.dateAchat.trim() === aujourdhui ? aujourdhui : null}
                onChange={(v) => changer('dateAchat', v)}
              />
            </Champ>
          ) : (
            <Champ libelle={f.champs.priorite}>
              <Choix options={OPTIONS_PRIORITE} valeur={brouillon.priorite} onChange={(v) => changer('priorite', v)} />
            </Champ>
          )}

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

/**
 * Photo de la pièce dans le formulaire : aperçu, choix « Ma photo / Celle de la boutique » quand les deux existent,
 * et boutons pour prendre ou choisir une photo (« Changer la photo » quand il y en a déjà une).
 */
function BlocPhoto({
  apercu,
  nom,
  choixBoutique,
  photoGardee,
  onPhotoGardee,
  choixOuvert,
  onOuvrirChoix,
  onAjouter,
  message,
}: {
  apercu: { imageLocale: string | null; imageSource: string | null } | null;
  nom: string;
  choixBoutique: boolean;
  photoGardee: 'maPhoto' | 'boutique';
  onPhotoGardee: (v: 'maPhoto' | 'boutique') => void;
  choixOuvert: boolean;
  onOuvrirChoix: () => void;
  onAjouter: (source: SourcePhoto) => void;
  message: string | null;
}) {
  const f = texts.formulaire;
  return (
    <View style={styles.blocPhoto}>
      {apercu ? <PhotoArticle article={{ id: 'apercu', nom: nom || ' ', ...apercu }} hauteur={240} /> : null}
      <Champ libelle={f.photo.image}>
        <View style={styles.boutonsPhoto}>
          {choixBoutique ? (
            <Choix
              options={[
                { valeur: 'maPhoto', libelle: f.photo.maPhoto },
                { valeur: 'boutique', libelle: f.photo.boutique },
              ]}
              valeur={photoGardee}
              onChange={onPhotoGardee}
            />
          ) : null}
          {apercu && !choixOuvert ? (
            <Bouton libelle={f.photo.changer} variante="secondaire" onPress={onOuvrirChoix} />
          ) : (
            <>
              <Bouton libelle={texts.photo.prendre} variante="secondaire" onPress={() => onAjouter('camera')} />
              <Bouton libelle={texts.photo.choisir} variante="secondaire" onPress={() => onAjouter('galerie')} />
            </>
          )}
          {message ? <RichText style={styles.messagePhoto}>{message}</RichText> : null}
        </View>
      </Champ>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.paper },
  contenu: { padding: spacing.screen, paddingBottom: 48 },
  titre: { color: colors.ink, marginTop: 8, marginBottom: 6 },
  deuxColonnes: { flexDirection: 'row', gap: spacing.gridColumnGap },
  colonne: { flex: 1 },
  actions: { marginTop: 36, gap: 12 },
  lectureTexte: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 20, marginBottom: 4 },
  annonce: { marginTop: 12, marginBottom: 8, gap: 6 },
  annonceTexte: { ...type.body, color: colors.ink },
  discret: { color: colors.inkMuted },
  blocPhoto: { marginTop: 12, gap: 8 },
  boutonsPhoto: { gap: 12 },
  messagePhoto: { ...type.body, color: colors.ink },
});
