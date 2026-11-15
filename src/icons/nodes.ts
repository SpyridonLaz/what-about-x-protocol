// Isometric line-art node icons, drawn in code (64×64 box). Colours come from CSS
// classes (.ic-s stroke, .ic-f / .ic-f2 / .ic-a fills) so both themes work.
import type { NodeKind } from '../protocols/types';

const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
type Pt = [number, number];

const f = (n: number) => Math.round(n * 10) / 10;
const pts = (p: Pt[]) => p.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const EX: Pt = [C30, S30];
const EY: Pt = [-C30, S30];

/** Corners of an isometric box whose bottom-centre sits at (cx, cy). */
function corners(cx: number, cy: number, w: number, d: number, h: number) {
  const c: Pt = [cx, cy];
  const b0 = add(c, add(mul(EX, -w / 2), mul(EY, -d / 2))); // back
  const b1 = add(b0, mul(EX, w)); // right
  const b2 = add(b1, mul(EY, d)); // front
  const b3 = add(b0, mul(EY, d)); // left
  const up = (p: Pt): Pt => [p[0], p[1] - h];
  return { b0, b1, b2, b3, t0: up(b0), t1: up(b1), t2: up(b2), t3: up(b3) };
}

/** Three visible faces of a box. */
function box(cx: number, cy: number, w: number, d: number, h: number, top = 'ic-f2'): string {
  const k = corners(cx, cy, w, d, h);
  return (
    `<polygon class="ic-f ic-s" points="${pts([k.t3, k.t2, k.b2, k.b3])}"/>` +
    `<polygon class="ic-f ic-s" points="${pts([k.t2, k.t1, k.b1, k.b2])}"/>` +
    `<polygon class="${top} ic-s" points="${pts([k.t0, k.t1, k.t2, k.t3])}"/>`
  );
}

/** A line on the right face (front-right) of a box at relative height r (0 bottom … 1 top). */
function rightLine(cx: number, cy: number, w: number, d: number, h: number, r: number, inset = 0.15): string {
  const k = corners(cx, cy, w, d, h);
  const y = h * r;
  const a = add(k.b2, mul(EX, w * inset));
  const b = add(k.b1, mul(EX, -w * inset));
  return `<line class="ic-s" x1="${f(a[0])}" y1="${f(a[1] - y)}" x2="${f(b[0])}" y2="${f(b[1] - y)}"/>`;
}

/** Small dot on the left face at (u along the face 0..1, r height 0..1). */
function leftDot(cx: number, cy: number, w: number, d: number, h: number, u: number, r: number, cls = 'ic-a'): string {
  const k = corners(cx, cy, w, d, h);
  const p = add(k.b3, mul(EX, w * u));
  return `<circle class="${cls}" cx="${f(p[0])}" cy="${f(p[1] - h * r)}" r="1.6"/>`;
}

function cylinder(cx: number, cy: number, rx: number, h: number, rings = 0): string {
  const ry = rx * 0.5;
  let out =
    `<path class="ic-f ic-s" d="M${cx - rx},${cy - h} L${cx - rx},${cy} A${rx},${ry} 0 0 0 ${cx + rx},${cy} L${cx + rx},${cy - h}"/>` +
    `<ellipse class="ic-f2 ic-s" cx="${cx}" cy="${cy - h}" rx="${rx}" ry="${ry}"/>`;
  for (let i = 1; i <= rings; i++) {
    const y = cy - (h * i) / (rings + 1);
    out += `<path class="ic-s" fill="none" d="M${cx - rx},${y} A${rx},${ry} 0 0 0 ${cx + rx},${y}"/>`;
  }
  return out;
}

const shadow = `<ellipse class="ic-shadow" cx="32" cy="52" rx="22" ry="7"/>`;

const ICONS: Record<NodeKind, () => string> = {
  server: () =>
    shadow + box(32, 52, 22, 22, 30) +
    [0.25, 0.5, 0.75].map((r) => rightLine(32, 52, 22, 22, 30, r)).join('') +
    leftDot(32, 52, 22, 22, 30, 0.3, 0.8) + leftDot(32, 52, 22, 22, 30, 0.3, 0.55, 'ic-ok'),
  dns: () =>
    shadow + box(32, 52, 24, 20, 9) + box(32, 42, 24, 20, 9) + box(32, 32, 24, 20, 9) +
    leftDot(32, 52, 24, 20, 9, 0.25, 0.5) + leftDot(32, 42, 24, 20, 9, 0.25, 0.5) + leftDot(32, 32, 24, 20, 9, 0.25, 0.5, 'ic-ok'),
  router: () =>
    shadow + box(32, 50, 30, 18, 9) +
    `<line class="ic-s" x1="22" y1="34" x2="20" y2="20"/><line class="ic-s" x1="42" y1="34" x2="44" y2="20"/>` +
    `<circle class="ic-a" cx="20" cy="19" r="1.8"/><circle class="ic-a" cx="44" cy="19" r="1.8"/>` +
    leftDot(32, 50, 30, 18, 9, 0.2, 0.5, 'ic-ok') + leftDot(32, 50, 30, 18, 9, 0.35, 0.5) + leftDot(32, 50, 30, 18, 9, 0.5, 0.5),
  switch: () =>
    shadow + box(32, 48, 36, 16, 7) +
    [0.15, 0.3, 0.45, 0.6, 0.75].map((u) => leftDot(32, 48, 36, 16, 7, u, 0.5)).join(''),
  ap: () =>
    shadow + box(32, 50, 18, 18, 8) +
    `<path class="ic-s" fill="none" d="M24,30 Q32,22 40,30"/><path class="ic-s" fill="none" d="M20,26 Q32,14 44,26"/>` +
    `<circle class="ic-a" cx="32" cy="34" r="2"/>`,
  laptop: () =>
    shadow + box(32, 52, 26, 18, 3) +
    (() => {
      const k = corners(32, 49, 26, 18, 0);
      const top = (p: Pt): Pt => [p[0], p[1] - 20];
      return `<polygon class="ic-f2 ic-s" points="${pts([k.b0, k.b1, top(k.b1), top(k.b0)])}"/>` +
        `<polygon class="ic-screen" points="${pts([add(k.b0, [2, -3]), add(k.b1, [-2, -2]), add(top(k.b1), [-2, 3]), add(top(k.b0), [2, 3])])}"/>`;
    })(),
  phone: () =>
    shadow + box(32, 52, 8, 16, 34) +
    (() => {
      const k = corners(32, 52, 8, 16, 34);
      return `<polygon class="ic-screen" points="${pts([add(k.t3, [1, 4]), add(k.t2, [1, 4]), add(k.b2, [1, -4]), add(k.b3, [1, -4])])}"/>`;
    })(),
  desktop: () =>
    shadow + box(32, 52, 12, 8, 4) + `<line class="ic-s" x1="32" y1="46" x2="32" y2="38"/>` + box(32, 38, 30, 4, 22) +
    rightLine(32, 38, 30, 4, 22, 0.5, 0.3),
  cloud: () =>
    `<path class="ic-f2 ic-s" d="M17,44 a9,9 0 0 1 2,-17.6 a13,13 0 0 1 24.5,-3.4 a10,10 0 0 1 4.5,21 Z"/>` +
    `<circle class="ic-s" fill="none" cx="32" cy="36" r="7"/><path class="ic-s" fill="none" d="M25,36 h14 M32,29 c-4,4 -4,10 0,14 c4,-4 4,-10 0,-14"/>`,
  mail: () =>
    shadow + box(32, 52, 22, 22, 26) +
    (() => {
      const k = corners(32, 52, 22, 22, 26);
      const a = add(k.b3, [3, -8]);
      const b = add(k.b2, [-3, -8]);
      const c = add(k.b2, [-3, -20]);
      const d = add(k.b3, [3, -20]);
      const mid = [(a[0] + b[0]) / 2, (c[1] + b[1]) / 2 + 1] as Pt;
      return `<polygon class="ic-f2 ic-s" points="${pts([a, b, c, d])}"/><polyline class="ic-s" fill="none" points="${pts([d, mid, c])}"/>`;
    })(),
  db: () => shadow + cylinder(32, 50, 16, 26, 2),
  vectordb: () =>
    shadow + cylinder(32, 50, 16, 26, 1) +
    `<circle class="ic-a" cx="26" cy="40" r="1.6"/><circle class="ic-a" cx="31" cy="44" r="1.6"/><circle class="ic-a" cx="37" cy="39" r="1.6"/>` +
    `<line class="ic-s" x1="26" y1="40" x2="31" y2="44"/><line class="ic-s" x1="31" y1="44" x2="37" y2="39"/>`,
  files: () =>
    shadow + box(32, 52, 22, 22, 26) +
    (() => {
      const k = corners(32, 52, 22, 22, 26);
      const a = add(k.b3, [3, -8]);
      const b = add(k.b2, [-3, -8]);
      return `<polygon class="ic-f2 ic-s" points="${pts([a, b, add(b, [0, -11]), add(a, [7, -15]), add(a, [3, -17]), add(a, [0, -15])])}"/>`;
    })(),
  firewall: () =>
    shadow + box(32, 52, 30, 10, 24, 'ic-f2') +
    [0.33, 0.66].map((r) => {
      const k = corners(32, 52, 30, 10, 24);
      const y = 24 * r;
      return `<line class="ic-s" x1="${f(k.b3[0])}" y1="${f(k.b3[1] - y)}" x2="${f(k.b2[0])}" y2="${f(k.b2[1] - y)}"/>`;
    }).join('') +
    `<path class="ic-warn" d="M44,20 q4,-6 0,-11 q8,5 3,13 Z"/>`,
  proxy: () =>
    shadow + box(32, 52, 24, 24, 20) +
    `<path class="ic-s" fill="none" d="M18,18 h24 m-5,-4 l5,4 l-5,4"/><path class="ic-s" fill="none" d="M46,26 h-24 m5,-4 l-5,4 l5,4"/>`,
  vpn: () =>
    shadow + box(32, 52, 24, 24, 18) +
    `<path class="ic-f2 ic-s" d="M32,8 l11,4 v8 c0,7 -5,11 -11,13 c-6,-2 -11,-6 -11,-13 v-8 Z"/>` +
    `<rect class="ic-a" x="28.5" y="17" width="7" height="6" rx="1"/><path class="ic-s" fill="none" d="M30,17 v-2 a2,2 0 0 1 4,0 v2"/>`,
  clock: () =>
    shadow + box(32, 52, 20, 20, 8) +
    `<circle class="ic-f2 ic-s" cx="32" cy="24" r="13"/><path class="ic-s" fill="none" d="M32,15 v9 l6,4"/>`,
  auth: () =>
    shadow + box(32, 52, 22, 22, 22) +
    `<circle class="ic-f2 ic-s" cx="26" cy="14" r="5"/><path class="ic-s" fill="none" d="M30,17 l10,7 m-3,-2 l-2,3 m5,-0.5 l-2,3"/>`,
  plc: () =>
    shadow + box(32, 52, 30, 14, 20) +
    [0.2, 0.4, 0.6, 0.8].map((u) => leftDot(32, 52, 30, 14, 20, u, 0.7, u === 0.2 ? 'ic-ok' : 'ic-a')).join('') +
    rightLine(32, 52, 30, 14, 20, 0.35, 0.1),
  llm: () =>
    shadow + box(32, 52, 26, 26, 12) +
    `<path class="ic-ai" d="M32,8 l2.6,7.4 l7.4,2.6 l-7.4,2.6 l-2.6,7.4 l-2.6,-7.4 l-7.4,-2.6 l7.4,-2.6 Z"/>` +
    `<path class="ic-ai" d="M44,8 l1.2,3 l3,1.2 l-3,1.2 l-1.2,3 l-1.2,-3 l-3,-1.2 l3,-1.2 Z"/>`,
  agent: () =>
    shadow + box(32, 52, 20, 20, 8) +
    `<rect class="ic-f2 ic-s" x="20" y="16" width="24" height="20" rx="5"/>` +
    `<circle class="ic-ai" cx="27" cy="26" r="2.4"/><circle class="ic-ai" cx="37" cy="26" r="2.4"/>` +
    `<line class="ic-s" x1="32" y1="16" x2="32" y2="10"/><circle class="ic-a" cx="32" cy="9" r="2"/>`,
  tool: () =>
    shadow + box(32, 52, 22, 22, 14) +
    `<path class="ic-f2 ic-s" d="M23,30 l12,-12 a6,6 0 0 1 8,-6 l-4,4 l1,3 l3,1 l4,-4 a6,6 0 0 1 -6,8 l-12,12 a2.8,2.8 0 0 1 -6,-6 Z"/>`,
  app: () =>
    shadow + box(32, 52, 24, 6, 28) +
    (() => {
      const k = corners(32, 52, 24, 6, 28);
      return `<line class="ic-s" x1="${f(k.t3[0])}" y1="${f(k.t3[1] + 5)}" x2="${f(k.t2[0])}" y2="${f(k.t2[1] + 5)}"/>` +
        `<circle class="ic-a" cx="${f(k.t3[0] + 3)}" cy="${f(k.t3[1] + 3)}" r="1.1"/>`;
    })() +
    `<path class="ic-ai" d="M45,10 l1.5,4 l4,1.5 l-4,1.5 l-1.5,4 l-1.5,-4 l-4,-1.5 l4,-1.5 Z"/>`,
  tokens: () =>
    shadow + box(21, 43, 13, 13, 9) + box(43, 43, 13, 13, 9) + box(32, 52, 13, 13, 9, 'ic-ai'),
  layers: () =>
    shadow + box(32, 52, 28, 28, 5) + box(32, 42, 28, 28, 5) + box(32, 32, 28, 28, 5, 'ic-ai'),
  sampler: () =>
    shadow + box(32, 52, 26, 26, 8) +
    `<rect class="ic-a" x="21" y="22" width="5.5" height="9"/><rect class="ic-ai" x="29.2" y="10" width="5.5" height="21"/><rect class="ic-a" x="37.5" y="25" width="5.5" height="6"/>`,
};

export function nodeIcon(kind: NodeKind): string {
  const body = (ICONS[kind] ?? ICONS.server)();
  return `<svg class="node-icon" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}

export const NODE_KINDS = Object.keys(ICONS) as NodeKind[];
