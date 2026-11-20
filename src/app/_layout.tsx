import { useFonts } from 'expo-font';
import { router, Stack, useRootNavigationState } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { preparerBase } from '@/db';
import { trouverLien } from '@/domain/lien';
import { settings } from '@/domain/settings';
import { colors, fontFiles } from '@/theme';

// L'écran de démarrage reste affiché tant que les polices ne sont pas prêtes.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [policesPretes, erreurPolices] = useFonts(fontFiles);
  const pret = policesPretes || erreurPolices !== null;

  useEffect(() => {
    if (pret) SplashScreen.hideAsync();
  }, [pret]);

  if (!pret) return null;

  return (
    <ShareIntentProvider>
      <SQLiteProvider databaseName={settings.databaseName} onInit={preparerBase}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        />
        <RecepteurPartage />
      </SQLiteProvider>
    </ShareIntentProvider>
  );
}

/**
 * « Partager → ClosetA » depuis une appli ou un site de boutique : lance directement le parcours par lien
 * (docs/SPEC.md, « Partage Android »).
 */
function RecepteurPartage() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const navigationPrete = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (!navigationPrete || !hasShareIntent) return;
    const lien = trouverLien(shareIntent.webUrl) ?? trouverLien(shareIntent.text);
    resetShareIntent();
    if (lien) router.push({ pathname: '/formulaire', params: { lien } });
    else router.push({ pathname: '/lien', params: { partage: 'sans-lien' } });
  }, [navigationPrete, hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}
