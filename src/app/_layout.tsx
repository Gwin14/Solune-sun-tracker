import {
  Manrope_200ExtraLight,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { refreshCurrentLocation } from '@/lib/location';
import { rescheduleNotifications } from '@/lib/notifications';
import { useApp } from '@/store/app';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: '(tabs)' };

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ink, card: colors.inkSheet, primary: colors.accent, text: colors.text, border: colors.hairline },
};

function useHydrated() {
  const [done, setDone] = useState(() => useApp.persist.hasHydrated());
  useEffect(() => {
    return useApp.persist.onFinishHydration(() => setDone(true));
  }, []);
  return done;
}

/** Pushes the badge celebration whenever something new unlocks. */
function CelebrationWatcher() {
  const queue = useApp((s) => s.celebrationQueue);
  const onboarded = useApp((s) => s.hasOnboarded);
  const pathname = usePathname();
  useEffect(() => {
    if (!onboarded || !queue.length || pathname === '/celebrate' || pathname === '/onboarding') return;
    const t = setTimeout(() => router.push('/celebrate'), 450);
    return () => clearTimeout(t);
  }, [queue, onboarded, pathname]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_200ExtraLight,
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const hydrated = useHydrated();
  const hasOnboarded = useApp((s) => s.hasOnboarded);
  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    if (useApp.getState().hasOnboarded) {
      refreshCurrentLocation().finally(() => rescheduleNotifications());
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
          <Stack.Protected guard={hasOnboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="ar" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="settings" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.inkSheet } }} />
            <Stack.Screen
              name="locations"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 28,
                contentStyle: { backgroundColor: colors.inkSheet },
              }}
            />
            <Stack.Screen
              name="celebrate"
              options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!hasOnboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
        </Stack>
        <CelebrationWatcher />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
