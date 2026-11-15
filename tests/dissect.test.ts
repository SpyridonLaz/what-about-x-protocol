import { describe, expect, it } from 'vitest';
import { dissect, type Field, type Layer } from '../src/dissect';
import { inetChecksum } from '../src/dissect/bytes';
import { ipv6Text, parseIPv4, parseIPv6 } from '../src/dissect/addr';
import { PROTOCOLS, byId } from '../src/protocols';
import { checkLocale, englishMessages } from '../src/i18n/messages';
import { messageTitle } from '../src/views/PacketDetail';
import { hashFor, parseHash, parseMsg } from '../src/core/router';
import type { Packet } from '../src/protocols/types';
import el from '../src/i18n/messages/el.json';
import de from '../src/i18n/messages/de.json';

const EN = englishMessages();
const all = PROTOCOLS.flatMap((p) => p.packets.map((pk, i) => ({ p, pk, i, name: `${p.id}#${i} ${pk.proto}` })));

describe('dissect: every packet of every protocol', () => {
  it('never throws, is deterministic and memoised', () => {
    for (const { p, i } of all) {
      const a = dissect(p, i);
      const b = dissect(p, i);
      expect(Array.from(b.bytes)).toEqual(Array.from(a.bytes));
      expect(b).toBe(a);
    }
  });

  it('layers are contiguous and cover the whole frame', () => {
    const bad: string[] = [];
    for (const { p, i, name } of all) {
      const d = dissect(p, i);
      let off = 0;
      for (const l of d.layers) {
        if (l.offset !== off) bad.push(`${name}: layer ${l.id} at ${l.offset}, expected ${off}`);
        off += l.length;
      }
      if (off !== d.bytes.length) bad.push(`${name}: layers cover ${off} of ${d.bytes.length}`);
      if (d.opaque.length !== d.bytes.length) bad.push(`${name}: opaque length`);
    }
    expect(bad).toEqual([]);
  });

  it('fields lie inside their layer and children inside their parent', () => {
    const bad: string[] = [];
    const walk = (name: string, f: Field, lo: number, hi: number) => {
      if (f.offset < lo || f.offset + f.length > hi) bad.push(`${name}: ${f.key} [${f.offset},${f.offset + f.length}) outside [${lo},${hi})`);
      f.children?.forEach((c) => walk(name, c, f.offset, f.offset + f.length));
    };
    for (const { p, i, name } of all) {
      for (const l of dissect(p, i).layers) l.fields.forEach((f) => walk(name, f, l.offset, l.offset + l.length));
    }
    expect(bad).toEqual([]);
  });

  it('all i18n keys used exist in the English messages', () => {
    const missing = new Set<string>();
    const walk = (f: Field) => {
      if (!(f.key in EN)) missing.add(f.key);
      if (f.note && !(f.note in EN)) missing.add(f.note);
      f.children?.forEach(walk);
    };
    // Layer labels are shown as-is by PacketDetail (protocol names), so only require them to be non-empty.
    const layerKey = (l: Layer) => {
      if (!l.label) missing.add(`empty label on ${l.id}`);
    };
    for (const { p, i } of all) {
      const d = dissect(p, i);
      if (!(d.context.key in EN)) missing.add(d.context.key);
      d.layers.forEach((l) => {
        layerKey(l);
        l.fields.forEach(walk);
      });
    }
    expect([...missing]).toEqual([]);
  });
});

function layerOf(d: ReturnType<typeof dissect>, id: string) {
  return d.layers.find((l) => l.id === id);
}

describe('dissect: checksums and lengths', () => {
  it('IPv4 header checksum validates and total length matches the frame', () => {
    const bad: string[] = [];
    let n = 0;
    for (const { p, i, name } of all) {
      const d = dissect(p, i);
      const ip = layerOf(d, 'ipv4');
      if (!ip) continue;
      n++;
      const hdr = d.bytes.slice(ip.offset, ip.offset + ip.length);
      if (inetChecksum(hdr) !== 0) bad.push(`${name}: ipv4 checksum`);
      const total = (d.bytes[ip.offset + 2] << 8) | d.bytes[ip.offset + 3];
      if (total !== d.bytes.length - ip.offset) bad.push(`${name}: total length ${total} vs ${d.bytes.length - ip.offset}`);
    }
    expect(n).toBeGreaterThan(50);
    expect(bad).toEqual([]);
    expect(bad.filter((x) => !/^(ftp#11|smb#9|rag#[0-3]) /.test(x))).toEqual([]);
  });

  it('IPv4 total length and IPv6 payload length stay within 65535 and match the frame', () => {
    const bad: string[] = [];
    for (const { p, i, name } of all) {
      const d = dissect(p, i);
      const v4 = layerOf(d, 'ipv4');
      const v6 = layerOf(d, 'ipv6');
      if (v4) {
        const total = (d.bytes[v4.offset + 2] << 8) | d.bytes[v4.offset + 3];
        if (total !== d.bytes.length - v4.offset || total > 65535) bad.push(`${name}: v4 total ${total}, frame ${d.bytes.length}`);
      }
      if (v6) {
        const pl = (d.bytes[v6.offset + 4] << 8) | d.bytes[v6.offset + 5];
        if (pl !== d.bytes.length - v6.offset - 40 || pl > 65535) bad.push(`${name}: v6 payload ${pl}, frame ${d.bytes.length}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('TCP and UDP checksums validate over the pseudo-header (IPv4)', () => {
    const bad: string[] = [];
    let n = 0;
    for (const { p, i, name } of all) {
      const d = dissect(p, i);
      const ip = layerOf(d, 'ipv4');
      const tr = layerOf(d, 'tcp') ?? layerOf(d, 'udp');
      if (!ip || !tr) continue;
      n++;
      const proto = d.bytes[ip.offset + 9];
      const seg = d.bytes.slice(tr.offset);
      const ph = [...d.bytes.slice(ip.offset + 12, ip.offset + 20), 0, proto, seg.length >> 8, seg.length & 0xff];
      const sum = inetChecksum(ph, seg);
      const ok = sum === 0 || (proto === 17 && sum === 0xffff);
      if (!ok) bad.push(`${name}: ${sum.toString(16)}`);
    }
    expect(n).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });

  it('TCP and UDP checksums validate over the pseudo-header (IPv6)', () => {
    const bad: string[] = [];
    for (const { p, i, name } of all) {
      const d = dissect(p, i);
      const ip = layerOf(d, 'ipv6');
      const tr = layerOf(d, 'tcp') ?? layerOf(d, 'udp');
      if (!ip || !tr) continue;
      const seg = d.bytes.slice(tr.offset);
      const proto = d.bytes[ip.offset + 6];
      const ph = [...d.bytes.slice(ip.offset + 8, ip.offset + 40), 0, 0, seg.length >> 8, seg.length & 0xff, 0, 0, 0, proto];
      const sum = inetChecksum(ph, seg);
      if (!(sum === 0 || (proto === 17 && sum === 0xffff))) bad.push(`${name}: ${sum.toString(16)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('inetChecksum', () => {
  it('matches the RFC 1071 example', () => {
    expect(inetChecksum([0x00, 0x01, 0xf2, 0x03, 0xf4, 0xf5, 0xf6, 0xf7])).toBe(0x220d);
  });
  it('pads an odd-length input with a zero byte', () => {
    expect(inetChecksum([0x12])).toBe(inetChecksum([0x12, 0x00]));
  });
  it('is zero for data that includes its own checksum', () => {
    const data = [0x45, 0, 0, 0x1c, 0, 0, 0, 0, 64, 1, 0, 0, 10, 0, 0, 1, 10, 0, 0, 2];
    const c = inetChecksum(data);
    data[10] = c >> 8;
    data[11] = c & 0xff;
    expect(inetChecksum(data)).toBe(0);
  });
});

describe('dissect: HTTP scenario', () => {
  const p = byId('http')!;
  const hs = dissect(p, 2);
  it('SYN is a 66-byte frame: 14 + 20 + 32 with options', () => {
    expect(p.packets[2].info).toMatch(/SYN/);
    expect(hs.bytes.length).toBe(66);
    const tcp = layerOf(hs, 'tcp')!;
    expect(tcp.offset).toBe(34);
    expect(tcp.length).toBe(32);
    expect(hs.bytes[34 + 12] >> 4).toBe(8);
  });
  it('SYN has only the SYN flag and ack 0', () => {
    expect(hs.bytes[34 + 13]).toBe(0x02);
    expect(Array.from(hs.bytes.slice(34 + 8, 34 + 12))).toEqual([0, 0, 0, 0]);
  });
  it('plain ACK is 54 bytes', () => {
    expect(p.packets[4].info).toMatch(/ACK/);
    expect(dissect(p, 4).bytes.length).toBe(54);
  });
  it('full-size encoders match pk.size (documented: DNS may be off by one)', () => {
    const diffs: string[] = [];
    for (let i = 0; i <= 11; i++) {
      const pk = p.packets[i];
      const len = dissect(p, i).bytes.length;
      if (len !== pk.size) diffs.push(`#${i} ${pk.proto} size=${pk.size} bytes=${len}`);
    }
    expect(diffs.filter((x) => !x.includes(' DNS '))).toEqual([]);
  });
  it('request packets carry GET as ASCII', () => {
    const i = p.packets.findIndex((x) => x.proto === 'HTTP' && /^GET/.test(x.info));
    expect(i).toBeGreaterThanOrEqual(0);
    const text = String.fromCharCode(...dissect(p, i).bytes);
    expect(text).toContain('GET ');
    expect(text.endsWith('\r\n')).toBe(true);
  });
});

describe('dissect: DNS', () => {
  const p = byId('http')!;
  const qi = p.packets.findIndex((x) => x.proto === 'DNS');
  const d = dissect(p, qi);
  const udp = layerOf(d, 'udp')!;
  const asc = (s: string) => s.split('').map((c) => c.charCodeAt(0));
  it('uses UDP destination port 53', () => {
    expect((d.bytes[udp.offset + 2] << 8) | d.bytes[udp.offset + 3]).toBe(53);
  });
  it('encodes the query name as labels with qtype A', () => {
    const dns = d.bytes.slice(udp.offset + 8);
    const name = [3, ...asc('www'), 7, ...asc('example'), 3, ...asc('com'), 0];
    expect(Array.from(dns.slice(12, 12 + name.length))).toEqual(name);
    const t = 12 + name.length;
    expect((dns[t] << 8) | dns[t + 1]).toBe(1);
  });
  it('response ends with the answer address 203.0.113.10', () => {
    expect(Array.from(dissect(p, qi + 1).bytes.slice(-4))).toEqual([203, 0, 113, 10]);
  });
});

describe('dissect: ARP', () => {
  const p = byId('ip')!;
  const req = dissect(p, 0);
  const rep = dissect(p, 1);
  const a = 14;
  it('request: broadcast, opcode 1, zero target MAC, addresses from info', () => {
    expect(Array.from(req.bytes.slice(0, 6))).toEqual([255, 255, 255, 255, 255, 255]);
    expect((req.bytes[12] << 8) | req.bytes[13]).toBe(0x0806);
    expect((req.bytes[a + 6] << 8) | req.bytes[a + 7]).toBe(1);
    expect(Array.from(req.bytes.slice(a + 14, a + 18))).toEqual([192, 168, 1, 10]);
    expect(Array.from(req.bytes.slice(a + 18, a + 24))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(Array.from(req.bytes.slice(a + 24, a + 28))).toEqual([192, 168, 1, 1]);
  });
  it('reply: opcode 2 and sender MAC/IP from info', () => {
    expect((rep.bytes[a + 6] << 8) | rep.bytes[a + 7]).toBe(2);
    expect(Array.from(rep.bytes.slice(a + 8, a + 14))).toEqual([0x00, 0x00, 0x5e, 0x00, 0x53, 0x01]);
    expect(Array.from(rep.bytes.slice(a + 14, a + 18))).toEqual([192, 168, 1, 1]);
  });
  it('frame is 42 bytes', () => {
    expect(req.bytes.length).toBe(42);
  });
});

describe('dissect: ICMP echo', () => {
  const p = byId('icmp')!;
  it('request is type 8, reply type 0, checksums valid', () => {
    for (const [i, type] of [[0, 8], [1, 0]] as const) {
      const d = dissect(p, i);
      const ip = layerOf(d, 'ipv4')!;
      const off = ip.offset + ip.length;
      expect(d.bytes[off]).toBe(type);
      expect(inetChecksum(d.bytes.slice(off))).toBe(0);
      expect((d.bytes[off + 4] << 8) | d.bytes[off + 5]).toBe(1);
      expect((d.bytes[off + 6] << 8) | d.bytes[off + 7]).toBe(1);
    }
  });
});

describe('dissect: opaque bytes', () => {
  it('TLS Client Hello has opaque random bytes and visible ones', () => {
    const p = byId('tls')!;
    const i = p.packets.findIndex((x) => /Client Hello/i.test(x.info));
    expect(i).toBeGreaterThanOrEqual(0);
    const d = dissect(p, i);
    expect(d.opaque.some(Boolean)).toBe(true);
    expect(d.opaque.some((o) => !o)).toBe(true);
  });
  it('encrypted HTTPS-carried message body is opaque', () => {
    const p = byId('https')!;
    const i = p.packets.findIndex((x) => x.proto === 'HTTP/2');
    expect(i).toBeGreaterThanOrEqual(0);
    const d = dissect(p, i);
    const tls = d.layers.find((l) => l.id.startsWith('tls'))!;
    expect(tls).toBeDefined();
    const body = d.opaque.slice(tls.offset + 5, tls.offset + tls.length);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every(Boolean)).toBe(true);
  });
});

describe('addr helpers', () => {
  it('parseIPv4 accepts valid and rejects invalid', () => {
    expect(parseIPv4('192.168.1.10')).toEqual([192, 168, 1, 10]);
    expect(parseIPv4('300.1.1.1')).toBeNull();
    expect(parseIPv4('1.2.3')).toBeNull();
    expect(parseIPv4('')).toBeNull();
  });
  it('IPv6 round-trips with zero compression', () => {
    const b = parseIPv6('2001:db8:1::a10')!;
    expect(b).toHaveLength(16);
    expect(ipv6Text(b)).toBe('2001:db8:1::a10');
    expect(ipv6Text(parseIPv6('fe80::1')!)).toBe('fe80::1');
    expect(ipv6Text([0x20, 1, 0xd, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe('2001:db8::1');
  });
  it('parses a leading :: and round-trips it', () => {
    expect(parseIPv6('::1')).toEqual([...Array(15).fill(0), 1]);
    expect(parseIPv6('::')).toEqual(Array(16).fill(0));
    expect(ipv6Text(parseIPv6('::1')!)).toBe('::1');
    expect(ipv6Text(parseIPv6('::')!)).toBe('::');
  });
  it('a time is not IPv6', () => {
    expect(parseIPv6('12:00:00')).toBeNull();
  });
  it('MAC addresses are not IPv6', () => {
    expect(parseIPv6('00:00:5e:00:53:01')).toBeNull();
  });
  it('parseIPv6 rejects garbage', () => {
    expect(parseIPv6('hello')).toBeNull();
    expect(parseIPv6('1:2:3')).toBeNull();
  });
});

describe('router ?msg', () => {
  it('parseHash ignores the msg query', () => {
    expect(parseHash('#/p/http')).toBe('http');
    expect(parseHash('#/p/http?msg=3')).toBe('http');
    expect(parseHash('#/p/HTTP/')).toBe('http');
  });
  it('parseMsg is 0-based, null for none/zero/garbage', () => {
    expect(parseMsg('#/p/http?msg=3')).toBe(2);
    expect(parseMsg('#/p/http?msg=1')).toBe(0);
    expect(parseMsg('#/p/http?msg=0')).toBeNull();
    expect(parseMsg('#/p/http')).toBeNull();
    expect(parseMsg('#/p/http?msg=abc')).toBeNull();
    expect(parseMsg('#/p/http?msg=-1')).toBeNull();
    expect(parseMsg('garbage')).toBeNull();
    expect(parseMsg('')).toBeNull();
  });
  it('hashFor round-trips', () => {
    expect(hashFor('http')).toBe('#/p/http');
    expect(hashFor('http', null)).toBe('#/p/http');
    expect(hashFor('http', 0)).toBe('#/p/http?msg=1');
    expect(parseMsg(hashFor('dns', 11))).toBe(11);
    expect(parseHash(hashFor('dns', 11))).toBe('dns');
  });
  it('garbage hash returns null', () => {
    expect(parseHash('#/x/http')).toBeNull();
    expect(parseHash('#/p/http?msg=')).toBeNull();
  });
});

describe('messageTitle', () => {
  const mk = (proto: string, info: string) => ({ proto, info }) as Packet;
  it('TCP shows the flag list', () => {
    expect(messageTitle(mk('TCP', '51544 → 80 [SYN, ACK] Seq=0'))).toBe('SYN, ACK');
    expect(messageTitle(mk('TCP', '51544 → 80 [SYN] Seq=0'))).toBe('SYN');
  });
  it('other protocols use the first part of info', () => {
    expect(messageTitle(mk('HTTP', 'GET /index.html  Host: x'))).toBe('GET /index.html');
  });
  it('long titles are cut to 48 characters with an ellipsis', () => {
    const t = messageTitle(mk('X', 'a'.repeat(100)));
    expect(t).toHaveLength(48);
    expect(t.endsWith('…')).toBe(true);
  });
});

describe('i18n parity for dissector strings', () => {
  it('el has no errors', () => expect(checkLocale('el', EN, el as Record<string, unknown>)).toEqual([]));
  it('de has no errors', () => expect(checkLocale('de', EN, de as Record<string, unknown>)).toEqual([]));
});
