import { AI } from './ai';
import { INFRA } from './infra';
import { MAIL_FILE } from './mail-file';
import { NAMING } from './naming';
import { PROXY_VPN } from './proxy-vpn';
import { REMOTE_SECURITY } from './remote-security';
import { TRANSPORT } from './transport';
import type { Family, Protocol } from './types';
import { WEB } from './web';
import { WIRELESS_REALTIME } from './wireless-realtime';

export const PROTOCOLS: Protocol[] = [
  ...WEB,
  ...TRANSPORT,
  ...NAMING,
  ...MAIL_FILE,
  ...REMOTE_SECURITY,
  ...WIRELESS_REALTIME,
  ...PROXY_VPN,
  ...INFRA,
  ...AI,
];

const INDEX = new Map(PROTOCOLS.map((p) => [p.id, p]));

export function byId(id: string): Protocol | undefined {
  return INDEX.get(id);
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[\s\-_/.]+/g, '');

/**
 * Rank protocols for a query. Matches id, short label, tags, and the (translated) name and family.
 * Empty query returns everything in catalogue order.
 */
export function searchProtocols(
  query: string,
  nameOf: (id: string) => string,
  familyOf: (f: Family) => string,
): Protocol[] {
  const q = norm(query);
  if (!q) return PROTOCOLS;
  const scored: [number, Protocol][] = [];
  for (const p of PROTOCOLS) {
    const short = norm(p.short);
    const id = norm(p.id);
    let score = 0;
    if (short === q || id === q) score = 100;
    else if (short.startsWith(q) || id.startsWith(q)) score = 80;
    else if (short.includes(q) || id.includes(q)) score = 60;
    else if (norm(nameOf(p.id)).includes(q)) score = 40;
    else if ((p.tags ?? []).some((tag) => norm(tag).includes(q))) score = 30;
    else if (norm(familyOf(p.family)).includes(q)) score = 20;
    if (score) scored.push([score, p]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, p]) => p);
}
