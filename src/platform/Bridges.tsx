import * as AppIntents from 'expo-app-intents';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { selectPlace, useApp } from '@/store/app';
import { skyCatalogEntity } from '@/widgets/data';
import { reconcileSkyMoments, scheduleWidgetSync, startSkyMoment, type SkyMomentKind } from '@/widgets/sync';

import { supportsAppIntents, supportsQuickActions, supportsWidgets } from './native';

const MOMENTS: SkyMomentKind[] = ['golden', 'sunset', 'sunrise'];
const ROUTES = ['/', '/moon', '/sky', '/events', '/journal'];

/** Keeps widgets current: on launch, on return to the app, and whenever what they show changes. */
function WidgetSync() {
  useEffect(() => {
    scheduleWidgetSync(0);
    reconcileSkyMoments();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        scheduleWidgetSync();
        reconcileSkyMoments();
      }
    });
    const store = useApp.subscribe((s, prev) => {
      if (selectPlace(s) !== selectPlace(prev) || s.use24h !== prev.use24h || s.checkIns !== prev.checkIns || s.xp !== prev.xp) {
        scheduleWidgetSync();
      }
    });
    return () => {
      app.remove();
      store();
    };
  }, []);
  return null;
}

/** Home Screen long-press menu. "Acompanhar" starts the Live Activity without navigating. */
function QuickActionsBridge({ live }: { live: boolean }) {
  useEffect(() => {
    QuickActions.setItems([
      { id: 'sky', title: 'Céu agora', subtitle: 'Sol e lua pela câmera', icon: 'symbol:camera.viewfinder', params: { href: '/sky' } },
      { id: 'moon', title: 'Lua de hoje', icon: 'symbol:moonphase.waxing.gibbous', params: { href: '/moon' } },
      { id: 'journal', title: 'Registrar o céu', icon: 'symbol:book.closed', params: { href: '/journal' } },
      ...(live ? [{ id: 'track', title: 'Acompanhar hora dourada', subtitle: 'Na Tela Bloqueada', icon: 'symbol:sun.horizon', params: { href: '/' } }] : []),
    ]).catch(() => {});
  }, [live]);
  useQuickActionRouting((action) => {
    if (action.id === 'track') startSkyMoment('golden');
  });
  return null;
}

/** Publishes the sky Siri answers from, and carries out the intents that open the app. */
function AppIntentsBridge() {
  const place = useApp(selectPlace);
  useEffect(() => {
    AppIntents.setEntityCatalogAsync('sky', [skyCatalogEntity(place, new Date())]).catch(() => {});
  }, [place]);

  AppIntents.useAppIntents(async (pending) => {
    for (const intent of pending) {
      try {
        if (intent.name === 'open') {
          const href = intent.params.href;
          if (typeof href === 'string' && ROUTES.includes(href)) router.navigate(href as Href, { withAnchor: true });
        } else if (intent.name === 'track') {
          const kind = intent.params.kind as SkyMomentKind;
          router.navigate('/');
          if (MOMENTS.includes(kind)) await startSkyMoment(kind);
        }
        // Unknown names come from a newer or older binary; nothing to do but drop them.
        await AppIntents.removePendingInvocationAsync(intent.id);
      } catch (e) {
        if (__DEV__) console.warn('[intents] kept pending', intent.id, e);
      }
    }
  });
  return null;
}

/**
 * The app's presence outside itself — widgets, Live Activities, Home Screen quick actions and
 * Siri. Each piece mounts only where its native module exists, so Expo Go runs none of it.
 * Lives in the tabs layout: quick actions and intents navigate.
 */
export function PlatformBridges() {
  const widgets = supportsWidgets();
  return (
    <>
      {widgets ? <WidgetSync /> : null}
      {supportsQuickActions() ? <QuickActionsBridge live={widgets} /> : null}
      {supportsAppIntents() ? <AppIntentsBridge /> : null}
    </>
  );
}
