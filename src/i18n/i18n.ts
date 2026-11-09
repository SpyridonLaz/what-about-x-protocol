import { DEFAULT_LOCALE, localeInfo } from './locales';
import { englishMessages, type Messages } from './messages';

export type { Messages };

const EN = englishMessages();

// Non-English locales are separate lazy chunks; only the active one is downloaded.
const loaders = import.meta.glob<Messages>('./messages/*.json', { import: 'default' });

let current = DEFAULT_LOCALE;
let active: Messages = {};
const listeners = new Set<() => void>();

export function locale(): string {
  return current;
}

/** Translate a key; falls back to English, then to the key itself. `{name}` placeholders are filled from vars. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = active[key] ?? EN[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function has(key: string): boolean {
  return key in active || key in EN;
}

/**
 * Upper-case for display labels. Greek capitals drop the tonos but keep the diaeresis
 * (CSS text-transform alone gets this wrong), and Turkish dotted/dotless i is respected.
 */
export function caps(s: string, loc: string = current): string {
  const up = s.toLocaleUpperCase(loc);
  if (loc !== 'el') return up;
  return up.normalize('NFD').replace(/́/g, '').normalize('NFC');
}

export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadMessages(code: string): Promise<Messages> {
  if (code === DEFAULT_LOCALE) return {};
  const load = loaders[`./messages/${code}.json`];
  if (!load) return {};
  try {
    return await load();
  } catch {
    return {};
  }
}

/** Switch the UI language: loads its messages, sets <html lang dir>, loads its font, notifies listeners. */
let requestSeq = 0;

export async function setLocale(code: string): Promise<void> {
  const info = localeInfo(code);
  const seq = ++requestSeq;
  const msgs = await loadMessages(info.code);
  if (seq !== requestSeq) return; // a newer switch started while this one was loading
  current = info.code;
  active = msgs;
  if (typeof document !== 'undefined') {
    const html = document.documentElement;
    html.lang = info.code;
    html.dir = info.dir;
  }
  listeners.forEach((fn) => fn());
}
