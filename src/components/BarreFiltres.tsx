import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PRIORITES } from '@/domain/article';
import { resumeDuFiltre } from '@/domain/filtres';
import { texts } from '@/domain/texts';
import type { Filtre, Vue } from '@/domain/wishlist';
import { VUES } from '@/domain/wishlist';
import { colors, fonts, spacing } from '@/theme';

import { Etiquette } from './Etiquette';
import { Icone } from './Icone';

type SousMenu = 'priorite' | 'categorie' | null;

export type PropsBarreFiltres<T extends string> = {
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
  /** Panneau déplié ou non (partagé entre la barre dans la liste et sa copie collée en haut). */
  ouvert: boolean;
  onBasculer: () => void;
};

/**
 * Barre de filtres repliable, commune à la Wishlist et au Vestiaire
 * (DESIGN.md, « Barre de filtres » et « Panneau de filtres »).
 */
export function BarreFiltres<T extends string>(props: PropsBarreFiltres<T>) {
  const { filtre, onFiltre, avecPriorite, categories, tri, tris, libellesTri, onTri, vue, onVue, ouvert, onBasculer } =
    props;
  const [sousMenu, setSousMenu] = useState<SousMenu>(null);
  const f = texts.wishlist.filtres;

  return (
    <View style={styles.cadre}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ouvert ? texts.accessibilite.fermerFiltres : texts.accessibilite.ouvrirFiltres}
        accessibilityState={{ expanded: ouvert }}
        onPress={onBasculer}
        style={styles.barre}
      >
        <View style={styles.gauche}>
          <Icone nom="filtre" taille={18} />
          <Etiquette style={styles.resume} lignes={1}>
            {`${f.filtrer} · ${resumeDuFiltre(filtre)}`}
          </Etiquette>
        </View>
        <View style={styles.droite}>
          <Etiquette style={ouvert ? styles.actionFermer : undefined}>
            {ouvert ? f.fermer : libellesTri[tri]}
          </Etiquette>
          <Icone
            nom={ouvert ? 'basculeHaut' : 'basculeBas'}
            taille={16}
            couleur={ouvert ? colors.ink : colors.inkMuted}
          />
        </View>
      </Pressable>

      {ouvert ? (
        <View style={styles.panneau}>
          <Rubrique libelle={f.rubriques.pieces}>
            <Choix
              libelle={f.tout}
              actif={filtre.type === null}
              onPress={() => onFiltre((x) => ({ ...x, type: null }))}
            />
            <Choix
              libelle={f.vetements}
              actif={filtre.type === 'vetement'}
              onPress={() => onFiltre((x) => ({ ...x, type: 'vetement' }))}
            />
            <Choix
              libelle={f.chaussures}
              actif={filtre.type === 'chaussures'}
              onPress={() => onFiltre((x) => ({ ...x, type: 'chaussures' }))}
            />
          </Rubrique>

          <Rubrique libelle={f.rubriques.choix}>
            {avecPriorite ? (
              <Choix
                libelle={filtre.priorite ? texts.priorites[filtre.priorite] : f.priorite}
                actif={filtre.priorite !== null}
                souligne={sousMenu === 'priorite'}
                onPress={() => setSousMenu(sousMenu === 'priorite' ? null : 'priorite')}
              />
            ) : null}
            <Choix
              libelle={filtre.categorie ?? f.categorie}
              actif={filtre.categorie !== null}
              souligne={sousMenu === 'categorie'}
              onPress={() => setSousMenu(sousMenu === 'categorie' ? null : 'categorie')}
            />
          </Rubrique>

          {avecPriorite && sousMenu === 'priorite' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousChoix}>
              {PRIORITES.map((p) => (
                <Choix
                  key={p}
                  libelle={texts.priorites[p]}
                  actif={filtre.priorite === p}
                  onPress={() =>
                    onFiltre((x) => ({
                      ...x,
                      priorite: x.priorite === p ? null : p,
                    }))
                  }
                />
              ))}
            </ScrollView>
          ) : null}

          {sousMenu === 'categorie' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousChoix}>
              {categories.length === 0 ? (
                <Etiquette style={styles.aucuneCategorie}>{f.aucuneCategorie}</Etiquette>
              ) : (
                categories.map((c) => (
                  <Choix
                    key={c}
                    libelle={c}
                    actif={filtre.categorie === c}
                    onPress={() =>
                      onFiltre((x) => ({
                        ...x,
                        categorie: x.categorie === c ? null : c,
                      }))
                    }
                  />
                ))
              )}
            </ScrollView>
          ) : null}

          <Rubrique libelle={f.rubriques.vue}>
            {VUES.map((v) => (
              <Choix key={v} libelle={texts.wishlist.vue[v]} actif={vue === v} onPress={() => onVue(v)} />
            ))}
          </Rubrique>

          <Rubrique libelle={f.rubriques.tri}>
            {tris.map((t) => (
              <Choix key={t} libelle={libellesTri[t]} actif={tri === t} onPress={() => onTri(t)} />
            ))}
          </Rubrique>
        </View>
      ) : null}
    </View>
  );
}

/** Une ligne du panneau : la rubrique en italique, puis ses choix. */
function Rubrique({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <View style={styles.rubrique}>
      <Text style={styles.titreRubrique}>{libelle}</Text>
      <View style={styles.choix}>{children}</View>
    </View>
  );
}

/** Un choix : actif = sélection pleine (fond ink, texte paper) ; souligné = sa liste est ouverte. */
function Choix({
  libelle,
  actif,
  souligne,
  onPress,
}: {
  libelle: string;
  actif: boolean;
  souligne?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      onPress={onPress}
      style={styles.zoneChoix}
    >
      <View style={[styles.pastille, actif && styles.pastillePleine, souligne && !actif && styles.pastilleSoulignee]}>
        <Etiquette style={actif ? styles.textePlein : undefined}>{libelle}</Etiquette>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cadre: {
    borderTopWidth: spacing.hairline,
    borderBottomWidth: spacing.hairline,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  barre: {
    minHeight: spacing.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  gauche: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  resume: { color: colors.ink, flexShrink: 1 },
  droite: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  actionFermer: { color: colors.ink },
  panneau: { paddingTop: 4, paddingBottom: 10 },
  rubrique: { flexDirection: 'row', alignItems: 'center' },
  titreRubrique: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: colors.inkMuted,
    width: 62,
  },
  choix: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1 },
  sousChoix: { paddingLeft: 62 },
  zoneChoix: { minHeight: spacing.touchTarget, justifyContent: 'center' },
  pastille: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: spacing.hairline,
    borderBottomColor: 'transparent',
  },
  pastillePleine: { backgroundColor: colors.ink },
  pastilleSoulignee: { borderBottomColor: colors.ink },
  textePlein: { color: colors.paper },
  aucuneCategorie: { alignSelf: 'center', paddingHorizontal: 10 },
});
