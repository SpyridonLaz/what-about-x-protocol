import { describe, expect, it } from 'vitest';
import { PROTOCOLS, byId, searchProtocols } from '../src/protocols';
import { validateAll, validateProtocol } from '../src/protocols/validate';
import type { Protocol } from '../src/protocols/types';

const clone = (p: Protocol): Protocol => structuredClone(p);

describe('catalogue', () => {
  it('has 37 protocols', () => expect(PROTOCOLS).toHaveLength(37));
  it('ids are unique', () => expect(new Set(PROTOCOLS.map((p) => p.id)).size).toBe(PROTOCOLS.length));
  it('passes validateAll', () => expect(validateAll(PROTOCOLS)).toEqual([]));
  it('byId finds and misses', () => {
    expect(byId('http')?.short).toBe('HTTP');
    expect(byId('nope')).toBeUndefined();
  });
});

describe('validateProtocol catches problems', () => {
  const base = byId('http')!;
  const has = (p: Protocol, re: RegExp) => validateProtocol(p).some((e) => re.test(e));
  it('baseline is clean', () => expect(validateProtocol(base)).toEqual([]));
  it('duplicate node id', () => {
    const p = clone(base);
    p.nodes[1].id = p.nodes[0].id;
    expect(has(p, /duplicate node id/)).toBe(true);
  });
  it('unknown node kind', () => {
    const p = clone(base);
    (p.nodes[0] as { kind: string }).kind = 'toaster';
    expect(has(p, /unknown kind/)).toBe(true);
  });
  it('unknown label', () => {
    const p = clone(base);
    p.nodes[0].label = 'zzzNoSuch';
    expect(has(p, /no node\./)).toBe(true);
  });
  it('out of grid', () => {
    const p = clone(base);
    p.nodes[0].x = 13;
    expect(has(p, /outside/)).toBe(true);
    p.nodes[0].x = 0;
    p.nodes[0].y = -1;
    expect(has(p, /outside/)).toBe(true);
  });
  it('shared grid cell', () => {
    const p = clone(base);
    p.nodes[1].x = p.nodes[0].x;
    p.nodes[1].y = p.nodes[0].y;
    expect(has(p, /share grid/)).toBe(true);
  });
  it('link to missing node', () => {
    const p = clone(base);
    p.links.push([p.nodes[0].id, 'ghost']);
    expect(has(p, /missing node/)).toBe(true);
  });
  it('packet from == to', () => {
    const p = clone(base);
    p.packets[0].to = p.packets[0].from;
    expect(has(p, /same/)).toBe(true);
  });
  it('packet unknown node', () => {
    const p = clone(base);
    p.packets[0].from = 'ghost';
    expect(has(p, /unknown source/)).toBe(true);
  });
  it('time goes backwards', () => {
    const p = clone(base);
    p.packets[1].t = p.packets[0].t - 1;
    expect(has(p, /backwards/)).toBe(true);
  });
  it('stage with no packets', () => {
    const p = clone(base);
    p.text.stages.push(['x', 'y']);
    expect(has(p, /has no packets/)).toBe(true);
  });
  it('disconnected used node', () => {
    const p = clone(base);
    p.links = [];
    expect(has(p, /not connected/)).toBe(true);
  });
  it('validateAll flags duplicate ids', () => {
    expect(validateAll([base, clone(base)]).some((e) => /duplicate protocol id/.test(e))).toBe(true);
  });
});

describe('searchProtocols', () => {
  const nameOf = (id: string) => byId(id)!.text.name;
  const fam = (f: string) => f;
  it('empty query returns all in catalogue order', () => {
    expect(searchProtocols('', nameOf, fam)).toEqual(PROTOCOLS);
    expect(searchProtocols('   ', nameOf, fam)).toEqual(PROTOCOLS);
  });
  it('exact short ranks first', () => {
    expect(searchProtocols('http', nameOf, fam)[0].id).toBe('http');
    expect(searchProtocols('dns', nameOf, fam)[0].id).toBe('dns');
    expect(searchProtocols('tcp', nameOf, fam)[0].id).toBe('tcp');
  });
  it('case-insensitive', () => expect(searchProtocols('HTTP', nameOf, fam)[0].id).toBe('http'));
  it('dash/space insensitive', () => {
    expect(searchProtocols('llm-api', nameOf, fam)[0].id).toBe('llm-api');
    expect(searchProtocols('llm api', nameOf, fam)[0].id).toBe('llm-api');
  });
  it('exact outranks prefix: http before https', () => {
    const ids = searchProtocols('http', nameOf, fam).map((p) => p.id);
    expect(ids).toContain('https');
    expect(ids.indexOf('http')).toBeLessThan(ids.indexOf('https'));
  });
  it('accent-insensitive via translated name', () => {
    const r = searchProtocols('efarmogi', (id) => (id === 'ftp' ? 'Éfármogí' : 'zzz'), fam);
    expect(r.map((p) => p.id)).toContain('ftp');
  });
  it('no match returns empty', () => expect(searchProtocols('qqqzzzxxx', nameOf, fam)).toEqual([]));
});
