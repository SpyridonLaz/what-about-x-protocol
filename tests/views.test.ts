import { describe, expect, it } from 'vitest';
import { along, route } from '../src/views/NetworkView';
import { activeStage, focusIndex, formatSize, formatTime, packetState } from '../src/views/context';
import { hashFor, parseHash } from '../src/core/router';
import { byId } from '../src/protocols';
import type { Protocol } from '../src/protocols/types';
import type { PlayerState } from '../src/core/player';

const proto = {
  links: [['a', 'b'], ['b', 'c'], ['a', 'd'], ['d', 'e'], ['e', 'c']],
  nodes: [],
  packets: [],
} as unknown as Protocol;

describe('route', () => {
  it('same node', () => expect(route(proto, 'a', 'a')).toEqual(['a']));
  it('direct link', () => expect(route(proto, 'a', 'b')).toEqual(['a', 'b']));
  it('shortest path', () => expect(route(proto, 'a', 'c')).toEqual(['a', 'b', 'c']));
  it('links are undirected', () => expect(route(proto, 'c', 'a')).toEqual(['c', 'b', 'a']));
  it('falls back to [from,to] when unreachable', () => expect(route(proto, 'a', 'zzz')).toEqual(['a', 'zzz']));
  it('works on a real protocol', () => {
    const p = byId('http')!;
    const pk = p.packets[0];
    const r = route(p, pk.from, pk.to);
    expect(r[0]).toBe(pk.from);
    expect(r[r.length - 1]).toBe(pk.to);
  });
});

describe('along', () => {
  const pts: [number, number][] = [[0, 0], [10, 0], [10, 10]];
  it('start / end', () => {
    expect(along(pts, 0)).toEqual([0, 0]);
    expect(along(pts, 1)).toEqual([10, 10]);
  });
  it('midpoint is at the corner for equal segments', () => expect(along(pts, 0.5)).toEqual([10, 0]));
  it('quarter', () => expect(along(pts, 0.25)).toEqual([5, 0]));
  it('clamps', () => {
    expect(along(pts, -3)).toEqual([0, 0]);
    expect(along(pts, 9)).toEqual([10, 10]);
  });
  it('single point', () => expect(along([[3, 4]], 0.5)).toEqual([3, 4]));
  it('zero-length segment does not produce NaN', () => {
    const r = along([[1, 1], [1, 1]], 0.5);
    expect(r.every(Number.isFinite)).toBe(true);
  });
});

describe('formatSize', () => {
  it('bytes', () => {
    expect(formatSize(0, 'en')).toBe('0 B');
    expect(formatSize(1023, 'en')).toBe('1,023 B');
  });
  it('KB', () => {
    expect(formatSize(1024, 'en')).toBe('1 KB');
    expect(formatSize(1536, 'en')).toBe('1.5 KB');
  });
  it('MB', () => expect(formatSize(1024 * 1024 * 2.5, 'en')).toBe('2.5 MB'));
  it('Greek uses Latin digits', () => expect(formatSize(1536, 'el')).toMatch(/^1[.,]5 KB$/));
  it('German decimal comma', () => expect(formatSize(1536, 'de')).toBe('1,5 KB'));
});

describe('formatTime', () => {
  it('three decimals', () => expect(formatTime(0.5, 'en')).toBe('0.500s'));
  it('zero', () => expect(formatTime(0, 'en')).toBe('0.000s'));
  it('German comma', () => expect(formatTime(1.2345, 'de')).toBe('1,235s'));
  it('Greek uses Latin digits', () => expect(formatTime(1.5, 'el')).toMatch(/^1[.,]500s$/));
});

describe('context helpers', () => {
  const st = (o: Partial<PlayerState>): PlayerState => ({ index: -1, progress: 0, playing: false, speed: 1, count: 3, ...o });
  it('focusIndex while paused is last arrived', () => expect(focusIndex(st({ index: 1 }))).toBe(1));
  it('focusIndex while playing is the in-flight packet', () => expect(focusIndex(st({ index: 1, playing: true }))).toBe(2));
  it('focusIndex playing at end stays', () => expect(focusIndex(st({ index: 2, playing: true }))).toBe(2));
  it('packetState', () => {
    const s = st({ index: 0, playing: true });
    expect([0, 1, 2].map((i) => packetState(i, s))).toEqual(['done', 'current', 'future']);
  });
  it('activeStage', () => {
    const p = byId('http')!;
    expect(activeStage(p, st({ count: p.packets.length }))).toBe(-1);
    expect(activeStage(p, st({ count: p.packets.length, index: 0 }))).toBe(p.packets[0].stage);
  });
});

describe('router', () => {
  it('parses', () => {
    expect(parseHash('#/p/http')).toBe('http');
    expect(parseHash('#/p/llm-api/')).toBe('llm-api');
    expect(parseHash('#/p/HTTP')).toBe('http');
    expect(parseHash(' #/p/dns ')).toBe('dns');
  });
  it.each(['', '#', '#/', '#/p/', '#/p/a/b', '#/x/http', '#/p/ht tp', '#/p/a_b', 'p/http', '#/p/http?x=1'])('rejects %j', (h) => {
    expect(parseHash(h)).toBeNull();
  });
  it('hashFor round-trips', () => expect(parseHash(hashFor('wireguard'))).toBe('wireguard'));
});
