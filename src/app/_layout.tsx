import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useLocales } from 'expo-localization';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { resolveLanguage, useLanguage } from '@/i18n';
import { refreshCurrentLocation } from '@/lib/location';
import { rescheduleNotifications } from '@/lib/notifications';
import { configurePurchases, usePro } from '@/lib/purchases';
import { useApp } from '@/store/app';
import { useLaunch } from '@/store/launch';
import { colors } from '@/theme/tokens';
import { scheduleWidgetSync } from '@/widgets/sync';

SplashScreen.preventAutoHideAsync().catch(() => {});
// The launch mark dissolves into colors.ink, the splash's own background, so only the mark moves.
const SPLASH_FADE = 350;
SplashScreen.setOptions({ fade: true, duration: SPLASH_FADE });

export const unstable_settings = { anchor: '(tabs)' };

const queryClient = new QueryClient();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ink, card: colors.inkSheet, primary: colors.accent, text: colors.text, border: colors.hairline },
};

function usePersisted(store: { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } }) {
  const [done, setDone] = useState(() => store.persist.hasHydrated());
  useEffect(() => {
    return store.persist.onFinishHydration(() => setDone(true));
  }, [store]);
  return done;
}

/**
 * The language in effect: the user's pick, or the device's in automatic mode (useLocales
 * re-renders when the system language changes while the app runs, as on Android).
 */
function useActiveLanguage() {
  const pref = useLanguage((s) => s.pref);
  const locales = useLocales();
  const lang = resolveLanguage(pref);
  // Reminders and widgets carry text too: rebuild them when the language changes.
  const previous = useRef(lang);
  useEffect(() => {
    if (previous.current === lang) return;
    previous.current = lang;
    if (useApp.getState().hasOnboarded) rescheduleNotifications();
  }, [lang, locales]);
  return lang;
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
  const appReady = usePersisted(useApp);
  const languageReady = usePersisted(useLanguage);
  const proReady = usePersisted(usePro);
  const lang = useActiveLanguage();
  const hasOnboarded = useApp((s) => s.hasOnboarded);
  const ready = appReady && languageReady && proReady;

  useEffect(() => {
    if (!ready) return;
    // Pro unlocks widgets and extra reminders: rebuild both whenever it changes.
    configurePurchases(() => {
      scheduleWidgetSync();
      if (useApp.getState().hasOnboarded) rescheduleNotifications();
    });
    // Entrances start once the launch screen has actually left.
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => setTimeout(() => useLaunch.getState().reveal(), SPLASH_FADE));
    if (useApp.getState().hasOnboarded) {
      refreshCurrentLocation().finally(() => rescheduleNotifications());
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          {/* Keyed by language: every screen re-renders its text, including memoized parts. */}
          <Stack key={lang} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
            <Stack.Protected guard={hasOnboarded}>
              <Stack.Screen name="(tabs)" />
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
                name="object/[id]"
                options={{
                  headerShown: true,
                  headerTransparent: true,
                  title: '',
                  headerBackButtonDisplayMode: 'minimal',
                  headerTintColor: colors.text,
                }}
              />
              <Stack.Screen name="paywall" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.inkSheet } }} />
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
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
