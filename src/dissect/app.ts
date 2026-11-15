// Application-layer encoders, keyed by the packet's protocol label. Anything without one gets
// a generic payload layer. Every encoder fills exactly `budget` bytes when it can, so sizes stay honest.
import type { Packet } from '../protocols/types';
import { macText, parseIPv4, type Addr } from './addr';
import { ByteWriter, LayerBuilder, hex, inetChecksum } from './bytes';
import type { Layer } from './types';

export interface AppCtx {
  budget: number;
  seed: number;
  /** Host name to use in HTTP/TLS when the info has none. */
  host: string;
  src: Addr;
  dst: Addr;
}

export type Encoder = (w: ByteWriter, pk: Packet, c: AppCtx) => Layer[];

/** Pad the rest of the budget with opaque bytes, as a "more data" field. */
function padTo(L: LayerBuilder, end: number, seed: number, key = 'dis.more', note = 'dis.more.n'): void {
  const n = end - L.w.pos;
  if (n > 0) L.field(key, `${n} bytes`, () => L.w.opaqueFill(n, seed), { note });
}

/* ---------------- DNS ---------------- */

const QTYPES: Record<string, number> = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, DS: 43, RRSIG: 46, DNSKEY: 48, HTTPS: 65 };

function dnsName(w: ByteWriter, name: string): void {
  for (const label of name.replace(/\.$/, '').split('.').filter(Boolean)) {
    w.u8(label.length);
    w.ascii(label);
  }
  w.u8(0);
}

export const dns: Encoder = (w, pk, c) => {
  const end = w.pos + c.budget;
  const info = pk.info;
  const isResp = /response|referral/i.test(info);
  const idm = /0x([0-9a-f]{4})/i.exec(info);
  const id = idm ? parseInt(idm[1], 16) : c.seed & 0xffff;
  const typeName = Object.keys(QTYPES).find((k) => new RegExp(`\\b${k}\\b`).test(info.replace(/\bA\s+\d/, ''))) ?? 'A';
  const nameM = /\b((?:[a-z0-9-]+\.)+[a-z]{2,}\.?)(?=\s|$|\))/i.exec(info.replace(/^.*?\b(?:query(?: response)?|Referral:)\s*(?:0x[0-9a-f]+\s*)?/i, '').replace(/^[A-Z]+\s+/, ''));
  const qname = nameM?.[1] ?? c.host;
  const ip = isResp ? parseIPv4(info.slice(info.indexOf(qname) + qname.length)) ?? parseIPv4(info) : null;
  const mx = /MX\s+(\d+)\s+([\w.-]+)/.exec(info);
  const answers = isResp && (ip || mx) && !/referral/i.test(info) ? 1 : 0;
  const ttlM = /TTL=(\d+)/.exec(info);
  const ttl = ttlM ? Number(ttlM[1]) : 300;
  const flags = isResp ? 0x8180 | (/authoritative/i.test(info) ? 0x0400 : 0) | (/AD=1/.test(info) ? 0x0020 : 0) : 0x0100 | (/DO=1|DNSSEC OK/.test(info) ? 0 : 0);

  const L = new LayerBuilder(w, 'dns', 'DNS', `${isResp ? 'response' : 'query'} ${typeName} ${qname}`);
  L.field('dis.dns.id', hex(id), () => w.u16(id), { note: 'dis.dns.id.n', example: !idm });
  L.field('dis.dns.flags', `${hex(flags)} (${isResp ? 'response' : 'query'})`, () => w.u16(flags), { note: isResp ? 'dis.dns.flags.resp' : 'dis.dns.flags.query' });
  L.field('dis.dns.qd', '1', () => w.u16(1));
  L.field('dis.dns.an', String(answers), () => w.u16(answers));
  const ns = /referral/i.test(info) ? 1 : 0;
  L.field('dis.dns.ns', String(ns), () => w.u16(ns));
  L.field('dis.dns.ar', '0', () => w.u16(0));
  L.group('dis.dns.q', () => `${qname} ${typeName} IN`, () => {
    L.field('dis.dns.qname', qname, () => dnsName(w, qname), { note: 'dis.dns.qname.n' });
    L.field('dis.dns.qtype', `${typeName} (${QTYPES[typeName]})`, () => w.u16(QTYPES[typeName]), { note: `dis.dns.qtype.${typeName in NOTE_TYPES ? typeName : 'other'}` });
    L.field('dis.dns.qclass', 'IN (1)', () => w.u16(1), { note: 'dis.dns.qclass.n' });
  });
  if (answers) {
    L.group('dis.dns.answer', () => (ip ? `${qname} A ${ip.join('.')}` : `${qname} MX ${mx![1]} ${mx![2]}`), () => {
      L.field('dis.dns.ptr', '→ ' + qname, () => w.u16(0xc00c), { note: 'dis.dns.ptr.n' });
      L.field('dis.dns.qtype', ip ? 'A (1)' : 'MX (15)', () => w.u16(ip ? 1 : 15));
      L.field('dis.dns.qclass', 'IN (1)', () => w.u16(1));
      L.field('dis.dns.ttl', `${ttl} s`, () => w.u32(ttl), { note: 'dis.dns.ttl.n' });
      if (ip) {
        L.field('dis.dns.rdlen', '4', () => w.u16(4));
        L.field('dis.dns.addr', ip.join('.'), () => w.raw(ip), { note: 'dis.dns.addr.n' });
      } else {
        const host = mx![2];
        L.field('dis.dns.rdlen', String(host.length + 4), () => w.u16(host.length + 4));
        L.field('dis.dns.pref', mx![1], () => w.u16(Number(mx![1])), { note: 'dis.dns.pref.n' });
        L.field('dis.dns.mx', host, () => dnsName(w, host));
      }
    });
  }
  padTo(L, end, c.seed, 'dis.dns.more', 'dis.dns.more.n');
  return [L.done()];
};
const NOTE_TYPES = { A: 1, AAAA: 1, MX: 1, NS: 1, DS: 1, DNSKEY: 1 };

/* ---------------- HTTP/1.1 ---------------- */

export const http: Encoder = (w, pk, c) => {
  const end = w.pos + c.budget;
  const info = pk.info.trim();
  const req = /^([A-Z]+)\s+(\S+)(?:\s+(HTTP\/[\d.]+))?/.exec(info);
  const resp = /^(?:(HTTP\/[\d.]+)\s+)?(\d{3})\s+([A-Za-z][A-Za-z ]*?)(?=\s{2}|\s*[(—{]|$)/.exec(info);
  const hdrs = [...info.matchAll(/\s{1,2}([A-Z][A-Za-z-]+):\s+(\S+(?: [^\s:]+(?!:))*)/g)].map((m) => [m[1], m[2]] as [string, string]);
  const hostHdr = hdrs.find(([k]) => k === 'Host')?.[1];
  const abs = req && /^https?:\/\/([^/]+)/.exec(req[2]);
  const host = hostHdr ?? abs?.[1] ?? (req?.[1] === 'CONNECT' ? req[2] : c.host);

  const lines: [string, string, string, string?][] = []; // [field key, value shown, text written, note]
  if (req) {
    const line = `${req[1]} ${req[2]} ${req[3] ?? 'HTTP/1.1'}`;
    lines.push(['dis.http.reqline', line, line, `dis.http.m.${['GET', 'POST', 'CONNECT', 'PUT', 'DELETE'].includes(req[1]) ? req[1] : 'other'}`]);
    if (!hostHdr) lines.push(['dis.http.hdr', `Host: ${host}`, `Host: ${host}`, 'dis.http.host.n']);
  } else if (resp) {
    const line = `${resp[1] ?? 'HTTP/1.1'} ${resp[2]} ${resp[3].trim()}`;
    lines.push(['dis.http.status', line, line, `dis.http.s.${resp[2][0]}xx`]);
  }
  for (const [k, v] of hdrs) lines.push(['dis.http.hdr', `${k}: ${v}`, `${k}: ${v}`, HDR_NOTES[k]]);
  if (req) {
    for (const [k, v] of [['User-Agent', 'Mozilla/5.0'], ['Accept', '*/*'], ['Accept-Encoding', 'gzip, br'], ['Connection', 'keep-alive']]) {
      if (!hdrs.some(([x]) => x === k)) lines.push(['dis.http.hdr', `${k}: ${v}`, `${k}: ${v}`, HDR_NOTES[k]]);
    }
  } else if (resp) {
    const ct = /\(([a-z]+\/[a-z0-9.+-]+)/i.exec(info)?.[1] ?? (/\{/.test(info) ? 'application/json' : 'text/html');
    for (const [k, v] of [['Content-Type', ct], ['Date', 'Mon, 09 Nov 2026 10:00:00 GMT'], ['Server', 'example']]) {
      if (!hdrs.some(([x]) => x === k)) lines.push(['dis.http.hdr', `${k}: ${v}`, `${k}: ${v}`, HDR_NOTES[k]]);
    }
  }

  const L = new LayerBuilder(w, 'http', 'HTTP', lines[0]?.[1] ?? info);
  if (!req && !resp) {
    const text = info + '\r\n';
    L.field('dis.payload.text', info, () => w.ascii(text));
    padTo(L, end, c.seed);
    return [L.done()];
  }
  const body = /\{.*\}/.exec(info)?.[0];
  // Keep headers within budget: drop optional ones from the end if the message is small.
  let headLen = lines.reduce((a, l) => a + l[2].length + 2, 2) + (body?.length ?? 0);
  while (lines.length > 2 && headLen > c.budget) headLen -= lines.pop()![2].length + 2;
  for (const [key, value, text, note] of lines) L.field(key, value, () => w.ascii(text + '\r\n'), note ? { note } : {});
  // A request without a body fills the rest of its size with headers we don't spell out (cookies, language…).
  const spare = end - w.pos - 2 - (body?.length ?? 0);
  if (req && spare > 0) L.field('dis.http.other', `${spare} bytes`, () => w.opaqueFill(spare, c.seed), { note: 'dis.http.other.n' });
  L.field('dis.http.end', '\\r\\n', () => w.ascii('\r\n'), { note: 'dis.http.end.n' });
  if (body) L.field('dis.http.body', body, () => w.ascii(body), { note: 'dis.http.body.json' });
  padTo(L, end, c.seed, 'dis.http.body', 'dis.http.body.n');
  return [L.done()];
};

const HDR_NOTES: Record<string, string> = {
  Host: 'dis.http.host.n',
  'User-Agent': 'dis.http.ua.n',
  Accept: 'dis.http.accept.n',
  'Accept-Encoding': 'dis.http.enc.n',
  Connection: 'dis.http.conn.n',
  'Content-Type': 'dis.http.ct.n',
  Date: 'dis.http.date.n',
  Server: 'dis.http.server.n',
  Upgrade: 'dis.http.upgrade.n',
  'Cache-Control': 'dis.http.cache.n',
  Age: 'dis.http.age.n',
  Via: 'dis.http.via.n',
  'X-Forwarded-For': 'dis.http.xff.n',
  'WWW-Authenticate': 'dis.http.wwwauth.n',
};

/* ---------------- TLS ---------------- */

const REC_TYPE = { handshake: 22, ccs: 20, alert: 21, app: 23 } as const;
const REC_NAME: Record<number, string> = { 20: 'Change Cipher Spec', 21: 'Alert', 22: 'Handshake', 23: 'Application Data' };
const HS_TYPE: Record<string, number> = { 'Client Hello': 1, 'Server Hello': 2, 'New Session Ticket': 4 };

function tlsRecordHeader(L: LayerBuilder, type: number, len: number): void {
  const w = L.w;
  L.field('dis.tls.type', `${type} (${REC_NAME[type]})`, () => w.u8(type), { note: `dis.tls.type.${type}` });
  L.field('dis.tls.ver', '0x0303 (TLS 1.2)', () => w.u16(0x0303), { note: 'dis.tls.ver.n' });
  L.field('dis.tls.len', `${len} bytes`, () => w.u16(len));
}

export const tls: Encoder = (w, pk, c) => {
  const end = w.pos + c.budget;
  const info = pk.info;
  const layers: Layer[] = [];
  const sni = /SNI=([\w.-]+)/.exec(info)?.[1] ?? c.host;
  const hsName = Object.keys(HS_TYPE).find((k) => info.includes(k) && !info.includes(`{${k}`));
  const plainCcs = /Change Cipher Spec/.test(info);
  const alert = /Alert/.test(info);

  if (hsName) {
    const L = new LayerBuilder(w, 'tls', 'TLS', `Handshake: ${hsName}`);
    const isCH = hsName === 'Client Hello';
    const isSH = hsName === 'Server Hello';
    // Body size for this record: a typical size, capped by what is left.
    const remaining = end - w.pos - 5;
    const want = isCH ? Math.max(120, Math.min(remaining, 512)) : isSH ? Math.min(Math.max(remaining, 90), 118) : Math.min(Math.max(remaining, 40), 250);
    const recLen = Math.max(4, Math.min(want, Math.max(remaining, 4)));
    tlsRecordHeader(L, REC_TYPE.handshake, recLen);
    const recEnd = w.pos + recLen;
    L.field('dis.tls.hstype', `${HS_TYPE[hsName]} (${hsName})`, () => w.u8(HS_TYPE[hsName]), { note: isCH ? 'dis.tls.ch.n' : isSH ? 'dis.tls.sh.n' : 'dis.tls.nst.n' });
    L.field('dis.tls.hslen', `${recLen - 4} bytes`, () => w.u24(recLen - 4));
    if (isCH || isSH) {
      L.field('dis.tls.legacy', '0x0303', () => w.u16(0x0303), { note: 'dis.tls.legacy.n' });
      L.field('dis.tls.random', '32 bytes', () => w.opaqueFill(32, c.seed), { note: 'dis.tls.random.n' });
      L.field('dis.tls.sid', '32 bytes', () => {
        w.u8(32);
        w.opaqueFill(32, c.seed + 1);
      }, { note: 'dis.tls.sid.n' });
      if (isCH) {
        L.field('dis.tls.suites', 'TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256', () => w.raw([0, 6, 0x13, 0x01, 0x13, 0x02, 0x13, 0x03]), { note: 'dis.tls.suites.n' });
        L.field('dis.tls.comp', 'null', () => w.raw([1, 0]));
        const extLen = Math.max(0, recEnd - w.pos - 2);
        L.group('dis.tls.ext', (n) => `${n} bytes`, () => {
          w.u16(extLen);
          const nameLen = sni.length;
          L.field('dis.tls.sni', sni, () => {
            w.raw([0, 0, (nameLen + 5) >> 8, (nameLen + 5) & 0xff, (nameLen + 3) >> 8, (nameLen + 3) & 0xff, 0, nameLen >> 8, nameLen & 0xff]);
            w.ascii(sni);
          }, { note: 'dis.tls.sni.n' });
          L.field('dis.tls.keyshare', 'x25519', () => w.opaqueFill(Math.max(0, Math.min(recEnd - w.pos, 38)), c.seed + 2), { note: 'dis.tls.keyshare.n' });
          padTo(L, recEnd, c.seed + 3, 'dis.tls.otherext', 'dis.tls.otherext.n');
        });
      } else {
        L.field('dis.tls.suite', /TLS_\w+/.exec(info)?.[0] ?? 'TLS_AES_128_GCM_SHA256', () => w.raw([0x13, 0x01]), { note: 'dis.tls.suite.n' });
        L.field('dis.tls.comp', 'null', () => w.u8(0));
        padTo(L, recEnd, c.seed + 4, 'dis.tls.keyshare', 'dis.tls.keyshare.n');
      }
    } else padTo(L, recEnd, c.seed + 5, 'dis.tls.ticket', 'dis.tls.ticket.n');
    layers.push(L.done());
  } else if (alert && !/\{/.test(info)) {
    const L = new LayerBuilder(w, 'tls', 'TLS', 'Alert: close_notify');
    tlsRecordHeader(L, REC_TYPE.alert, Math.max(2, end - w.pos - 5));
    L.field('dis.tls.alert', 'close_notify', () => w.opaqueFill(Math.max(2, end - w.pos), c.seed), { note: 'dis.tls.alert.n' });
    layers.push(L.done());
  }

  if (plainCcs && w.pos < end) {
    const L = new LayerBuilder(w, 'tls-ccs', 'TLS', 'Change Cipher Spec');
    tlsRecordHeader(L, REC_TYPE.ccs, 1);
    L.field('dis.tls.ccs', '1', () => w.u8(1), { note: 'dis.tls.ccs.n' });
    layers.push(L.done());
  }

  if (w.pos < end - 5 || !layers.length) {
    const rest = Math.max(1, end - w.pos - 5);
    const L = new LayerBuilder(w, 'tls-app', 'TLS', 'Application Data');
    tlsRecordHeader(L, REC_TYPE.app, rest);
    const inner = hsName ? info.split(/,\s*/).filter((s) => !s.includes(hsName) && !/Change Cipher Spec/.test(s)).join(', ') || 'Finished' : info;
    L.field('dis.enc.contents', inner, () => w.opaqueFill(rest, c.seed + 9), { note: 'dis.enc.contents.n' });
    layers.push(L.done());
  }
  return layers;
};

/** Application data sent inside an already-established TLS session (HTTPS APIs, IMAPS…). */
export const encrypted: Encoder = (w, pk, c) => {
  const rest = Math.max(1, c.budget - 5);
  const L = new LayerBuilder(w, 'tls-app', 'TLS', `Application Data (${pk.proto})`);
  tlsRecordHeader(L, REC_TYPE.app, rest);
  L.field('dis.enc.contents', pk.info, () => w.opaqueFill(rest, c.seed), { note: 'dis.enc.contents.n' });
  return [L.done()];
};

/* ---------------- ICMP / ICMPv6 ---------------- */

export const icmp: Encoder = (w, pk, c) => {
  const end = w.pos + c.budget;
  const info = pk.info;
  const [type, code, key] = /reply/i.test(info) && /echo/i.test(info) ? [0, 0, 'reply']
    : /echo/i.test(info) ? [8, 0, 'request']
    : /time-to-live|ttl exceeded/i.test(info) ? [11, 0, 'ttl']
    : /unreachable/i.test(info) ? [3, /host/i.test(info) ? 1 : 0, 'unreach']
    : [8, 0, 'request'];
  const L = new LayerBuilder(w, 'icmp', 'ICMP', info.split(/\s+(?:id=|to |from |for )/)[0]);
  const start = w.pos;
  L.field('dis.icmp.type', `${type}`, () => w.u8(type), { note: `dis.icmp.t.${key}` });
  L.field('dis.icmp.code', `${code}`, () => w.u8(code));
  const sumF = L.field('dis.icmp.sum', '', () => w.u16(0), { note: 'dis.icmp.sum.n' });
  if (key === 'request' || key === 'reply') {
    const id = Number(/id=(0x[0-9a-f]+|\d+)/i.exec(info)?.[1] ?? 1);
    const seq = Number(/seq=(\d+)/.exec(info)?.[1] ?? 1);
    L.field('dis.icmp.id', hex(id), () => w.u16(id), { note: 'dis.icmp.id.n' });
    L.field('dis.icmp.seq', String(seq), () => w.u16(seq), { note: 'dis.icmp.seq.n' });
    padTo(L, end, c.seed, 'dis.icmp.data', 'dis.icmp.data.n');
  } else {
    L.field('dis.icmp.unused', '0', () => w.u32(0));
    padTo(L, end, c.seed, 'dis.icmp.orig', 'dis.icmp.orig.n');
  }
  const layer = L.done();
  const sum = inetChecksum(w.bytes.slice(start));
  w.set16(sumF.offset, sum);
  sumF.value = hex(sum);
  return [layer];
};

export const icmpv6: Encoder = (w, pk, c) => {
  const end = w.pos + c.budget;
  const info = pk.info;
  const [type, key] = /Router Solicitation/.test(info) ? [133, 'rs'] : /Router Advertisement/.test(info) ? [134, 'ra']
    : /Neighbor Solicitation/.test(info) ? [135, 'ns'] : /Neighbor Advertisement/.test(info) ? [136, 'na'] : /reply/i.test(info) ? [129, 'reply'] : [128, 'request'];
  const L = new LayerBuilder(w, 'icmpv6', 'ICMPv6', info.split(/[:(]/)[0].trim());
  L.field('dis.icmp.type', String(type), () => w.u8(type), { note: `dis.icmp6.t.${key}` });
  L.field('dis.icmp.code', '0', () => w.u8(0));
  L.field('dis.icmp.sum', '', () => w.u16(0), { note: 'dis.icmp6.sum.n' });
  padTo(L, end, c.seed, 'dis.icmp.body', 'dis.icmp6.body.n');
  return [L.done()];
};

/* ---------------- ARP ---------------- */

export const arp: Encoder = (w, pk, c) => {
  const info = pk.info;
  const gratuitous = /Gratuitous/i.test(info);
  const isReply = /is at/.test(info) && !gratuitous;
  const ips = [...info.matchAll(/\d+\.\d+\.\d+\.\d+/g)].map((m) => m[0].split('.').map(Number));
  const v4 = (a: Addr) => (a.ip.length === 4 ? a.ip : [0, 0, 0, 0]);
  const macM = /is at ([0-9a-f:]{17})/i.exec(info);
  const sha = macM ? macM[1].split(':').map((x) => parseInt(x, 16)) : c.src.mac;
  // Request: "Who has <tpa>? Tell <spa>". Reply: "<spa> is at <sha>". Gratuitous: spa = tpa.
  const spa = isReply || gratuitous ? ips[0] ?? v4(c.src) : ips[1] ?? v4(c.src);
  const tpa = isReply ? v4(c.dst) : gratuitous ? spa : ips[0] ?? v4(c.dst);
  const tha = isReply ? c.dst.mac : [0, 0, 0, 0, 0, 0];
  const L = new LayerBuilder(w, 'arp', 'ARP', isReply ? 'reply' : gratuitous ? 'gratuitous' : 'request');
  L.field('dis.arp.htype', '1 (Ethernet)', () => w.u16(1));
  L.field('dis.arp.ptype', '0x0800 (IPv4)', () => w.u16(0x0800));
  L.field('dis.arp.hlen', '6', () => w.u8(6));
  L.field('dis.arp.plen', '4', () => w.u8(4));
  L.field('dis.arp.op', isReply ? '2 (reply)' : '1 (request)', () => w.u16(isReply ? 2 : 1), { note: isReply ? 'dis.arp.op.reply' : gratuitous ? 'dis.arp.op.grat' : 'dis.arp.op.req' });
  L.field('dis.arp.sha', macText(sha), () => w.raw(sha), { example: !macM && c.src.macExample });
  L.field('dis.arp.spa', spa.join('.'), () => w.raw(spa));
  L.field('dis.arp.tha', macText(tha), () => w.raw(tha), { note: isReply ? undefined : 'dis.arp.tha.n' });
  L.field('dis.arp.tpa', tpa.join('.'), () => w.raw(tpa));
  return [L.done()];
};

/* ---------------- Generic ---------------- */

const TEXT_PROTOS = new Set(['SMTP', 'POP3', 'IMAP', 'FTP', 'SSE', 'SDP']);

export const payload: Encoder = (w, pk, c) => {
  const end = w.pos + c.budget;
  const L = new LayerBuilder(w, 'app', pk.proto, '', true);
  if (TEXT_PROTOS.has(pk.proto)) {
    const text = pk.info.replace(/^[SC]:\s*/, '') + '\r\n';
    L.field('dis.payload.text', pk.info, () => w.ascii(text), { note: 'dis.payload.text.n' });
    padTo(L, end, c.seed);
  } else {
    const n = Math.max(0, end - w.pos);
    L.field('dis.payload.data', pk.info, () => w.opaqueFill(n, c.seed), { note: 'dis.payload.data.n', vars: { proto: pk.proto } });
  }
  return [L.done()];
};

export const ENCODERS: Record<string, Encoder> = {
  DNS: dns,
  DNSSEC: dns,
  HTTP: http,
  TLS: tls,
  'TLS 1.3': tls,
  ICMP: icmp,
  ICMPv6: icmpv6,
  ARP: arp,
};
