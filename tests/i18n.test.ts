import { describe, expect, it } from 'vitest';
import { detectLocale, matchLocale } from '../src/i18n/detect';
import { caps, locale, onLocaleChange, setLocale, t } from '../src/i18n/i18n';
import { checkLocale, englishMessages, placeholders, protocolKeys } from '../src/i18n/messages';
import { EN_UI } from '../src/i18n/en';
import { PROTOCOLS } from '../src/protocols';
import el from '../src/i18n/messages/el.json';
import de from '../src/i18n/messages/de.json';

describe('matchLocale', () => {
  it.each([
    ['en', 'en'], ['en-US', 'en'], ['de-AT', 'de'], ['DE', 'de'], ['EL_gr', 'el'], ['el-GR', 'el'], ['  de-CH ', 'de'],
    ['fr', null], ['fr-FR', null], ['', null], [null, null], [undefined, null], ['-', null], ['deu', null],
  ])('%s -> %s', (tag, out) => {
    expect(matchLocale(tag as string | null | undefined)).toBe(out);
  });
});

describe('detectLocale', () => {
  it('saved supported code wins', () => expect(detectLocale('el', ['de'])).toBe('el'));
  it('unsupported saved is ignored', () => expect(detectLocale('xx', ['de-DE'])).toBe('de'));
  it('saved is not normalised (region tags are not codes)', () => expect(detectLocale('de-AT', [])).toBe('en'));
  it('first supported language wins, skipping unsupported', () => expect(detectLocale(null, ['fr', 'el-GR', 'de'])).toBe('el'));
  it('falls back to en', () => {
    expect(detectLocale(null, [])).toBe('en');
    expect(detectLocale(null, ['fr', 'ja'])).toBe('en');
    expect(detectLocale('', ['zz'])).toBe('en');
  });
});

describe('caps', () => {
  it('strips Greek tonos', () => expect(caps('Αναπαραγωγή', 'el')).toBe('ΑΝΑΠΑΡΑΓΩΓΗ'));
  it('keeps Greek diaeresis', () => expect(caps('προϊόν', 'el')).toBe('ΠΡΟΪΟΝ'));
  it('Greek: tonos+diaeresis keeps diaeresis only', () => expect(caps('ΐ', 'el')).toBe('Ϊ'));
  it('Greek: final sigma', () => expect(caps('ς', 'el')).toBe('Σ'));
  it('German sharp s', () => expect(caps('Straße', 'de')).toBe('STRASSE'));
  it('German umlauts kept', () => expect(caps('Übertragung ä', 'de')).toBe('ÜBERTRAGUNG Ä'));
  it('English', () => expect(caps('Play', 'en')).toBe('PLAY'));
  it('Turkish dotted i', () => expect(caps('iı', 'tr')).toBe('İI'));
  it('does not strip accents outside Greek', () => expect(caps('é', 'en')).toBe('É'));
  it('empty string', () => expect(caps('', 'el')).toBe(''));
});

describe('t', () => {
  it('returns the key when unknown', () => expect(t('no.such.key')).toBe('no.such.key'));
  it('returns English text for a known key', () => {
    const en = englishMessages();
    const k = Object.keys(en)[0];
    expect(t(k)).toBe(en[k]);
  });
  it('fills every {name} occurrence, numbers allowed', () => {
    // unknown keys return the key itself, so the key doubles as the template
    expect(t('a {x} b {x} {n}', { x: 'Q', n: 3 })).toBe('a Q b Q 3');
  });
  it('leaves unmatched placeholders intact', () => expect(t('hi {who}', { other: 1 })).toBe('hi {who}'));
});

describe('placeholders', () => {
  it('extracts and sorts', () => expect(placeholders('{b} x {a} {b}')).toEqual(['a', 'b', 'b']));
  it('none', () => expect(placeholders('plain')).toEqual([]));
});

describe('checkLocale', () => {
  const en = { a: 'Hello {n}', b: 'Bye' };
  it('clean', () => expect(checkLocale('xx', en, { a: 'Hallo {n}', b: 'Tschuess' })).toEqual([]));
  it('missing key', () => expect(checkLocale('xx', en, { a: 'Hallo {n}' })).toEqual(['[xx] missing "b"']));
  it('whitespace value counts as missing', () => {
    expect(checkLocale('xx', en, { a: 'Hallo {n}', b: '  ' })).toHaveLength(1);
  });
  it('non-string value counts as missing', () => {
    expect(checkLocale('xx', en, { a: 'Hallo {n}', b: 5 })).toHaveLength(1);
  });
  it('unknown key', () => {
    expect(checkLocale('xx', en, { a: 'A {n}', b: 'B', c: 'C' })).toEqual(['[xx] unknown key "c"']);
  });
  it('placeholder mismatch', () => {
    expect(checkLocale('xx', en, { a: 'Hallo {m}', b: 'B' })).toEqual(['[xx] placeholders differ in "a"']);
    expect(checkLocale('xx', en, { a: 'Hallo', b: 'B' })).toHaveLength(1);
  });
});

describe('message catalogues', () => {
  const en = englishMessages();
  it('English key count is UI keys plus flattened protocol keys', () => {
    const protoKeys = PROTOCOLS.flatMap((p) => Object.keys(protocolKeys(p)));
    expect(new Set(protoKeys).size).toBe(protoKeys.length);
    expect(Object.keys(en)).toHaveLength(Object.keys(EN_UI).length + protoKeys.length);
  });
  it('app.credit is absent everywhere', () => {
    for (const m of [en, el, de] as Record<string, string>[]) expect('app.credit' in m).toBe(false);
  });
  it('English contains flattened protocol keys', () => {
    const p = PROTOCOLS[0];
    expect(en[`p.${p.id}.name`]).toBe(p.text.name);
    expect(en[`p.${p.id}.s${p.text.stages.length}.d`]).toBe(p.text.stages[p.text.stages.length - 1][1]);
  });
  it('el passes checkLocale', () => expect(checkLocale('el', en, el)).toEqual([]));
  it('de passes checkLocale', () => expect(checkLocale('de', en, de)).toEqual([]));
  it('el and de have exactly the English key set', () => {
    expect(Object.keys(el).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });
});

describe('setLocale (jsdom)', () => {
  it('switches el -> de -> en, sets lang/dir, notifies, translates', async () => {
    let n = 0;
    const off = onLocaleChange(() => n++);
    await setLocale('el');
    expect(locale()).toBe('el');
    expect(document.documentElement.lang).toBe('el');
    expect(document.documentElement.dir).toBe('ltr');
    expect(n).toBe(1);
    const k = 'app.tagline';
    expect(t(k)).toBe((el as Record<string, string>)[k]);
    await setLocale('de');
    expect(t(k)).toBe((de as Record<string, string>)[k]);
    await setLocale('en');
    expect(document.documentElement.lang).toBe('en');
    expect(t(k)).toBe(englishMessages()[k]);
    off();
  });
  it('unknown locale falls back to en', async () => {
    await setLocale('zz');
    expect(locale()).toBe('en');
  });
  it('stale result is ignored when called twice quickly', async () => {
    const a = setLocale('el');
    const b = setLocale('de');
    await Promise.all([a, b]);
    expect(locale()).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    await setLocale('en');
  });
});
