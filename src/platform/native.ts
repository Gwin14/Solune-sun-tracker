import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Widgets, Live Activities, App Intents and quick actions need native code that Expo Go
 * doesn't ship. Everything that touches them goes through these checks first, so the app
 * keeps running in Expo Go and those features simply stay hidden there.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const cache = new Map<string, boolean>();

export function hasNativeModule(name: string): boolean {
  if (isExpoGo || process.env.EXPO_OS === 'web') return false;
  const known = cache.get(name);
  if (known !== undefined) return known;
  let ok = false;
  try {
    ok = requireOptionalNativeModule(name) != null;
  } catch {
    ok = false;
  }
  cache.set(name, ok);
  return ok;
}

export const supportsWidgets = () => process.env.EXPO_OS === 'ios' && hasNativeModule('ExpoWidgets');
export const supportsAppIntents = () => process.env.EXPO_OS === 'ios' && hasNativeModule('ExpoAppIntents');
export const supportsQuickActions = () => hasNativeModule('ExpoQuickActions');
