import { translations, type Locale } from './translations';

const SUPPORTED_LOCALES: Locale[] = ['fr', 'en'];
const DEFAULT_LOCALE: Locale = 'en';

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const lang = navigator.language?.slice(0, 2);
  return SUPPORTED_LOCALES.includes(lang as Locale) ? (lang as Locale) : DEFAULT_LOCALE;
}

function createI18n() {
  let locale = $state<Locale>(detectLocale());

  function t(key: string, params?: Record<string, string | number>): string {
    const str = translations[locale]?.[key] ?? translations[DEFAULT_LOCALE]?.[key] ?? key;
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  }

  return {
    get locale() {
      return locale;
    },
    set locale(v: Locale) {
      if (SUPPORTED_LOCALES.includes(v)) locale = v;
    },
    get locales() {
      return SUPPORTED_LOCALES;
    },
    t
  };
}

export const i18n = createI18n();
export const t = i18n.t;
