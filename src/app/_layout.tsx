import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { preparerBase } from '@/db';
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
    <SQLiteProvider databaseName={settings.databaseName} onInit={preparerBase}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
    </SQLiteProvider>
  );
}
