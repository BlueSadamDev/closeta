import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { lienConfiguration, lireNomInstallation, type Installation } from '@/domain/configuration';
import { settings } from '@/domain/settings';
import { texts } from '@/domain/texts';
import { dateAchatLongue } from '@/domain/vestiaire';
import { ajouterInstallation, listerInstallations, revoquerInstallation } from '@/relay/client';
import { lireAdresse } from '@/relay/jeton';
import { colors, fonts, spacing, type } from '@/theme';

import { Bouton } from './Bouton';
import { Champ, Saisie } from './Champ';
import { CodeQR } from './CodeQR';
import { RichText } from './RichText';

const t = texts.reglages.installations;

type Props = {
  /** Jeton d'administration rangé sur ce téléphone (non vide : la section est visible). */
  jetonAdmin: string;
  /** Côté du QR affiché, en px. */
  tailleQr: number;
};

/**
 * Section « Installations » des Réglages (docs/SPEC.md, « Lot 3 », « Étape 10 ») :
 * liste des téléphones du relais, ajout d'un téléphone (QR affiché une seule fois), révocation.
 */
export function SectionInstallations({ jetonAdmin, tailleQr }: Props) {
  const [liste, setListe] = useState<Installation[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [nom, setNom] = useState('');
  const [nouveau, setNouveau] = useState<{ nom: string; lien: string } | null>(null);

  const appliquer = useCallback((r: Awaited<ReturnType<typeof listerInstallations>>) => {
    if (r.ok) {
      setListe(r.installations);
      setMessage(null);
    } else {
      setListe(null);
      setMessage(t.echec[r.raison]);
    }
  }, []);

  // Liste chargée à l'affichage de la section, et à nouveau si le jeton d'administration change.
  useEffect(() => {
    let actif = true;
    listerInstallations(jetonAdmin).then((r) => {
      if (actif) appliquer(r);
    });
    return () => {
      actif = false;
    };
  }, [jetonAdmin, appliquer]);

  const charger = async () => {
    setChargement(true);
    appliquer(await listerInstallations(jetonAdmin));
    setChargement(false);
  };

  const creer = async () => {
    const propre = lireNomInstallation(nom);
    if (!propre) {
      setMessage(t.nomManquant);
      return;
    }
    setChargement(true);
    setMessage(null);
    const r = await ajouterInstallation(jetonAdmin, propre);
    if (!r.ok) {
      setChargement(false);
      setMessage(t.echec[r.raison]);
      return;
    }
    // Le jeton n'existe qu'ici, dans le QR : il n'est rangé nulle part sur ce téléphone.
    setNouveau({ nom: propre, lien: lienConfiguration({ relais: await lireAdresse(), jeton: r.jeton }) });
    setAjout(false);
    setNom('');
    await charger();
  };

  const revoquer = (i: Installation) => {
    const c = texts.confirmations;
    Alert.alert(c.revocation.titre, c.revocation.message, [
      { text: c.annuler, style: 'cancel' },
      {
        text: c.revocation.confirmer,
        style: 'destructive',
        onPress: async () => {
          setMessage(null);
          const r = await revoquerInstallation(jetonAdmin, i.id);
          setMessage(r.ok ? t.revocationFaite : t.echec[r.raison]);
          if (r.ok) await charger();
        },
      },
    ]);
  };

  return (
    <View>
      {nouveau ? (
        <View style={styles.qr}>
          <RichText style={styles.texte}>{t.nouveauQr(nouveau.nom)}</RichText>
          <View style={styles.espaceQr}>
            <CodeQR valeur={nouveau.lien} taille={tailleQr} libelle={texts.accessibilite.qrConfiguration} />
          </View>
          <Text style={[type.body, styles.miseEnGarde]}>{texts.reglages.qrMiseEnGarde}</Text>
          <View style={styles.boutons}>
            <Bouton libelle={t.termine} onPress={() => setNouveau(null)} />
          </View>
        </View>
      ) : null}

      {liste?.map((i) => (
        <View key={i.id} style={styles.ligne}>
          <View style={styles.infos}>
            <Text style={[type.gridName, { color: i.actif ? colors.ink : colors.inkMuted }]} numberOfLines={1}>
              {i.nom}
            </Text>
            <Text style={[type.gridPrice, styles.detail]}>
              {[
                i.creeLe ? t.ajouteLe(dateAchatLongue(i.creeLe) ?? '') : t.principale,
                t.recherches(i.utilise),
              ].join(' · ')}
            </Text>
          </View>
          {!i.actif ? (
            <Text style={[type.label, styles.revoque]}>{t.revoque}</Text>
          ) : i.creeLe ? (
            <Pressable accessibilityRole="button" onPress={() => revoquer(i)} style={styles.action} hitSlop={8}>
              <Text style={[type.button, styles.danger]}>{t.revoquer}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {chargement || (liste === null && message === null) ? <Text style={styles.chargement}>{nouveau || ajout ? t.creation : t.chargement}</Text> : null}
      {message ? <RichText style={styles.message}>{message}</RichText> : null}

      {liste && !nouveau ? (
        ajout ? (
          <View style={styles.ajout}>
            <Champ libelle={t.nom}>
              <Saisie value={nom} onChangeText={setNom} placeholder={t.nomExemple} maxLength={settings.nomInstallationMax} autoFocus />
            </Champ>
            <View style={styles.boutons}>
              <Bouton libelle={t.creer} onPress={creer} desactive={chargement} />
              <Bouton libelle={texts.confirmations.annuler} variante="secondaire" onPress={() => setAjout(false)} />
            </View>
          </View>
        ) : (
          <View style={styles.boutons}>
            <Bouton libelle={t.ajouter} variante="secondaire" icone="plus" onPress={() => setAjout(true)} />
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  texte: { ...type.body, color: colors.ink },
  qr: { paddingVertical: 16 },
  espaceQr: { marginVertical: 20 },
  miseEnGarde: { color: colors.inkMuted },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: spacing.hairline,
    borderTopColor: colors.ink,
  },
  infos: { flex: 1 },
  detail: { color: colors.inkMuted, marginTop: 2 },
  revoque: { color: colors.inkMuted },
  action: { minHeight: 44, justifyContent: 'center' },
  danger: { color: colors.danger },
  chargement: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink, marginTop: 16 },
  message: { ...type.body, color: colors.ink, marginTop: 16 },
  ajout: { marginTop: 16 },
  boutons: { gap: 12, marginTop: 20 },
});
