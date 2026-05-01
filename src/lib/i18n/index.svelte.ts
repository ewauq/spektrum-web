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
  // Tracks whether the current value comes from a user choice (settings
  // modal) rather than the auto-detected default. Persistence layers
  // should only restore an explicit value, otherwise the freshly
  // detected browser language wins on every visit.
  let explicit = $state(false);

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
      if (SUPPORTED_LOCALES.includes(v)) {
        locale = v;
        explicit = true;
      }
    },
    get explicit() {
      return explicit;
    },
    /** Restore a persisted locale without flipping the explicit flag. */
    setFromPersist(v: Locale): void {
      if (SUPPORTED_LOCALES.includes(v)) {
        locale = v;
        explicit = true;
      }
    },
    get locales() {
      return SUPPORTED_LOCALES;
    },
    t
  };
}

export const i18n = createI18n();
export const t = i18n.t;
