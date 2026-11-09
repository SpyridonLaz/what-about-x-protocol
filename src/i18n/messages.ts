// English reference messages (no Vite-only APIs, so scripts and tests can import it).
import { PROTOCOLS } from '../protocols';
import type { Protocol } from '../protocols/types';
import { EN_UI } from './en';

export type Messages = Record<string, string>;

/** Flatten a protocol's English text into p.<id>.* keys. */
export function protocolKeys(p: Protocol): Messages {
  const out: Messages = {
    [`p.${p.id}.name`]: p.text.name,
    [`p.${p.id}.desc`]: p.text.desc,
    [`p.${p.id}.format`]: p.text.format,
  };
  p.text.stages.forEach(([title, sub], i) => {
    out[`p.${p.id}.s${i + 1}.t`] = title;
    out[`p.${p.id}.s${i + 1}.d`] = sub;
  });
  return out;
}

/** Every English key: UI strings + all protocol texts. The reference for translations. */
export function englishMessages(): Messages {
  const all: Messages = { ...EN_UI };
  for (const p of PROTOCOLS) Object.assign(all, protocolKeys(p));
  return all;
}

/** Placeholders like {n} used in a string, sorted. */
export function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/** Compare one locale's messages with English: missing/empty keys, unknown keys, placeholder mismatches. */
export function checkLocale(code: string, en: Messages, data: Record<string, unknown>): string[] {
  const errs: string[] = [];
  for (const [k, v] of Object.entries(en)) {
    const tr = data[k];
    if (typeof tr !== 'string' || !tr.trim()) {
      errs.push(`[${code}] missing "${k}"`);
      continue;
    }
    if (placeholders(v).join() !== placeholders(tr).join()) errs.push(`[${code}] placeholders differ in "${k}"`);
  }
  for (const k of Object.keys(data)) if (!(k in en)) errs.push(`[${code}] unknown key "${k}"`);
  return errs;
}
