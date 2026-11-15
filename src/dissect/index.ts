// dissect(protocol, index): build the bytes of one message, layer by layer, and describe every field.
// Deterministic and pure: the same message always gives the same bytes (example values are hashed).
import type { Packet, Protocol } from '../protocols/types';
import { ephemeralPort, firstHop, initiator, nodeAddr, nodeOf, parseIPv4, type Addr } from './addr';
import { ENCODERS, encrypted, payload, type AppCtx } from './app';
import { ByteWriter, LayerBuilder, hash, hex, inetChecksum } from './bytes';
import { ETH_ARP, ETH_EAPOL, ETH_IPV4, ETH_IPV6, IP_PROTO_NAME, ethernet, ipv4, ipv6, pseudoHeader, tcp, udp, wifi } from './lower';
import type { Dissection, Layer } from './types';

export type { Dissection, Field, Layer } from './types';

interface Carrier {
  k: 'tcp' | 'udp' | 'ip' | 'arp' | 'l2';
  port?: number;
  /** Server port when it differs by direction (DHCP: server 67, client 68). */
  cport?: number;
  ipProto?: number;
  tls?: boolean;
}

const tcpP = (port: number, tls = false): Carrier => ({ k: 'tcp', port, tls });
const udpP = (port: number, cport?: number): Carrier => ({ k: 'udp', port, cport });

/** How each protocol label travels. Unknown labels fall back to TCP on the scenario's port. */
const CARRIER: Record<string, Carrier> = {
  TCP: { k: 'tcp' }, UDP: { k: 'udp' },
  IPv4: { k: 'ip' }, IPv6: { k: 'ip' }, ICMP: { k: 'ip', ipProto: 1 }, ICMPv6: { k: 'ip', ipProto: 58 }, ESP: { k: 'ip', ipProto: 50 },
  ARP: { k: 'arp' }, '802.11': { k: 'l2' }, SAE: { k: 'l2' }, EAPOL: { k: 'l2' }, EAP: { k: 'l2' },
  DNS: udpP(53), DNSSEC: udpP(53), DHCP: udpP(67, 68), NTP: udpP(123), RADIUS: udpP(1812), IKEv2: udpP(500),
  WireGuard: udpP(51820), QUIC: udpP(443), 'HTTP/3': udpP(443), STUN: udpP(3478), ICE: udpP(3478), DTLS: udpP(50000), SRTP: udpP(50000),
  HTTP: tcpP(80), TLS: tcpP(443), 'TLS 1.3': tcpP(443),
  HTTPS: tcpP(443, true), 'HTTP/2': tcpP(443, true), SSE: tcpP(443, true), WebSocket: tcpP(443, true), MCP: tcpP(443, true),
  A2A: tcpP(443, true), LLM: tcpP(443, true), OAuth: tcpP(443, true), DoH: tcpP(443, true), Embed: tcpP(443, true),
  Vector: tcpP(443, true), Index: tcpP(443, true), Tool: tcpP(443, true), SDP: tcpP(443, true),
  SMTP: tcpP(587), IMAP: tcpP(993, true), POP3: tcpP(995, true), FTP: tcpP(21), 'FTP-DATA': tcpP(20), SSH: tcpP(22),
  SMB2: tcpP(445), BGP: tcpP(179), Modbus: tcpP(502), SOCKS5: tcpP(1080),
};

const PRIVATE = (ip: number[]) => ip.length === 4 && (ip[0] === 10 || (ip[0] === 192 && ip[1] === 168) || (ip[0] === 172 && ip[1] >= 16 && ip[1] < 32));

function carrierFor(p: Protocol, pk: Packet, src: Addr, dst: Addr): Carrier {
  const base = CARRIER[pk.proto];
  const lead = /^\d+/.exec(p.facts.port)?.[0];
  const mine = pk.proto.toUpperCase().startsWith(p.short.toUpperCase()) || p.short.toUpperCase().startsWith(pk.proto.toUpperCase());
  if (!base) {
    const port = lead ? Number(lead) : 443;
    return /udp/i.test(p.facts.transport) && !/tcp/i.test(p.facts.transport) ? udpP(port) : tcpP(port, port === 443);
  }
  const c = { ...base };
  if (mine && lead && c.port !== undefined && c.k === 'tcp') c.port = Number(lead);
  if (pk.proto === 'HTTP') c.tls = c.port === 443 && !PRIVATE(src.ip) && !PRIVATE(dst.ip);
  if (c.k === 'tcp' && c.port === 443 && !['HTTP', 'TLS', 'TLS 1.3'].includes(pk.proto)) c.tls = true;
  return c;
}

/* ---------- info parsing ---------- */

const PORTS = /(?<![\d.])(\d{1,5})\s*→\s*(?:[\d.]+:)?(\d{1,5})(?![\d.])/;
const FLAG_WORDS = new Set(['SYN', 'ACK', 'FIN', 'RST', 'PSH', 'URG']);

function parseFlags(info: string): string[] | null {
  for (const m of info.matchAll(/\[([A-Z, ]+)\]/g)) {
    const parts = m[1].split(/,\s*/).map((s) => s.trim());
    if (parts.every((x) => FLAG_WORDS.has(x))) return parts;
  }
  return null;
}

const num = (re: RegExp, s: string): number | null => {
  const m = re.exec(s);
  return m ? Number(m[1]) : null;
};

/** Relative seq/ack for a TCP packet, from the info when given, otherwise counted from earlier packets. */
function tcpCounters(p: Protocol, i: number): { seq: number; ack: number } {
  const pk = p.packets[i];
  const given = num(/\bSeq=(\d+)/, pk.info);
  const givenAck = num(/\bAck=(\d+)/, pk.info);
  let seq = 0;
  let peer = 0;
  for (let j = 0; j < i; j++) {
    const q = p.packets[j];
    const same = q.from === pk.from && q.to === pk.to;
    const rev = q.from === pk.to && q.to === pk.from;
    if (!same && !rev) continue;
    const flags = parseFlags(q.info) ?? [];
    const syn = flags.includes('SYN');
    const len = num(/\bLen=(\d+)/, q.info) ?? Math.max(0, q.size - 54 - (syn ? 12 : 0));
    const step = (syn || flags.includes('FIN') ? 1 : 0) + (q.proto === 'TCP' && !/Len=/.test(q.info) ? 0 : len);
    if (same) seq += step;
    else peer += step;
  }
  return { seq: given ?? seq, ack: givenAck ?? peer };
}

/* ---------- main ---------- */

const cache = new WeakMap<Protocol, Map<number, Dissection>>();

export function dissect(p: Protocol, index: number): Dissection {
  let per = cache.get(p);
  if (!per) cache.set(p, (per = new Map()));
  const hit = per.get(index);
  if (hit) return hit;
  const d = build(p, index);
  per.set(index, d);
  return d;
}

function build(p: Protocol, index: number): Dissection {
  const pk = p.packets[index];
  const w = new ByteWriter();
  const layers: Layer[] = [];
  const fromN = nodeOf(p, pk.from);
  const toN = nodeOf(p, pk.to);
  const src = nodeAddr(p, fromN, pk.from);
  const dst = nodeAddr(p, toN, pk.to);
  const seed = hash(`${p.id}#${index}`);
  const carrier = carrierFor(p, pk, src, dst);
  const label = (id: string) => `node.${nodeOf(p, id)?.label ?? id}`;
  const apNode = p.nodes.find((n) => n.kind === 'ap');
  const hostName = [toN?.addr, fromN?.addr].find((a) => a && /^[a-z][\w.-]*\.[a-z]{2,}$/i.test(a)) ?? 'www.example.com';
  const ctxLine = { key: 'dis.ctx.leave', vars: { src: label(pk.from), dst: label(pk.to) } };

  let ipStart = -1;
  // Some scenarios give the payload size rather than the frame size (e.g. an 8-byte WebSocket frame).
  // When the size can't even hold the headers, read it as the payload size.
  const appCtx = (): AppCtx => {
    const left = pk.size - w.pos;
    const want = left >= 0 ? left : pk.size;
    // One IP packet holds at most 65535 bytes; bigger messages (file transfers, pages) travel as many
    // segments, and the detail view shows the first one.
    const ipMax = ipStart >= 0 ? 65535 - (w.pos - ipStart) : Infinity;
    return { budget: Math.max(0, Math.min(want, ipMax)), seed, host: hostName, src, dst };
  };

  /* Link layer */
  if (carrier.k === 'l2' && (apNode || pk.proto === '802.11' || pk.proto === 'SAE')) {
    const info = pk.info;
    const sub = /Beacon/.test(info) ? 0x80 : /Probe Request/.test(info) ? 0x40 : /Probe Response/.test(info) ? 0x50
      : /Authentication|SAE/.test(info) || pk.proto === 'SAE' ? 0xb0 : /Association Request/.test(info) ? 0x00
      : /Association Response/.test(info) ? 0x10 : /Block Ack/.test(info) ? 0x94 : /Deauth/.test(info) ? 0xc0 : 0x88;
    const prot = /encrypted|Protected|GCMP/i.test(info);
    const bssid = apNode ? nodeAddr(p, apNode, apNode.id) : src;
    const rx = sub === 0x80 ? { ...dst, mac: [255, 255, 255, 255, 255, 255], macText: 'ff:ff:ff:ff:ff:ff', macExample: false } : dst;
    layers.push(wifi(w, sub, prot, rx, src, bssid, (seed >>> 8) % 4096));
    const L = new LayerBuilder(w, 'body', pk.proto, '', true);
    const n = Math.max(0, pk.size - w.pos);
    L.field('dis.wifi.body', info, () => w.opaqueFill(n, seed), { note: prot ? 'dis.enc.contents.n' : 'dis.wifi.body.n' });
    layers.push(L.done());
    return finish(w, layers, { key: 'dis.ctx.air', vars: ctxLine.vars });
  }

  const hop = firstHop(p, pk);
  const hopAddr = hop ? nodeAddr(p, hop, hop.id) : null;
  const arpBroadcast = carrier.k === 'arp' && !/is at/.test(pk.info) || /Gratuitous/i.test(pk.info);
  const dhcpBroadcast = pk.proto === 'DHCP' && /255\.255\.255\.255/.test(pk.info);
  const bcast = arpBroadcast || dhcpBroadcast;
  const ethDst: Addr = bcast ? { ...dst, mac: [255, 255, 255, 255, 255, 255], macText: 'ff:ff:ff:ff:ff:ff', macExample: false } : hopAddr ?? dst;

  const v6 = src.ip.length === 16 && dst.ip.length === 16;
  const ethertype = carrier.k === 'arp' ? ETH_ARP : carrier.k === 'l2' ? ETH_EAPOL : v6 ? ETH_IPV6 : ETH_IPV4;
  layers.push(ethernet(w, {
    dst: ethDst,
    src,
    type: ethertype,
    dstNote: bcast ? 'dis.eth.dst.bcast' : hop ? 'dis.eth.dst.hop' : 'dis.eth.dst.direct',
    dstVars: { node: hop ? `node.${hop.label}` : label(pk.to) },
    srcNote: 'dis.eth.src.n',
    srcVars: { node: label(pk.from) },
  }));

  if (carrier.k === 'arp') {
    layers.push(...ENCODERS.ARP(w, pk, appCtx()));
    return finish(w, layers, ctxLine);
  }
  if (carrier.k === 'l2') {
    const L = new LayerBuilder(w, 'eapol', pk.proto, '', true);
    const n = Math.max(0, pk.size - w.pos);
    L.field('dis.payload.data', pk.info, () => w.opaqueFill(n, seed), { note: 'dis.payload.data.n', vars: { proto: pk.proto } });
    layers.push(L.done());
    return finish(w, layers, ctxLine);
  }

  /* Network layer */
  const ipPair = ['IPv4', 'TCP', 'UDP', 'DHCP'].includes(pk.proto) ? /(\d+\.\d+\.\d+\.\d+)(?::\d+)?\s*→\s*(\d+\.\d+\.\d+\.\d+)/.exec(pk.info) : null;
  const srcIp = !v6 && ipPair ? parseIPv4(ipPair[1])! : v6 ? src.ip : src.ip.length === 4 ? src.ip : [192, 0, 2, src.ip[15]];
  const dstIp = !v6 && ipPair ? parseIPv4(ipPair[2])! : v6 ? dst.ip : dst.ip.length === 4 ? dst.ip : [192, 0, 2, dst.ip[15]];
  const ipProto = carrier.k === 'tcp' ? 6 : carrier.k === 'udp' ? 17 : carrier.ipProto ?? (/Proto=UDP/.test(pk.info) ? 17 : 6);
  const ttl = num(/\b(?:ttl|TTL|Hop Limit)=(\d+)/, pk.info) ?? 64;
  const ipInfo = { src, dst, srcIp, dstIp, proto: ipProto, ttl, ident: seed & 0xffff };
  const srcText = v6 ? src.ipText : srcIp.join('.');
  const dstText = v6 ? dst.ipText : dstIp.join('.');
  ipStart = w.pos;
  const ip = v6 ? ipv6(w, ipInfo, srcText, dstText) : ipv4(w, ipInfo, srcText, dstText);
  layers.push(ip.layer);
  const pseudo = (len: number) => pseudoHeader(srcIp, dstIp, ipProto, len);

  /* Transport + application */
  const ports = PORTS.exec(pk.info);
  const opener = initiator(p, pk);
  const eph = ephemeralPort(p, pk.from, pk.to);
  const serverPort = carrier.port ?? eph + 1;
  const clientPort = carrier.cport ?? eph;
  const sPort = ports ? Number(ports[1]) : pk.from === opener ? clientPort : serverPort;
  const dPort = ports ? Number(ports[2]) : pk.from === opener ? serverPort : clientPort;

  const app = (): Layer[] => {
    const c = appCtx();
    if (carrier.tls) return encrypted(w, pk, c);
    const enc = ENCODERS[pk.proto];
    if (enc) return enc(w, pk, c);
    if (pk.proto === 'TCP' || pk.proto === 'UDP') {
      // Plain segments: only what is left of the frame is payload (a bare SYN has none).
      c.budget = pk.proto === 'UDP' ? c.budget : Math.max(0, pk.size - w.pos);
      if (c.budget <= 0) return [];
      const L = new LayerBuilder(w, 'data', 'Data', `${c.budget} bytes`, true);
      L.field('dis.tcp.payload', `${c.budget} bytes`, () => w.opaqueFill(c.budget, seed), { note: 'dis.tcp.payload.n' });
      return [L.done()];
    }
    return payload(w, pk, c);
  };

  if (carrier.k === 'tcp') {
    const flags = parseFlags(pk.info) ?? (pk.proto === 'TCP' ? ['ACK'] : ['PSH', 'ACK']);
    const syn = flags.includes('SYN');
    const { seq, ack } = tcpCounters(p, index);
    const win = num(/Win=(\d+)/, pk.info);
    const t = tcp(w, {
      srcPort: sPort,
      dstPort: dPort,
      seqRel: seq,
      ackRel: ack,
      isn: hash(`${p.id}:${pk.from}>${pk.to}`),
      peerIsn: hash(`${p.id}:${pk.to}>${pk.from}`),
      flags,
      window: win ?? (pk.from === opener ? 64240 : 65535),
      windowExample: win === null,
      syn,
      mss: num(/MSS=(\d+)/, pk.info) ?? 1460,
    });
    layers.push(t.layer, ...app());
    t.finish(pseudo);
  } else if (carrier.k === 'udp') {
    const u = udp(w, sPort, dPort);
    layers.push(u.layer, ...app());
    u.finish(pseudo);
  } else if (ipProto === 50) {
    const L = new LayerBuilder(w, 'esp', 'ESP', '');
    const spi = parseInt(/SPI=0x([0-9a-f]+)/i.exec(pk.info)?.[1] ?? '1', 16);
    const sq = num(/Seq=(\d+)/, pk.info) ?? 1;
    L.field('dis.esp.spi', hex(spi, 8), () => w.u32(spi), { note: 'dis.esp.spi.n' });
    L.field('dis.esp.seq', String(sq), () => w.u32(sq), { note: 'dis.esp.seq.n' });
    const n = Math.max(0, pk.size - w.pos);
    L.field('dis.enc.contents', pk.info.replace(/^ESP SPI=\S+ Seq=\d+\s*/, ''), () => w.opaqueFill(n, seed), { note: 'dis.enc.contents.n' });
    layers.push(L.done());
  } else if (ENCODERS[pk.proto]) {
    const start = w.pos;
    const out = ENCODERS[pk.proto](w, pk, appCtx());
    layers.push(...out);
    if (ipProto === 58) {
      // ICMPv6 checksum covers a pseudo-header too.
      const sumF = out[0]?.fields.find((f) => f.key === 'dis.icmp.sum');
      if (sumF) {
        const sum = inetChecksum(pseudo(w.pos - start), w.bytes.slice(start));
        w.set16(sumF.offset, sum);
        sumF.value = hex(sum);
      }
    }
  } else {
    const c = appCtx();
    const L = new LayerBuilder(w, 'data', IP_PROTO_NAME[ipProto] ?? 'Data', '', true);
    L.field('dis.payload.data', `${c.budget} bytes`, () => w.opaqueFill(c.budget, seed), { note: 'dis.payload.data.n', vars: { proto: IP_PROTO_NAME[ipProto] ?? 'IP' } });
    layers.push(L.done());
  }
  ip.finish();
  return finish(w, layers, ctxLine);
}

function finish(w: ByteWriter, layers: Layer[], context: Dissection['context']): Dissection {
  return { layers, bytes: Uint8Array.from(w.bytes), opaque: w.opaque.slice(), context };
}
