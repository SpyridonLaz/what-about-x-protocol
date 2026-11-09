import { DEFAULT_LOCALE, LOCALES } from './locales';

const SUPPORTED = new Set(LOCALES.map((l) => l.code));

/** Map one BCP 47 tag (e.g. "de-AT", "el_GR", "en-US") to a supported locale, or null. */
export function matchLocale(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const base = tag.trim().replace(/_/g, '-').toLowerCase().split('-')[0];
  return base && SUPPORTED.has(base) ? base : null;
}

/**
 * Pick the UI locale: a saved choice wins, then the first supported entry of the
 * browser/system languages, then English.
 */
export function detectLocale(saved: string | null, languages: readonly string[]): string {
  if (saved && SUPPORTED.has(saved)) return saved;
  for (const tag of languages) {
    const hit = matchLocale(tag);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}
