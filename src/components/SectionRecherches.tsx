import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { GENRES, type GenreRecherche } from '@/domain/genre';
import { texts } from '@/domain/texts';
import { enregistrerGenre, lireGenre } from '@/relay/genre';
import { colors, type } from '@/theme';

import { Champ } from './Champ';
import { Choix } from './Choix';

const r = texts.reglages;
const OPTIONS = GENRES.map((g) => ({ valeur: g, libelle: r.genres[g] }));

/** Réglages, section « Recherches » : genre des recherches d'alternatives, enregistré dès le choix. */
export function SectionRecherches() {
  // null tant que la valeur rangée n'est pas lue.
  const [genre, setGenre] = useState<GenreRecherche | null>(null);

  useEffect(() => {
    lireGenre().then(setGenre);
  }, []);

  const choisir = (g: GenreRecherche) => {
    setGenre(g);
    enregistrerGenre(g).catch(() => undefined);
  };

  return (
    <>
      <Champ libelle={r.genre}>
        <Choix options={OPTIONS} valeur={genre} onChange={choisir} />
      </Champ>
      <Text style={[type.body, styles.aide]}>{r.genreAide}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  aide: { color: colors.inkMuted, marginTop: 8 },
});
