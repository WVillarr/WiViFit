import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import en from './translations/en.json';
import es from './translations/es.json';

export const translations = { en, es };
export type SupportedLocale = keyof typeof translations;
export const supportedLocales = Object.keys(translations) as SupportedLocale[];
export const defaultLocale: SupportedLocale = 'es';

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = defaultLocale;

function resolveDeviceLocale(): SupportedLocale {
  const deviceLanguage = getLocales()[0]?.languageCode;
  return supportedLocales.find((locale) => locale === deviceLanguage) ?? defaultLocale;
}

i18n.locale = resolveDeviceLocale();
