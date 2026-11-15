// Lower layers: Ethernet II, 802.11, IPv4, IPv6, TCP, UDP. Each writes real header bytes.
import type { Addr } from './addr';
import { ByteWriter, LayerBuilder, hex, inetChecksum } from './bytes';
import type { Field, Layer } from './types';

export const ETH_IPV4 = 0x0800;
export const ETH_IPV6 = 0x86dd;
export const ETH_ARP = 0x0806;
export const ETH_EAPOL = 0x888e;

const ETHERTYPE_NAME: Record<number, string> = { [ETH_IPV4]: 'IPv4', [ETH_IPV6]: 'IPv6', [ETH_ARP]: 'ARP', [ETH_EAPOL]: 'EAPOL' };

export interface EthOpts {
  dst: Addr;
  src: Addr;
  type: number;
  /** i18n key of the destination note (who receives the frame), plus vars. */
  dstNote: string;
  dstVars?: Record<string, string>;
  srcNote: string;
  srcVars?: Record<string, string>;
}

export function ethernet(w: ByteWriter, o: EthOpts): Layer {
  const L = new LayerBuilder(w, 'eth', 'Ethernet II', `${o.src.macText} → ${o.dst.macText}`);
  L.field('dis.eth.dst', o.dst.macText, () => w.raw(o.dst.mac), { note: o.dstNote, vars: o.dstVars, example: o.dst.macExample });
  L.field('dis.eth.src', o.src.macText, () => w.raw(o.src.mac), { note: o.srcNote, vars: o.srcVars, example: o.src.macExample });
  L.field('dis.eth.type', `${hex(o.type)} (${ETHERTYPE_NAME[o.type] ?? '?'})`, () => w.u16(o.type), { note: 'dis.eth.type.n' });
  return L.done();
}

/** 802.11 MAC header (management/data frames). Returns the layer; body is written by the caller. */
export function wifi(w: ByteWriter, subtype: number, protectedFrame: boolean, rx: Addr, tx: Addr, bssid: Addr, seq: number): Layer {
  const L = new LayerBuilder(w, 'wifi', '802.11', `${tx.macText} → ${rx.macText}`);
  const type = (subtype >> 2) & 0x3;
  const typeKey = type === 0 ? 'dis.wifi.mgmt' : type === 1 ? 'dis.wifi.ctrl' : 'dis.wifi.data';
  const flags = protectedFrame ? 0x40 : 0;
  L.field('dis.wifi.fc', `${hex((subtype << 8) | flags)}`, () => {
    w.u8(subtype);
    w.u8(flags);
  }, { note: protectedFrame ? 'dis.wifi.fc.protected' : typeKey });
  L.field('dis.wifi.duration', '44 µs', () => w.u16(44), { note: 'dis.wifi.duration.n', example: true });
  L.field('dis.wifi.rx', rx.macText, () => w.raw(rx.mac), { example: rx.macExample });
  L.field('dis.wifi.tx', tx.macText, () => w.raw(tx.mac), { example: tx.macExample });
  L.field('dis.wifi.bssid', bssid.macText, () => w.raw(bssid.mac), { note: 'dis.wifi.bssid.n', example: bssid.macExample });
  L.field('dis.wifi.seq', String(seq), () => w.u16(seq << 4), { note: 'dis.wifi.seq.n', example: true });
  return L.done();
}

export interface IpInfo {
  src: Addr;
  dst: Addr;
  srcIp: number[];
  dstIp: number[];
  proto: number;
  ttl: number;
  ident: number;
}

export const IP_PROTO_NAME: Record<number, string> = { 1: 'ICMP', 6: 'TCP', 17: 'UDP', 50: 'ESP', 58: 'ICMPv6' };

/** IPv4 header. Total length and checksum are patched by `finishIPv4` once the payload is written. */
export function ipv4(w: ByteWriter, o: IpInfo, srcText: string, dstText: string): { layer: Layer; finish: () => void } {
  const L = new LayerBuilder(w, 'ipv4', 'IPv4', `${srcText} → ${dstText}`);
  const start = w.pos;
  L.field('dis.ipv4.vihl', '4, 20 bytes', () => w.u8(0x45), { note: 'dis.ipv4.vihl.n' });
  L.field('dis.ipv4.dscp', '0, 0', () => w.u8(0), { note: 'dis.ipv4.dscp.n' });
  const lenF = L.field('dis.ipv4.len', '', () => w.u16(0), { note: 'dis.ipv4.len.n' });
  L.field('dis.ipv4.id', hex(o.ident), () => w.u16(o.ident), { note: 'dis.ipv4.id.n', example: true });
  L.field('dis.ipv4.flags', 'DF', () => w.u16(0x4000), { note: 'dis.ipv4.flags.n' });
  L.field('dis.ipv4.ttl', String(o.ttl), () => w.u8(o.ttl), { note: 'dis.ipv4.ttl.n' });
  L.field('dis.ipv4.proto', `${o.proto} (${IP_PROTO_NAME[o.proto] ?? '?'})`, () => w.u8(o.proto));
  const sumF = L.field('dis.ipv4.sum', '', () => w.u16(0), { note: 'dis.ipv4.sum.n' });
  L.field('dis.ipv4.src', srcText, () => w.raw(o.srcIp), { example: o.src.ipExample });
  L.field('dis.ipv4.dst', dstText, () => w.raw(o.dstIp), { example: o.dst.ipExample });
  const layer = L.done();
  const finish = () => {
    const total = w.pos - start;
    w.set16(lenF.offset, total);
    lenF.value = `${total} bytes`;
    const sum = inetChecksum(w.bytes.slice(start, start + 20));
    w.set16(sumF.offset, sum);
    sumF.value = hex(sum);
  };
  return { layer, finish };
}

export function ipv6(w: ByteWriter, o: IpInfo, srcText: string, dstText: string): { layer: Layer; finish: () => void } {
  const L = new LayerBuilder(w, 'ipv6', 'IPv6', `${srcText} → ${dstText}`);
  const start = w.pos;
  L.field('dis.ipv6.vtf', '6, 0, 0', () => w.u32(0x60000000), { note: 'dis.ipv6.vtf.n' });
  const lenF = L.field('dis.ipv6.plen', '', () => w.u16(0), { note: 'dis.ipv6.plen.n' });
  L.field('dis.ipv6.next', `${o.proto} (${IP_PROTO_NAME[o.proto] ?? '?'})`, () => w.u8(o.proto), { note: 'dis.ipv6.next.n' });
  L.field('dis.ipv6.hop', String(o.ttl), () => w.u8(o.ttl), { note: 'dis.ipv6.hop.n' });
  L.field('dis.ipv6.src', srcText, () => w.raw(o.srcIp), { example: o.src.ipExample });
  L.field('dis.ipv6.dst', dstText, () => w.raw(o.dstIp), { example: o.dst.ipExample });
  const layer = L.done();
  const finish = () => {
    const plen = w.pos - start - 40;
    w.set16(lenF.offset, plen);
    lenF.value = `${plen} bytes`;
  };
  return { layer, finish };
}

/** Pseudo-header for TCP/UDP/ICMPv6 checksums. */
export function pseudoHeader(srcIp: number[], dstIp: number[], proto: number, len: number): number[] {
  if (srcIp.length === 4) return [...srcIp, ...dstIp, 0, proto, len >>> 8, len & 0xff];
  return [...srcIp, ...dstIp, 0, 0, len >>> 8, len & 0xff, 0, 0, 0, proto];
}

export interface TcpInfo {
  srcPort: number;
  dstPort: number;
  seqRel: number;
  ackRel: number | null;
  isn: number;
  peerIsn: number;
  flags: string[];
  window: number;
  windowExample: boolean;
  syn: boolean;
  mss: number;
}

const FLAG_BITS: Record<string, number> = { FIN: 0x01, SYN: 0x02, RST: 0x04, PSH: 0x08, ACK: 0x10, URG: 0x20 };

export function tcp(w: ByteWriter, o: TcpInfo): { layer: Layer; finish: (pseudo: (len: number) => number[]) => void } {
  const L = new LayerBuilder(w, 'tcp', 'TCP', `${o.srcPort} → ${o.dstPort}, ${o.flags.join(', ')}`);
  const start = w.pos;
  const optLen = o.syn ? 12 : 0;
  const hdr = 20 + optLen;
  L.field('dis.tcp.sport', String(o.srcPort), () => w.u16(o.srcPort), { note: o.srcPort >= 49152 ? 'dis.tcp.sport.eph' : undefined });
  L.field('dis.tcp.dport', String(o.dstPort), () => w.u16(o.dstPort), { note: o.dstPort >= 49152 ? 'dis.tcp.sport.eph' : undefined });
  const rawSeq = (o.isn + o.seqRel) >>> 0;
  L.field('dis.tcp.seq', `${o.seqRel} (raw ${rawSeq})`, () => w.u32(rawSeq), { note: o.syn ? 'dis.tcp.seq.syn' : 'dis.tcp.seq.n', example: true });
  const hasAck = o.flags.includes('ACK') && o.ackRel !== null;
  const rawAck = hasAck ? (o.peerIsn + (o.ackRel ?? 0)) >>> 0 : 0;
  L.field('dis.tcp.ack', hasAck ? `${o.ackRel} (raw ${rawAck})` : '0', () => w.u32(rawAck), { note: hasAck ? 'dis.tcp.ack.n' : 'dis.tcp.ack.none', example: hasAck });
  const bits = o.flags.reduce((a, f) => a | (FLAG_BITS[f] ?? 0), 0);
  L.field('dis.tcp.hlen', `${hdr} bytes`, () => w.u8((hdr / 4) << 4), { note: optLen ? 'dis.tcp.hlen.opts' : 'dis.tcp.hlen.n', vars: { n: String(optLen) } });
  L.field('dis.tcp.flags', `${hex(bits, 3)} (${o.flags.join(', ')})`, () => w.u8(bits), { note: flagNote(o.flags) });
  L.field('dis.tcp.win', String(o.window), () => w.u16(o.window), { note: 'dis.tcp.win.n', example: o.windowExample });
  const sumF = L.field('dis.tcp.sum', '', () => w.u16(0), { note: 'dis.tcp.sum.n' });
  L.field('dis.tcp.urg', '0', () => w.u16(0));
  if (o.syn) {
    L.group('dis.tcp.opts', (n) => `${n} bytes`, () => {
      L.field('dis.tcp.mss', `${o.mss} bytes`, () => w.raw([2, 4, o.mss >>> 8, o.mss & 0xff]), { note: 'dis.tcp.mss.n' });
      L.field('dis.tcp.nop', '1', () => w.u8(1), { note: 'dis.tcp.nop.n' });
      L.field('dis.tcp.ws', '× 256', () => w.raw([3, 3, 8]), { note: 'dis.tcp.ws.n' });
      L.field('dis.tcp.nop', '1', () => w.u8(1), { note: 'dis.tcp.nop.n' });
      L.field('dis.tcp.nop', '1', () => w.u8(1), { note: 'dis.tcp.nop.n' });
      L.field('dis.tcp.sack', 'yes', () => w.raw([4, 2]), { note: 'dis.tcp.sack.n' });
    });
  }
  const layer = L.done();
  const finish = (pseudo: (len: number) => number[]) => {
    const seg = w.bytes.slice(start);
    const sum = inetChecksum(pseudo(seg.length), seg);
    w.set16(sumF.offset, sum);
    sumF.value = hex(sum);
  };
  return { layer, finish };
}

function flagNote(flags: string[]): string | undefined {
  const k = [...flags].sort().join('+');
  return ({ SYN: 'dis.tcp.f.syn', 'ACK+SYN': 'dis.tcp.f.synack', ACK: 'dis.tcp.f.ack', 'ACK+FIN': 'dis.tcp.f.fin', 'ACK+PSH': 'dis.tcp.f.psh', RST: 'dis.tcp.f.rst', 'ACK+RST': 'dis.tcp.f.rst' } as Record<string, string>)[k];
}

export function udp(w: ByteWriter, srcPort: number, dstPort: number): { layer: Layer; finish: (pseudo: (len: number) => number[]) => void } {
  const L = new LayerBuilder(w, 'udp', 'UDP', `${srcPort} → ${dstPort}`);
  const start = w.pos;
  L.field('dis.udp.sport', String(srcPort), () => w.u16(srcPort), { note: srcPort >= 49152 ? 'dis.tcp.sport.eph' : undefined });
  L.field('dis.udp.dport', String(dstPort), () => w.u16(dstPort), { note: dstPort >= 49152 ? 'dis.tcp.sport.eph' : undefined });
  const lenF = L.field('dis.udp.len', '', () => w.u16(0), { note: 'dis.udp.len.n' });
  const sumF = L.field('dis.udp.sum', '', () => w.u16(0), { note: 'dis.udp.sum.n' });
  const layer = L.done();
  const finish = (pseudo: (len: number) => number[]) => {
    const len = w.pos - start;
    w.set16(lenF.offset, len);
    lenF.value = `${len} bytes`;
    const sum = inetChecksum(pseudo(len), w.bytes.slice(start)) || 0xffff;
    w.set16(sumF.offset, sum);
    sumF.value = hex(sum);
  };
  return { layer, finish };
}

export type { Field };
