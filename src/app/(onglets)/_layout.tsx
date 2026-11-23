import { Tabs } from 'expo-router/js-tabs';

import { BarreOnglets } from '@/components/BarreOnglets';
import { MenuLateral } from '@/components/MenuLateral';
import { texts } from '@/domain/texts';
import { colors } from '@/theme';

/**
 * Les deux onglets, Wishlist et Vestiaire, avec la barre en bas et le menu qui glisse depuis la gauche
 * (docs/SPEC.md, « Lot 3 », « Étape 5 — Navigation par onglets »). Le retour Android ramène à la Wishlist.
 */
export default function LayoutOnglets() {
  return (
    <MenuLateral>
      <Tabs
        backBehavior="firstRoute"
        tabBar={(props) => <BarreOnglets {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
      >
        <Tabs.Screen name="index" options={{ title: texts.ecrans.wishlist }} />
        <Tabs.Screen name="vestiaire" options={{ title: texts.ecrans.vestiaire }} />
      </Tabs>
    </MenuLateral>
  );
}
