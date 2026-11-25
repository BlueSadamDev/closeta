import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { lienConfiguration, lireNomInstallation, type Installation } from '@/domain/configuration';
import { lienInvitation, type InvitationEnAttente } from '@/domain/invitation';
import { settings } from '@/domain/settings';
import { texts } from '@/domain/texts';
import { dateAchatLongue } from '@/domain/vestiaire';
import {
  ajouterInstallation,
  annulerInvitation,
  inviter,
  listerInstallations,
  listerInvitations,
  revoquerInstallation,
} from '@/relay/client';
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
 * liste des téléphones du relais, ajout d'un téléphone (QR affiché une seule fois), révocation ;
 * invitations (« Lot 4 », « Étape 6 ») : code sans jeton à partager, liste des invitations en attente, annulation.
 */
export function SectionInstallations({ jetonAdmin, tailleQr }: Props) {
  const [liste, setListe] = useState<Installation[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [nom, setNom] = useState('');
  const [nouveau, setNouveau] = useState<{ nom: string; lien: string } | null>(null);
  // Invitations : liste en attente (null tant qu'elle n'est pas lue), saisie du nom, invitation créée.
  const [invitations, setInvitations] = useState<InvitationEnAttente[] | null>(null);
  const [invitation, setInvitation] = useState(false);
  const [invitee, setInvitee] = useState<{ nom: string; code: string; lien: string } | null>(null);

  const appliquer = useCallback((r: Awaited<ReturnType<typeof listerInstallations>>) => {
    if (r.ok) {
      setListe(r.installations);
      setMessage(null);
    } else {
      setListe(null);
      setMessage(t.echec[r.raison]);
    }
  }, []);

  // Invitations en attente : un échec laisse simplement la liste vide (le message vient des installations).
  const lireInvitations = useCallback(
    async () => {
      const r = await listerInvitations(jetonAdmin);
      return r.ok ? r.invitations : [];
    },
    [jetonAdmin],
  );

  // Liste chargée à l'affichage de la section, et à nouveau si le jeton d'administration change.
  useEffect(() => {
    let actif = true;
    listerInstallations(jetonAdmin).then((r) => {
      if (actif) appliquer(r);
    });
    lireInvitations().then((i) => {
      if (actif) setInvitations(i);
    });
    return () => {
      actif = false;
    };
  }, [jetonAdmin, appliquer, lireInvitations]);

  const charger = async () => {
    setChargement(true);
    appliquer(await listerInstallations(jetonAdmin));
    setInvitations(await lireInvitations());
    setChargement(false);
  };

  const creerInvitation = async () => {
    const propre = lireNomInstallation(nom);
    if (!propre) {
      setMessage(t.nomManquant);
      return;
    }
    setChargement(true);
    setMessage(null);
    const r = await inviter(jetonAdmin, propre);
    if (!r.ok) {
      setChargement(false);
      setMessage(t.echec[r.raison]);
      return;
    }
    // Le code n'existe qu'ici : le relais n'en garde que l'empreinte.
    setInvitee({ nom: propre, code: r.code, lien: lienInvitation({ relais: await lireAdresse(), code: r.code }) });
    setInvitation(false);
    setNom('');
    await charger();
  };

  const partager = (i: { code: string; lien: string }) => {
    Share.share({ message: `${t.messagePartage(i.code)}\n${i.lien}` }).catch(() => undefined);
  };

  const annuler = (i: InvitationEnAttente) => {
    const c = texts.confirmations;
    Alert.alert(c.annulationInvitation.titre, c.annulationInvitation.message, [
      { text: c.annuler, style: 'cancel' },
      {
        text: c.annulationInvitation.confirmer,
        style: 'destructive',
        onPress: async () => {
          setMessage(null);
          const r = await annulerInvitation(jetonAdmin, i.id);
          setMessage(r.ok ? t.invitationAnnulee : t.echec[r.raison]);
          if (r.ok) setInvitations(await lireInvitations());
        },
      },
    ]);
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

      {invitee ? (
        <View style={styles.qr}>
          <RichText style={styles.texte}>{t.nouvelleInvitation(invitee.nom)}</RichText>
          <Text style={[type.sheetPrice, styles.code]} selectable>
            {invitee.code}
          </Text>
          <View style={styles.espaceQr}>
            <CodeQR valeur={invitee.lien} taille={tailleQr} libelle={texts.accessibilite.qrInvitation} />
          </View>
          <View style={styles.boutons}>
            <Bouton libelle={t.partager} onPress={() => partager(invitee)} />
            <Bouton libelle={t.invitationTerminee} variante="secondaire" onPress={() => setInvitee(null)} />
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

      {invitations && invitations.length > 0 ? (
        <View style={styles.enAttente}>
          <Text style={[type.label, styles.titreAttente]}>{t.invitationsEnAttente}</Text>
          {invitations.map((i) => (
            <View key={i.id} style={styles.ligne}>
              <View style={styles.infos}>
                <Text style={[type.gridName, { color: colors.ink }]} numberOfLines={1}>
                  {i.nom}
                </Text>
                <Text style={[type.gridPrice, styles.detail]}>{t.expireLe(dateAchatLongue(i.expireLe) ?? '')}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => annuler(i)} style={styles.action} hitSlop={8}>
                <Text style={[type.button, styles.danger]}>{t.annulerInvitation}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {chargement || (liste === null && message === null) ? (
        <Text style={styles.chargement}>{nouveau || ajout || invitee || invitation ? t.creation : t.chargement}</Text>
      ) : null}
      {message ? <RichText style={styles.message}>{message}</RichText> : null}

      {liste && !nouveau && !invitee ? (
        ajout || invitation ? (
          <View style={styles.ajout}>
            <Champ libelle={t.nom}>
              <Saisie
                value={nom}
                onChangeText={setNom}
                placeholder={invitation ? t.nomInviteExemple : t.nomExemple}
                maxLength={settings.nomInstallationMax}
                autoFocus
              />
            </Champ>
            <View style={styles.boutons}>
              <Bouton
                libelle={invitation ? t.creerInvitation : t.creer}
                onPress={invitation ? creerInvitation : creer}
                desactive={chargement}
              />
              <Bouton
                libelle={texts.confirmations.annuler}
                variante="secondaire"
                onPress={() => {
                  setAjout(false);
                  setInvitation(false);
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.boutons}>
            <Bouton libelle={t.ajouter} variante="secondaire" icone="plus" onPress={() => setAjout(true)} />
            <Bouton libelle={t.inviter} variante="secondaire" icone="plus" onPress={() => setInvitation(true)} />
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
  code: { color: colors.ink, marginTop: 16, letterSpacing: 1 },
  enAttente: { marginTop: 20 },
  titreAttente: { color: colors.inkMuted, marginBottom: 4 },
});
