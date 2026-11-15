// Addresses for the dissector: real ones from the scenario where it has them, stable examples otherwise.
import type { PNode, Packet, Protocol } from '../protocols/types';
import { hash } from './bytes';

const IPV4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/;
const MAC = /\b([0-9a-f]{2}(?::[0-9a-f]{2}){5})\b/i;
const IPV6 = /(?:^|[\s(])((?:[0-9a-f]{1,4})?(?::[0-9a-f]{0,4}){2,7})(?=$|[\s)/·])/i;

export interface Addr {
  /** 4 bytes (IPv4) or 16 bytes (IPv6). */
  ip: number[];
  ipText: string;
  ipExample: boolean;
  mac: number[];
  macText: string;
  macExample: boolean;
}

export function parseIPv4(s: string): number[] | null {
  const m = IPV4.exec(s);
  if (!m) return null;
  const b = m.slice(1, 5).map(Number);
  return b.every((x) => x <= 255) ? b : null;
}

export function parseIPv6(s: string): number[] | null {
  if (MAC.test(s)) return null;
  const m = IPV6.exec(s);
  if (!m || !m[1].includes('::') && m[1].split(':').length !== 8) return null;
  const [head, tail = ''] = m[1].split('::');
  const hs = head ? head.split(':') : [];
  const ts = m[1].includes('::') ? (tail ? tail.split(':') : []) : [];
  const groups = [...hs, ...Array(8 - hs.length - ts.length).fill('0'), ...ts];
  if (groups.length !== 8) return null;
  return groups.flatMap((g) => {
    const v = parseInt(g || '0', 16);
    return [v >>> 8, v & 0xff];
  });
}

export function ipv6Text(b: number[]): string {
  const g: number[] = [];
  for (let i = 0; i < 16; i += 2) g.push((b[i] << 8) | b[i + 1]);
  // Compress the longest run of zero groups.
  let best = -1, bestLen = 0;
  for (let i = 0; i < 8;) {
    if (g[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen && j - i > 1) { best = i; bestLen = j - i; }
    i = j;
  }
  const hx = (a: number[]) => a.map((x) => x.toString(16)).join(':');
  if (best < 0) return hx(g);
  return `${hx(g.slice(0, best))}::${hx(g.slice(best + bestLen))}`;
}

export const macText = (b: number[]) => b.map((x) => x.toString(16).padStart(2, '0')).join(':');

const CLIENT_KINDS = new Set(['laptop', 'phone', 'desktop', 'plc']);

/** Does any node in the scenario use IPv6? Then synthetic addresses are IPv6 too. */
function usesV6(p: Protocol): boolean {
  return p.nodes.some((n) => n.addr && parseIPv6(n.addr));
}

export function nodeAddr(p: Protocol, node: PNode | undefined, id: string): Addr {
  const a = node?.addr ?? '';
  const h = hash(`${p.id}:${id}`);
  const v6 = parseIPv6(a);
  const v4 = v6 ? null : parseIPv4(a);
  let ip: number[];
  let ipExample = false;
  if (v6) ip = v6;
  else if (v4) ip = v4;
  else if (usesV6(p)) {
    ip = [0x20, 0x01, 0x0d, 0xb8, 0, (h >>> 8) & 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10 + (h % 200)];
    ipExample = true;
  } else {
    ip = node && CLIENT_KINDS.has(node.kind) ? [192, 168, 1, 10 + (h % 200)] : [203, 0, 113, 20 + (h % 200)];
    ipExample = true;
  }
  const m = MAC.exec(a);
  const mac = m ? m[1].split(':').map((x) => parseInt(x, 16)) : [0x00, 0x00, 0x5e, 0x00, 0x53, (h >>> 4) & 0xff];
  return {
    ip,
    ipText: ip.length === 16 ? ipv6Text(ip) : ip.join('.'),
    ipExample,
    mac,
    macText: macText(mac),
    macExample: !m,
  };
}

export function nodeOf(p: Protocol, id: string): PNode | undefined {
  return p.nodes.find((n) => n.id === id);
}

/** The node that opened the conversation between two nodes (sent first): it uses the ephemeral port. */
export function initiator(p: Protocol, pk: Packet): string {
  const first = p.packets.find((x) => (x.from === pk.from && x.to === pk.to) || (x.from === pk.to && x.to === pk.from));
  return first?.from ?? pk.from;
}

export function ephemeralPort(p: Protocol, a: string, b: string): number {
  return 49152 + (hash(`${p.id}:${[a, b].sort().join('-')}`) % 16000);
}

/** The router a sender's frame goes to first, when the scenario has one in between. */
export function firstHop(p: Protocol, pk: Packet): PNode | undefined {
  if (nodeOf(p, pk.from)?.kind === 'router' || nodeOf(p, pk.to)?.kind === 'router') return undefined;
  const linked = p.links.filter(([x, y]) => x === pk.from || y === pk.from).map(([x, y]) => (x === pk.from ? y : x));
  if (linked.includes(pk.to)) return undefined;
  return linked.map((id) => nodeOf(p, id)).find((n) => n && (n.kind === 'router' || n.kind === 'firewall' || n.kind === 'ap'));
}
