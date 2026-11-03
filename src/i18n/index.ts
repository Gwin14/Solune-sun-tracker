import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { pt, type Strings } from './locales/pt';

export type { Strings };

export type Language = 'en' | 'pt' | 'es' | 'fr' | 'de';
/** What the user picked in Settings; "auto" follows the device. */
export type LanguagePref = Language | 'auto';

export const LANGUAGES: { id: Language; native: string; tag: string }[] = [
  { id: 'en', native: 'English', tag: 'en-US' },
  { id: 'pt', native: 'Português (Brasil)', tag: 'pt-BR' },
  { id: 'es', native: 'Español', tag: 'es-ES' },
  { id: 'fr', native: 'Français', tag: 'fr-FR' },
  { id: 'de', native: 'Deutsch', tag: 'de-DE' },
];

const DICTS: Record<Language, Strings> = { en, pt, es, fr, de };
const FALLBACK: Language = 'en';

/** The first device language the app speaks, in the order the user ranks them. */
export function deviceLanguage(): Language {
  try {
    for (const l of getLocales()) {
      const code = l.languageCode?.toLowerCase();
      if (code && code in DICTS) return code as Language;
    }
  } catch {
    // No locale info (tests, odd web hosts): fall through.
  }
  return FALLBACK;
}

type LanguageState = { pref: LanguagePref; setPref: (p: LanguagePref) => void };

export const useLanguage = create<LanguageState>()(
  persist((set) => ({ pref: 'auto', setPref: (pref) => set({ pref }) }), {
    name: 'solune-language',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export function resolveLanguage(pref: LanguagePref = useLanguage.getState().pref): Language {
  return pref === 'auto' ? deviceLanguage() : pref;
}

/** The active language. Read at call time, so code outside React stays current too. */
export function language(): Language {
  return resolveLanguage();
}

/** BCP 47 tag for Intl and native APIs, e.g. "pt-BR". */
export function localeTag(lang: Language = language()): string {
  return LANGUAGES.find((l) => l.id === lang)!.tag;
}

/** The active dictionary, for code outside components (formatters, notifications, widgets). */
export function strings(): Strings {
  return DICTS[language()];
}

/** The active dictionary for a component; re-renders when the language changes. */
export function useT(): Strings {
  const pref = useLanguage((s) => s.pref);
  return DICTS[resolveLanguage(pref)];
}

/**
 * A table that always reads from the active language, for exported constants such as
 * month names: `MONTHS[i]` keeps working at every call site without passing a language.
 */
export function localized<T extends object>(pick: (s: Strings) => T): T {
  const base = pick(pt);
  const out = (Array.isArray(base) ? new Array(base.length) : {}) as T;
  for (const k of Object.keys(base)) {
    Object.defineProperty(out, k, { get: () => (pick(strings()) as Record<string, unknown>)[k], enumerable: true });
  }
  return out;
}
