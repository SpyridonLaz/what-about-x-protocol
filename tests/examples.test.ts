import { describe, expect, it } from 'vitest';
import { EXAMPLES, exampleFor, sceneAt, validateExample, type Example } from '../src/examples';
import { AI_EXAMPLES } from '../src/examples/ai';
import { highlight } from '../src/examples/highlight';
import { PROTOCOLS, byId } from '../src/protocols';
import { validateAll, validateProtocol } from '../src/protocols/validate';
import { protocolKeys } from '../src/i18n/messages';
import { EN_UI } from '../src/i18n/en';
import type { Protocol } from '../src/protocols/types';
import de from '../src/i18n/messages/de.json';
import el from '../src/i18n/messages/el.json';

const AI_IDS = ['mcp', 'a2a', 'llm-api', 'rag', 'agent-loop', 'multi-agent', 'llm-inside'];
const clone = <T>(x: T): T => structuredClone(x);
const mini = (scene: Example['scene']): Example => ({ app: 'x', scene, wire: [] });

describe('catalogue with AI entries', () => {
  it('has 40 protocols, 7 of them AI', () => {
    expect(PROTOCOLS).toHaveLength(40);
    expect(PROTOCOLS.filter((p) => p.family === 'ai').map((p) => p.id).sort()).toEqual([...AI_IDS].sort());
  });
  it('passes validateAll (including examples)', () => expect(validateAll(PROTOCOLS)).toEqual([]));
  it('examples exist for exactly the AI ids', () => expect(Object.keys(AI_EXAMPLES).sort()).toEqual([...AI_IDS].sort()));
  it('only llm-inside is local', () => expect(PROTOCOLS.filter((p) => p.local).map((p) => p.id)).toEqual(['llm-inside']));
  it.each(AI_IDS)('%s has one note per packet, 3 ideas and a wire message per packet', (id) => {
    const p = byId(id)!;
    expect(p.text.notes).toHaveLength(p.packets.length);
    expect(p.text.ideas).toHaveLength(3);
    expect(exampleFor(p)!.wire).toHaveLength(p.packets.length);
  });
  it('agent-loop, multi-agent and llm-inside have 20, 10 and 11 packets', () => {
    expect(byId('agent-loop')!.packets).toHaveLength(20);
    expect(byId('multi-agent')!.packets).toHaveLength(10);
    expect(byId('llm-inside')!.packets).toHaveLength(11);
  });
  it('non-AI entries have no example, notes, ideas or zones', () => {
    for (const p of PROTOCOLS.filter((q) => q.family !== 'ai')) {
      expect(exampleFor(p), p.id).toBeUndefined();
      expect(p.text.notes, p.id).toBeUndefined();
      expect(p.text.ideas, p.id).toBeUndefined();
      expect(p.zones, p.id).toBeUndefined();
      expect(p.local, p.id).toBeFalsy();
    }
  });
  it('zones exist on mcp and llm-api', () => {
    expect(byId('mcp')!.zones?.length).toBeGreaterThan(0);
    expect(byId('llm-api')!.zones?.length).toBeGreaterThan(0);
  });
});

describe('exampleFor', () => {
  it('returns the example of an AI entry', () => expect(exampleFor(byId('mcp')!)).toBe(EXAMPLES.mcp));
  it('returns undefined for http', () => expect(exampleFor(byId('http')!)).toBeUndefined());
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf'])('is not fooled by prototype key %s', (id) => {
    expect(exampleFor({ ...clone(byId('http')!), id })).toBeUndefined();
  });
});

describe('example content agrees with the scenario', () => {
  it.each(AI_IDS)('%s: wire bodies and scene are non-empty', (id) => {
    const ex = exampleFor(byId(id)!)!;
    expect(ex.app.trim()).not.toBe('');
    ex.wire.forEach((m) => expect(m.body.trim()).not.toBe(''));
    expect(ex.scene.length).toBeGreaterThan(0);
  });
  it.each(AI_IDS)('%s: wire bodies have no leading or trailing blank lines', (id) => {
    for (const m of exampleFor(byId(id)!)!.wire) expect(m.body).toBe(m.body.trim());
  });
  it.each(AI_IDS)('%s: example names resolve to existing UI strings', (id) => {
    const names = exampleFor(byId(id)!)!.names;
    for (const k of [names?.user, names?.assistant]) if (k) expect(k in EN_UI, k).toBe(true);
  });
  it('mcp: the first request is server/discover and the tool call names get_forecast', () => {
    const w = EXAMPLES.mcp.wire;
    expect(w[0].body).toContain('"method": "server/discover"');
    expect(w[0].body).toContain('Mcp-Method: server/discover');
    expect(w[1].body).toContain('401');
    expect(w.some((m) => m.body.includes('tools/call') && m.body.includes('get_forecast') && m.body.includes('Athens'))).toBe(true);
  });
  it('llm-api: the tool name and city are consistent over the whole run', () => {
    const w = EXAMPLES['llm-api'].wire.map((m) => m.body).join('\n');
    expect(w).toContain('get_weather');
    expect(w).toContain('Athens');
    expect(w).toContain('tool_use_id');
    expect(w).toContain('24');
  });
  it('llm-api: SSE messages use the sse or http language, not json', () => {
    for (const m of EXAMPLES['llm-api'].wire) if (m.body.includes('event: ')) expect(['sse', 'http']).toContain(m.lang);
  });
  it('rag: the final answer in the scene appears in the model request or response', () => {
    const w = EXAMPLES.rag.wire.map((m) => m.body).join('\n');
    expect(w).toContain('25 vacation days');
  });
  it('multi-agent: scene budget numbers match the wire', () => {
    const w = EXAMPLES['multi-agent'].wire.map((m) => m.body).join('\n');
    for (const v of ['6,000', '2,900', '2,350']) expect(w, v).toContain(v);
  });
  it('llm-inside: token ids from the packet info appear in the wire', () => {
    const w = EXAMPLES['llm-inside'].wire.map((m) => m.body).join('\n');
    for (const id of ['464', '3139', '286', '10315', '318']) expect(w).toContain(id);
    expect(w).toContain('Athens');
  });
  it('a2a: scene task id matches the wire', () => {
    const w = EXAMPLES.a2a.wire.map((m) => m.body).join('\n');
    expect(w).toContain('7f3c');
  });
});

describe('validateExample', () => {
  const p = byId('llm-api')!;
  const ok = () => clone(EXAMPLES['llm-api']);
  const has = (ex: Example, re: RegExp) => validateExample(p, ex).some((e) => re.test(e));
  it('baseline is clean', () => expect(validateExample(p, ok())).toEqual([]));
  it('wire shorter than packets', () => {
    const ex = ok();
    ex.wire.pop();
    expect(has(ex, /wire messages for/)).toBe(true);
  });
  it('wire longer than packets', () => {
    const ex = ok();
    ex.wire.push(ex.wire[0]);
    expect(has(ex, /wire messages for/)).toBe(true);
  });
  it('empty wire body', () => {
    const ex = ok();
    ex.wire[2].body = '  \n ';
    expect(has(ex, /wire message 3 is empty/)).toBe(true);
  });
  it('scene event beyond the last packet', () => {
    const ex = ok();
    ex.scene[0].at = p.packets.length;
    expect(has(ex, /does not exist/)).toBe(true);
  });
  it('negative scene position', () => {
    const ex = ok();
    ex.scene[0].at = -1;
    expect(has(ex, /does not exist/)).toBe(true);
  });
  it('non-integer scene position', () => {
    const ex = ok();
    ex.scene[0].at = 1.5;
    expect(has(ex, /does not exist/)).toBe(true);
  });
  it('NaN scene position', () => {
    const ex = ok();
    ex.scene[0].at = NaN;
    expect(has(ex, /does not exist/)).toBe(true);
  });
  it('scene going back in time', () => {
    const ex = ok();
    ex.scene[1].at = 0;
    ex.scene[0].at = 2;
    expect(has(ex, /back in time/)).toBe(true);
  });
  it('empty scene', () => expect(has({ ...ok(), scene: [] }, /scene is empty/)).toBe(true));
  it('empty text', () => {
    const ex = ok();
    ex.scene[0].text = '   ';
    expect(has(ex, /event 1 is empty/)).toBe(true);
  });
  it('empty app title', () => expect(has({ ...ok(), app: ' ' }, /missing app title/)).toBe(true));
  it('events at the same packet are allowed', () => {
    const ex = mini([{ at: 0, role: 'user', text: 'a' }, { at: 0, role: 'assistant', text: 'b' }]);
    ex.wire = p.packets.map(() => ({ lang: 'text' as const, body: 'x' }));
    expect(validateExample(p, ex)).toEqual([]);
  });
});

describe('validateAll with examples', () => {
  it('reports an example whose id is not a protocol', () => {
    const list = PROTOCOLS.filter((p) => p.id !== 'rag');
    expect(validateAll(list).some((e) => /\[rag\].*unknown protocol/.test(e))).toBe(true);
  });
  it('reports a broken example of a listed protocol', () => {
    const p = clone(byId('mcp')!);
    p.packets.pop();
    expect(validateAll([p]).some((e) => /\[mcp\].*wire messages/.test(e))).toBe(true);
  });
});

describe('validateProtocol: notes, ideas, zones', () => {
  const base = byId('mcp')!;
  const has = (p: Protocol, re: RegExp) => validateProtocol(p).some((e) => re.test(e));
  it('baseline is clean', () => expect(validateProtocol(base)).toEqual([]));
  it('too few notes', () => {
    const p = clone(base);
    p.text.notes!.pop();
    expect(has(p, /notes for \d+ packets/)).toBe(true);
  });
  it('too many notes', () => {
    const p = clone(base);
    p.text.notes!.push('extra');
    expect(has(p, /notes for \d+ packets/)).toBe(true);
  });
  it('empty note', () => {
    const p = clone(base);
    p.text.notes![2] = '  ';
    expect(has(p, /note 3 is empty/)).toBe(true);
  });
  it('empty idea', () => {
    const p = clone(base);
    p.text.ideas![1] = '';
    expect(has(p, /key idea 2 is empty/)).toBe(true);
  });
  it('zone with unknown label string', () => {
    const p = clone(base);
    p.zones![0].label = 'nonexistent-zone';
    expect(has(p, /zone\.nonexistent-zone/)).toBe(true);
  });
  it('zone with no nodes', () => {
    const p = clone(base);
    p.zones![0].nodes = [];
    expect(has(p, /has no nodes/)).toBe(true);
  });
  it('zone referencing a missing node', () => {
    const p = clone(base);
    p.zones![0].nodes.push('ghost');
    expect(has(p, /missing node "ghost"/)).toBe(true);
  });
  it('a protocol without notes, ideas or zones is fine', () => {
    const p = clone(base);
    delete p.text.notes;
    delete p.text.ideas;
    delete p.zones;
    expect(validateProtocol(p)).toEqual([]);
  });
});

describe('protocolKeys: notes and ideas', () => {
  it.each(AI_IDS)('%s emits m<n> and k<n> keys, 1-based, with the English text', (id) => {
    const p = byId(id)!;
    const k = protocolKeys(p);
    p.text.notes!.forEach((n, i) => expect(k[`p.${id}.m${i + 1}`]).toBe(n));
    p.text.ideas!.forEach((n, i) => expect(k[`p.${id}.k${i + 1}`]).toBe(n));
    expect(k[`p.${id}.m0`]).toBeUndefined();
    expect(k[`p.${id}.m${p.packets.length + 1}`]).toBeUndefined();
    expect(k[`p.${id}.k4`]).toBeUndefined();
  });
  it('http emits no m/k keys', () => {
    expect(Object.keys(protocolKeys(byId('http')!)).filter((x) => /\.[mk]\d+$/.test(x))).toEqual([]);
  });
  it.each(AI_IDS)('%s: de and el contain every m/k key with non-empty text', (id) => {
    for (const k of Object.keys(protocolKeys(byId(id)!)).filter((x) => /\.[mk]\d+$/.test(x))) {
      expect(((de as Record<string, string>)[k] ?? '').trim(), `de ${k}`).not.toBe('');
      expect(((el as Record<string, string>)[k] ?? '').trim(), `el ${k}`).not.toBe('');
    }
  });
});

describe('sceneAt', () => {
  const ex = mini([
    { at: 0, role: 'user', text: 'hello world' },
    { at: 2, role: 'status', text: 'thinking' },
    { at: 4, role: 'assistant', text: ' Athens' },
    { at: 6, role: 'assistant', text: ' Athens.', replace: true },
  ]);
  it('focus -1 shows nothing', () => expect(sceneAt(ex, -1)).toEqual([]));
  it('focus 0 shows the first item, live', () => expect(sceneAt(ex, 0)).toEqual([{ role: 'user', text: 'hello world', live: true }]));
  it('items before the focus are not live', () => {
    const s = sceneAt(ex, 1);
    expect(s).toHaveLength(1);
    expect(s[0].live).toBe(false);
  });
  it('only the item at the focus is live', () => {
    const s = sceneAt(ex, 2);
    expect(s.map((i) => i.live)).toEqual([false, true]);
  });
  it('focus beyond the last shows everything, nothing live', () => {
    const s = sceneAt(ex, 99);
    expect(s.map((i) => i.live)).toEqual([false, false, false]);
    expect(s[2].text).toBe(' Athens.');
  });
  it('keeps scene order', () => expect(sceneAt(ex, 4).map((i) => i.role)).toEqual(['user', 'status', 'assistant']));
  it('progress 0 shows an empty live text', () => expect(sceneAt(ex, 0, 0)[0].text).toBe(''));
  it('progress 0.5 cuts to ceil(len/2)', () => expect(sceneAt(ex, 0, 0.5)[0].text).toBe('hello '));
  it('progress 1 shows the full text', () => expect(sceneAt(ex, 0, 1)[0].text).toBe('hello world'));
  it('progress above 1 is clamped', () => expect(sceneAt(ex, 0, 5)[0].text).toBe('hello world'));
  it('progress below 0 is clamped', () => expect(sceneAt(ex, 0, -2)[0].text).toBe(''));
  it('progress does not cut items from earlier packets', () => expect(sceneAt(ex, 2, 0)[0].text).toBe('hello world'));
  it('default progress is 1', () => expect(sceneAt(ex, 0)[0].text).toBe('hello world'));
  it('does not mutate the example', () => {
    const before = JSON.stringify(ex);
    sceneAt(ex, 6, 0.3);
    sceneAt(ex, 6, 1);
    expect(JSON.stringify(ex)).toBe(before);
  });
  it('replace swaps the previous item of the same role instead of adding', () => {
    const s = sceneAt(ex, 6);
    expect(s.filter((i) => i.role === 'assistant')).toEqual([{ role: 'assistant', text: ' Athens.', live: true }]);
  });
  it('replace types only the new part when the text grows', () => {
    expect(sceneAt(ex, 6, 0)[2].text).toBe(' Athens');
    expect(sceneAt(ex, 6, 0.5)[2].text).toBe(' Athens.');
    expect(sceneAt(ex, 6, 1)[2].text).toBe(' Athens.');
  });
  it('replace with unrelated text types from scratch', () => {
    const e = mini([{ at: 0, role: 'status', text: 'one' }, { at: 1, role: 'status', text: 'twelve chars', replace: true }]);
    expect(sceneAt(e, 1, 0)[0].text).toBe('');
    expect(sceneAt(e, 1, 0.5)[0].text).toBe('twelve');
  });
  it('replace without a previous item of that role just adds', () => {
    const e = mini([{ at: 0, role: 'user', text: 'a' }, { at: 1, role: 'tool', text: 'b', replace: true }]);
    expect(sceneAt(e, 1).map((i) => i.role)).toEqual(['user', 'tool']);
  });
  it('replace targets the same role only', () => {
    const e = mini([{ at: 0, role: 'user', text: 'a' }, { at: 1, role: 'status', text: 'b' }, { at: 2, role: 'user', text: 'ab', replace: true }]);
    expect(sceneAt(e, 2).map((i) => [i.role, i.text])).toEqual([['user', 'ab'], ['status', 'b']]);
  });
  it('llm-inside: " Athens" becomes " Athens." and the old part stays visible while typing', () => {
    const e = EXAMPLES['llm-inside'];
    const mid = sceneAt(e, 7, 0).filter((i) => i.role === 'assistant');
    expect(mid).toHaveLength(1);
    expect(mid[0].text).toBe(' Athens');
    expect(sceneAt(e, 7, 1).find((i) => i.role === 'assistant')!.text).toBe(' Athens.');
    expect(sceneAt(e, 4, 1).find((i) => i.role === 'assistant')!.text).toBe(' Athens');
  });
  it('llm-inside: at the last packet the end-of-sequence status is shown', () => {
    const s = sceneAt(EXAMPLES['llm-inside'], 10);
    expect(s[s.length - 1].text).toMatch(/End token/);
  });
  it.each(AI_IDS)('%s: scene grows monotonically (item count never shrinks) with the focus', (id) => {
    const p = byId(id)!;
    let n = 0;
    for (let f = -1; f < p.packets.length; f++) {
      const c = sceneAt(EXAMPLES[id], f).length;
      expect(c).toBeGreaterThanOrEqual(n);
      n = c;
    }
  });
});

describe('highlight', () => {
  const flat = (b: string, lang: Parameters<typeof highlight>[1]) => highlight(b, lang);
  const kinds = (line: ReturnType<typeof highlight>[number]) => line.map((t) => t.kind);

  for (const id of AI_IDS) {
    it(`round-trips every wire body of ${id}`, () => {
      EXAMPLES[id].wire.forEach((m, i) => {
        const lines = m.body.split('\n');
        const toks = highlight(m.body, m.lang);
        expect(toks, `${id} #${i + 1}`).toHaveLength(lines.length);
        toks.forEach((l, j) => expect(l.map((t) => t.text).join(''), `${id} #${i + 1} line ${j + 1}`).toBe(lines[j]));
      });
    });
  }

  it('empty body gives one empty line', () => expect(flat('', 'json')).toEqual([[]]));
  it('HTTP request line is one start token and headers are key/punc/plain', () => {
    const t = flat('POST /x HTTP/1.1\nHost: a.example\n\n{"a":1}', 'http');
    expect(t[0]).toEqual([{ kind: 'start', text: 'POST /x HTTP/1.1' }]);
    expect(t[1]).toEqual([{ kind: 'key', text: 'Host' }, { kind: 'punc', text: ':' }, { kind: 'plain', text: ' a.example' }]);
    expect(t[2]).toEqual([]);
    expect(kinds(t[3])).toContain('key');
  });
  it('status line and short GET line are start tokens', () => {
    expect(flat('HTTP/1.1 200 OK', 'http')[0]).toEqual([{ kind: 'start', text: 'HTTP/1.1 200 OK' }]);
    expect(flat('GET /x', 'http')[0]).toEqual([{ kind: 'start', text: 'GET /x' }]);
  });
  it('a header-like line after the empty line is JSON, not a header', () => {
    const t = flat('HTTP/1.1 200 OK\nA: b\n\nC: d', 'http');
    expect(kinds(t[3])).not.toEqual(['key', 'punc', 'plain']);
  });
  it('headers do not leak past the empty line (opening a second header block again works)', () => {
    const t = flat('HTTP/1.1 200 OK\nA: b\n\nPOST /y HTTP/1.1\nHost: z', 'http');
    expect(t[3][0].kind).toBe('start');
    expect(t[4][0]).toEqual({ kind: 'key', text: 'Host' });
  });
  it('JSON keys, strings, numbers and literals', () => {
    const t = flat('{ "a": "b", "n": -1.5, "t": true, "f": false, "z": null }', 'json')[0];
    const by = (text: string) => t.find((x) => x.text === text)!.kind;
    expect(by('"a"')).toBe('key');
    expect(by('"b"')).toBe('str');
    expect(by('-1.5')).toBe('num');
    expect(by('true')).toBe('lit');
    expect(by('false')).toBe('lit');
    expect(by('null')).toBe('lit');
    expect(by('{')).toBe('punc');
  });
  it('a string with a space before the colon is still a key', () => {
    expect(flat('"a" : 1', 'json')[0].find((x) => x.text === '"a"')!.kind).toBe('key');
  });
  it('a URL with // inside a JSON string is not a comment', () => {
    const t = flat('  "url": "https://example.com/a//b",', 'json')[0];
    expect(kinds(t)).not.toContain('com');
    expect(t.find((x) => x.text.startsWith('"https'))!.kind).toBe('str');
  });
  it('escaped quotes stay inside one string token', () => {
    const t = flat('{"a": "he said \\"hi\\" ok"}', 'json')[0];
    expect(t.filter((x) => x.kind === 'str')).toEqual([{ kind: 'str', text: '"he said \\"hi\\" ok"' }]);
    expect(t.map((x) => x.text).join('')).toBe('{"a": "he said \\"hi\\" ok"}');
  });
  it('lines starting with // are one comment token', () => {
    expect(flat('// a "quoted" note: yes', 'json')[0]).toEqual([{ kind: 'com', text: '// a "quoted" note: yes' }]);
    expect(flat('   // indented', 'json')[0]).toEqual([{ kind: 'com', text: '   // indented' }]);
  });
  it('a trailing // comment after JSON is split off', () => {
    const t = flat('"a": 1, // note', 'json')[0];
    expect(t[t.length - 1].kind).toBe('com');
    expect(t.map((x) => x.text).join('')).toBe('"a": 1, // note');
  });
  it('SSE lines: event is a key, data is JSON-tokenised', () => {
    const t = flat('event: message_stop\ndata: {"type":"message_stop"}', 'sse');
    expect(t[0][0]).toEqual({ kind: 'key', text: 'event' });
    expect(t[1][0]).toEqual({ kind: 'key', text: 'data' });
    expect(t[1].some((x) => x.kind === 'key' && x.text === '"type"')).toBe(true);
    expect(t[1].some((x) => x.kind === 'str' && x.text === '"message_stop"')).toBe(true);
  });
  it('SSE data containing escaped quotes round-trips', () => {
    const line = 'data: {"partial_json":"{\\"city\\": \\"Ath"}';
    expect(flat(line, 'sse')[0].map((x) => x.text).join('')).toBe(line);
  });
  it('the multi-line OAuth request line is one start line followed by plain continuation lines', () => {
    const body = EXAMPLES.mcp.wire[2].body;
    const t = highlight(body, 'http');
    const lines = body.split('\n');
    const i = lines.findIndex((l) => l.startsWith('GET /authorize'));
    expect(t[i][0].kind).toBe('start');
    // continuation lines carry no 'key' tokens
    for (const j of [i + 1, i + 2, i + 3]) expect(kinds(t[j]), lines[j]).not.toContain('key');
  });
  it('lang text gives plain tokens, comments stay comments', () => {
    const t = flat('POST /x HTTP/1.1\n// note\n{"a": 1}', 'text');
    expect(t[0]).toEqual([{ kind: 'plain', text: 'POST /x HTTP/1.1' }]);
    expect(t[1]).toEqual([{ kind: 'com', text: '// note' }]);
    expect(t[2]).toEqual([{ kind: 'plain', text: '{"a": 1}' }]);
  });
  it('very long lines do not break the round trip', () => {
    const line = '"k": "' + 'x'.repeat(50000) + '"';
    expect(flat(line, 'json')[0].map((x) => x.text).join('')).toBe(line);
  });
  it('unterminated string does not lose text', () => {
    const line = '{"a": "oops';
    expect(flat(line, 'json')[0].map((x) => x.text).join('')).toBe(line);
  });
  it('CRLF-free input: a trailing newline gives a final empty line', () => {
    const t = flat('a\n', 'text');
    expect(t).toHaveLength(2);
    expect(t[1]).toEqual([]);
  });
});
