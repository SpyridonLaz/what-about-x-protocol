export interface LocaleInfo {
  code: string;
  /** Short badge shown in the picker. */
  badge: string;
  /** Name in its own language. */
  native: string;
  /** Name in English. */
  english: string;
  dir: 'ltr' | 'rtl';
  /** Google Fonts family to load for scripts the system font may lack. */
  font?: string;
}

// Supported UI languages (user decision 2026-11-09: English, Greek, German).
// Adding one = an entry here + src/i18n/messages/<code>.json (checked by `npm run check`).
export const LOCALES: LocaleInfo[] = [
  { code: 'en', badge: 'EN', native: 'English', english: 'English', dir: 'ltr' },
  { code: 'el', badge: 'EL', native: 'Ελληνικά', english: 'Greek', dir: 'ltr' },
  { code: 'de', badge: 'DE', native: 'Deutsch', english: 'German', dir: 'ltr' },
];

export const DEFAULT_LOCALE = 'en';

export function localeInfo(code: string): LocaleInfo {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
