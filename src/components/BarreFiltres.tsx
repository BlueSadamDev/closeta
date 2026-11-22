import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PRIORITES } from '@/domain/article';
import { texts } from '@/domain/texts';
import type { Filtre, Vue } from '@/domain/wishlist';
import { FILTRE_VIDE, VUES } from '@/domain/wishlist';
import { spacing } from '@/theme';

import { Etiquette } from './Etiquette';
import { MotFiltre } from './MotFiltre';

type SousMenu = 'priorite' | 'categorie' | null;

type Props<T extends string> = {
  filtre: Filtre;
  onFiltre: (modifier: (f: Filtre) => Filtre) => void;
  /** Le Vestiaire n'a pas de filtre Priorité (docs/SPEC.md, « Lot 2 — Vestiaire »). */
  avecPriorite: boolean;
  categories: readonly string[];
  tri: T;
  tris: readonly T[];
  libellesTri: Record<T, string>;
  onTri: (tri: T) => void;
  vue: Vue;
  onVue: (vue: Vue) => void;
};

/**
 * Filtres sur deux lignes, choix de priorité ou de catégorie en dessous, puis vue et tri
 * (DESIGN.md, « Filtres »). Commun à la Wishlist et au Vestiaire.
 */
export function BarreFiltres<T extends string>(props: Props<T>) {
  const { filtre, onFiltre, avecPriorite, categories, tri, tris, libellesTri, onTri, vue, onVue } = props;
  const [sousMenu, setSousMenu] = useState<SousMenu>(null);

  return (
    <View>
      <View style={styles.filtres}>
        <MotFiltre
          libelle={texts.wishlist.filtres.tout}
          actif={filtre.type === null && filtre.priorite === null && filtre.categorie === null}
          onPress={() => {
            onFiltre((f) => ({ ...FILTRE_VIDE, recherche: f.recherche }));
            setSousMenu(null);
          }}
        />
        {avecPriorite ? (
          <MotFiltre
            libelle={filtre.priorite ? texts.priorites[filtre.priorite] : texts.wishlist.filtres.priorite}
            actif={filtre.priorite !== null || sousMenu === 'priorite'}
            onPress={() => setSousMenu(sousMenu === 'priorite' ? null : 'priorite')}
          />
        ) : null}
        <MotFiltre
          libelle={filtre.categorie ?? texts.wishlist.filtres.categorie}
          actif={filtre.categorie !== null || sousMenu === 'categorie'}
          onPress={() => setSousMenu(sousMenu === 'categorie' ? null : 'categorie')}
        />
      </View>
      <View style={styles.filtresTypes}>
        <MotFiltre
          libelle={texts.wishlist.filtres.vetements}
          actif={filtre.type === 'vetement'}
          onPress={() => onFiltre((f) => ({ ...f, type: f.type === 'vetement' ? null : 'vetement' }))}
        />
        <MotFiltre
          libelle={texts.wishlist.filtres.chaussures}
          actif={filtre.type === 'chaussures'}
          onPress={() => onFiltre((f) => ({ ...f, type: f.type === 'chaussures' ? null : 'chaussures' }))}
        />
      </View>

      {avecPriorite && sousMenu === 'priorite' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousFiltres}>
          {PRIORITES.map((p) => (
            <MotFiltre
              key={p}
              libelle={texts.priorites[p]}
              actif={filtre.priorite === p}
              onPress={() => onFiltre((f) => ({ ...f, priorite: f.priorite === p ? null : p }))}
            />
          ))}
        </ScrollView>
      ) : null}

      {sousMenu === 'categorie' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousFiltres}>
          {categories.length === 0 ? (
            <Etiquette style={styles.aucuneCategorie}>{texts.wishlist.filtres.aucuneCategorie}</Etiquette>
          ) : (
            categories.map((c) => (
              <MotFiltre
                key={c}
                libelle={c}
                actif={filtre.categorie === c}
                onPress={() => onFiltre((f) => ({ ...f, categorie: f.categorie === c ? null : c }))}
              />
            ))
          )}
        </ScrollView>
      ) : null}

      <View style={styles.ligneTri}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onVue(VUES[(VUES.indexOf(vue) + 1) % VUES.length])}
          style={styles.boutonTri}
          hitSlop={8}
        >
          <Etiquette>{`${texts.wishlist.vue.intitule} · ${texts.wishlist.vue[vue]}`}</Etiquette>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onTri(tris[(tris.indexOf(tri) + 1) % tris.length])}
          style={styles.boutonTri}
          hitSlop={8}
        >
          <Etiquette>{`${texts.wishlist.tri.intitule} · ${libellesTri[tri]}`}</Etiquette>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filtres: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, marginTop: 22 },
  filtresTypes: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 },
  sousFiltres: { gap: 18 },
  aucuneCategorie: { alignSelf: 'center', paddingBottom: 4 },
  ligneTri: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  boutonTri: { minHeight: spacing.touchTarget, justifyContent: 'center' },
});
