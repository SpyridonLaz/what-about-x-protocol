// Language-neutral structure of a protocol entry. English text sits next to it in `text`
// (the source for every other locale); translations live in src/i18n/messages/<locale>.json.

export type Family =
  | 'web' | 'transport' | 'network' | 'naming' | 'mail' | 'file' | 'remote' | 'security'
  | 'wireless' | 'proxy' | 'vpn' | 'realtime' | 'infra' | 'ai';

export const FAMILIES: Family[] = [
  'web', 'transport', 'network', 'naming', 'mail', 'file', 'remote', 'security',
  'wireless', 'proxy', 'vpn', 'realtime', 'infra', 'ai',
];

export type NodeKind =
  | 'laptop' | 'phone' | 'desktop' | 'router' | 'switch' | 'ap' | 'cloud' | 'server' | 'dns'
  | 'mail' | 'db' | 'files' | 'firewall' | 'proxy' | 'vpn' | 'clock' | 'auth' | 'plc'
  | 'llm' | 'agent' | 'tool' | 'vectordb' | 'app';

export type Layer = 'l7' | 'l6' | 'l5' | 'l4' | 'l3' | 'l2' | 'l7p' | 'mixed';

export interface PNode {
  id: string;
  kind: NodeKind;
  /** Key in the `node.*` dictionary (translated), e.g. 'client' → node.client. */
  label: string;
  /** Address or identifier shown under the label; never translated. */
  addr?: string;
  /** Grid position: x 0..12, y 0..6. */
  x: number;
  y: number;
}

export interface Packet {
  /** Seconds since scenario start. */
  t: number;
  from: string;
  to: string;
  /** Protocol label shown in the table (DNS, TCP, HTTP, JSON-RPC…). */
  proto: string;
  /** Wire-level summary; never translated. */
  info: string;
  /** Bytes on the wire (approximate, for teaching). */
  size: number;
  /** 0-based stage index. */
  stage: number;
}

export interface ProtocolText {
  /** Expanded name, e.g. "Hypertext Transfer Protocol". */
  name: string;
  desc: string;
  /** Data format fact, e.g. "Text (headers + optional body)". */
  format: string;
  /** One [title, subtitle] pair per stage. */
  stages: [string, string][];
}

export interface Protocol {
  id: string;
  /** Short label, e.g. "HTTP". Never translated. */
  short: string;
  family: Family;
  kind: 'protocol' | 'pattern';
  facts: {
    layer: Layer;
    port: string;
    transport: string;
    methods?: string;
    spec: string;
  };
  nodes: PNode[];
  links: [string, string][];
  packets: Packet[];
  text: ProtocolText;
  /** Extra search terms (not shown). */
  tags?: string[];
}

/** Compact packet tuple used when authoring: [t, from, to, proto, info, size, stage]. */
export type PT = [number, string, string, string, string, number, number];

export function n(id: string, kind: NodeKind, label: string, addr: string | undefined, x: number, y: number): PNode {
  return { id, kind, label, addr, x, y };
}

export function definePackets(list: PT[]): Packet[] {
  return list.map(([t, from, to, proto, info, size, stage]) => ({ t, from, to, proto, info, size, stage }));
}
