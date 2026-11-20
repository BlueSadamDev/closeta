import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { texts } from '@/domain/texts';
import { colors, spacing, type } from '@/theme';

import { Etiquette } from './Etiquette';
import { RichText } from './RichText';

type Props = {
  libelle: string;
  obligatoire?: boolean;
  /** Message de la charte à afficher sous le champ (relief balisé *…*). */
  erreur?: string;
  children: ReactNode;
};

/** Bloc d'un champ du formulaire : étiquette, contenu, message éventuel. */
export function Champ({ libelle, obligatoire = false, erreur, children }: Props) {
  return (
    <View style={styles.bloc}>
      <View style={styles.entete}>
        <Etiquette style={erreur ? { color: colors.danger } : undefined}>{libelle}</Etiquette>
        {obligatoire ? <Text style={[type.label, styles.obligatoire]}>{texts.formulaire.obligatoire}</Text> : null}
      </View>
      {children}
      {erreur ? <RichText style={[type.body, styles.erreur]}>{erreur}</RichText> : null}
    </View>
  );
}

/** Zone de saisie au trait fin, sans cadre ni arrondi. */
export function Saisie(props: TextInputProps & { enErreur?: boolean }) {
  const { enErreur, style, ...reste } = props;
  return (
    <TextInput
      placeholderTextColor={colors.inkMuted}
      {...reste}
      style={[styles.saisie, reste.multiline && styles.multiligne, enErreur && styles.saisieErreur, style]}
    />
  );
}

const styles = StyleSheet.create({
  bloc: { marginTop: 22 },
  entete: { flexDirection: 'row', justifyContent: 'space-between' },
  obligatoire: { color: colors.inkMuted, fontSize: 10, textTransform: 'none', letterSpacing: 0 },
  saisie: {
    ...type.body,
    color: colors.ink,
    minHeight: spacing.touchTarget,
    borderBottomWidth: spacing.hairline,
    borderBottomColor: colors.ink,
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  multiligne: { minHeight: 88, textAlignVertical: 'top' },
  saisieErreur: { borderBottomColor: colors.danger },
  erreur: { color: colors.danger, marginTop: 6, fontSize: 14 },
});
