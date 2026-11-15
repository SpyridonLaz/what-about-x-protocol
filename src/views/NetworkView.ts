// Animated network diagram: nodes on a grid, links, and the packet travelling along the
// shortest link path between source and destination.
import { caps, t } from '../i18n/i18n';
import { nodeIcon } from '../icons/nodes';
import { famVar, packetFamily } from '../protocols/colors';
import type { PNode, Protocol } from '../protocols/types';
import { s, svgFromString } from '../ui/dom';
import type { ViewCtx } from './context';

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const CELL = 80;
const PAD = 40;

type Pt = [number, number];

export function nodeCenter(n: PNode): Pt {
  return [n.x * CELL + PAD, n.y * CELL + PAD];
}

/** Shortest path of node ids over the links (BFS). Falls back to a direct hop. */
export function route(p: Protocol, from: string, to: string): string[] {
  if (from === to) return [from];
  const adj = new Map<string, string[]>();
  for (const [a, b] of p.links) {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const nb of adj.get(cur) ?? []) {
      if (!prev.has(nb)) {
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  if (!prev.has(to)) return [from, to];
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

/** Point at fraction `f` (0..1) along a polyline. */
export function along(points: Pt[], f: number): Pt {
  if (points.length === 1) return points[0];
  const segs = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, d / segs[i]) : 1;
      const [a, b] = [points[i], points[i + 1]];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    d -= segs[i];
  }
  return points[points.length - 1];
}

/**
 * Isometric "blueprint floor": two families of lines at ±30° plus faint verticals, fading
 * out towards the edges. It extends far beyond the viewBox so letterboxed space is covered
 * too (the panel clips it).
 */
function isoFloor(x: number, y: number, w: number, h: number): SVGGElement {
  const tile = 56;
  const th = +(tile * Math.tan(Math.PI / 6)).toFixed(2); // 30° slope
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pad = 2000;
  const defs = s('defs', {},
    s('pattern', { id: 'iso-grid', width: tile, height: th * 2, patternUnits: 'userSpaceOnUse', x: cx, y: cy },
      s('path', { class: 'iso-line', d: `M0,0 L${tile},${th} M0,${th} L${tile},${th * 2} M0,${th} L${tile},0 M0,${th * 2} L${tile},${th}` }),
      s('path', { class: 'iso-line iso-v', d: `M0,0 V${th * 2}` })),
    s('radialGradient', { id: 'iso-fade', gradientUnits: 'userSpaceOnUse', cx, cy, r: Math.max(w, h) * 0.75 },
      s('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '1' }),
      s('stop', { offset: '0.6', 'stop-color': '#fff', 'stop-opacity': '0.55' }),
      s('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0' })),
    s('mask', { id: 'iso-mask', maskUnits: 'userSpaceOnUse', x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2 },
      s('rect', { x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2, fill: 'url(#iso-fade)' })),
  );
  const floor = s('rect', { class: 'iso-floor', x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2, fill: 'url(#iso-grid)', mask: 'url(#iso-mask)' });
  return s('g', { class: 'net-floor', 'aria-hidden': 'true' }, defs, floor);
}

export function NetworkView(container: HTMLElement, ctx: ViewCtx): () => void {
  const p = ctx.protocol;
  const byId = new Map(p.nodes.map((nd) => [nd.id, nd]));
  // Fit the view to the nodes, with room for icons above and labels below/beside.
  const xs = p.nodes.map((nd) => nodeCenter(nd)[0]);
  const ys = p.nodes.map((nd) => nodeCenter(nd)[1]);
  const x0 = Math.min(...xs) - 95;
  const x1 = Math.max(...xs) + 95;
  const y0 = Math.min(...ys) - (p.zones?.length ? 80 : 62);
  const y1 = Math.max(...ys) + 58;

  const svg = s('svg', { class: 'net', viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, role: 'img', 'aria-label': t('ui.network'), dir: 'ltr' });
  svg.append(isoFloor(x0, y0, x1 - x0, y1 - y0));
  const zoneLayer = s('g', { class: 'net-zones', 'aria-hidden': 'true' });
  // Zones: a dashed frame around the nodes that belong together (who runs what).
  for (const z of p.zones ?? []) {
    const cs = z.nodes.map((id) => byId.get(id)).filter((nd): nd is PNode => !!nd).map(nodeCenter);
    if (!cs.length) continue;
    const zx0 = Math.min(...cs.map((c) => c[0])) - 84;
    const zx1 = Math.max(...cs.map((c) => c[0])) + 84;
    const zy0 = Math.min(...cs.map((c) => c[1])) - 56;
    const zy1 = Math.max(...cs.map((c) => c[1])) + 56;
    zoneLayer.append(
      s('rect', { class: 'net-zone', x: zx0, y: zy0, width: zx1 - zx0, height: zy1 - zy0, rx: 10 }),
      s('text', { class: 'net-zone-label', x: zx0 + 6, y: zy0 - 7 }, caps(t(`zone.${z.label}`))),
    );
  }
  const linkLayer = s('g', { class: 'net-links' });
  const nodeLayer = s('g', { class: 'net-nodes' });
  const pktLayer = s('g', { class: 'net-packets' });
  svg.append(zoneLayer, linkLayer, nodeLayer, pktLayer);

  const linkEls = new Map<string, SVGLineElement>();
  /** Node id each line starts at (x1,y1). */
  const linkDir = new Map<SVGLineElement, string>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const [a, b] of p.links) {
    const na = byId.get(a);
    const nb = byId.get(b);
    if (!na || !nb) continue;
    const [x1, y1] = nodeCenter(na);
    const [x2, y2] = nodeCenter(nb);
    const line = s('line', { class: 'net-link', x1, y1, x2, y2 });
    linkEls.set(key(a, b), line);
    linkDir.set(line, a);
    linkLayer.append(line);
  }

  const nodeEls = new Map<string, SVGGElement>();
  for (const nd of p.nodes) {
    const [cx, cy] = nodeCenter(nd);
    const g = s('g', { class: `net-node kind-${nd.kind}`, transform: `translate(${cx} ${cy})` });
    g.append(s('circle', { class: 'net-ring', cx: 0, cy: -8, r: 30 }));
    const ic = svgFromString(nodeIcon(nd.kind));
    ic.setAttribute('x', '-34');
    ic.setAttribute('y', '-44');
    ic.setAttribute('width', '68');
    ic.setAttribute('height', '68');
    g.append(ic, s('text', { class: 'net-label', x: 0, y: 34, 'text-anchor': 'middle' }, caps(t(`node.${nd.label}`))));
    if (nd.addr) g.append(s('text', { class: 'net-addr', x: 0, y: 48, 'text-anchor': 'middle' }, nd.addr));
    nodeEls.set(nd.id, g);
    nodeLayer.append(g);
  }

  const dot = s('circle', { class: 'net-packet', r: 7 });
  const halo = s('circle', { class: 'net-packet-halo', r: 14 });
  const tag = s('text', { class: 'net-packet-tag', 'text-anchor': 'middle' });
  const pkt = s('g', { class: 'net-packet-g', visibility: 'hidden' }, halo, dot, tag);
  // Comet tail: fading dots that follow the packet along its path.
  const TRAIL = 6;
  const trail = Array.from({ length: TRAIL }, (_, k) => s('circle', { class: 'net-trail', r: (6 - k * 0.7).toFixed(1), opacity: (0.42 - k * 0.065).toFixed(2), visibility: 'hidden' }));
  pktLayer.append(...trail, pkt);

  container.append(svg);

  const routes = p.packets.map((pk) => route(p, pk.from, pk.to));

  const draw = () => {
    const st = ctx.player.get();
    let i: number;
    let prog: number;
    // In flight while playing, or paused mid-flight (progress kept): show the next packet on its way.
    if ((st.playing || st.progress > 0) && st.index < st.count - 1) {
      i = st.index + 1;
      // Reduced motion: same timing, but the packet appears at its destination instead of gliding.
      prog = reducedMotion() ? 1 : st.progress;
    } else {
      i = st.index;
      prog = 1;
    }
    linkEls.forEach((l) => l.classList.remove('is-hot', 'is-rev'));
    nodeEls.forEach((g) => g.classList.remove('is-src', 'is-dst', 'is-arrived'));
    if (i < 0) {
      pkt.setAttribute('visibility', 'hidden');
      trail.forEach((c) => c.setAttribute('visibility', 'hidden'));
      return;
    }
    const pk = p.packets[i];
    const path = routes[i];
    const pts = path.map((id) => nodeCenter(byId.get(id)!));
    const [x, y] = along(pts, prog);
    const color = famVar(packetFamily(pk.proto, p));
    pkt.setAttribute('visibility', 'visible');
    svg.style.setProperty('--pkt', color);
    pkt.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    tag.textContent = pk.proto;
    tag.setAttribute('y', '-14');
    trail.forEach((c, k) => {
      const f = prog - (k + 1) * 0.035;
      const show = prog < 1 && f > 0;
      c.setAttribute('visibility', show ? 'visible' : 'hidden');
      if (show) {
        const [tx, ty] = along(pts, f);
        c.setAttribute('cx', tx.toFixed(1));
        c.setAttribute('cy', ty.toFixed(1));
      }
    });
    for (let k = 0; k < path.length - 1; k++) {
      const el = linkEls.get(key(path[k], path[k + 1]));
      el?.classList.add('is-hot');
      // Lines are drawn from the smaller id to the larger one; the dash flow follows the packet.
      if (el && linkDir.get(el) !== path[k]) el.classList.add('is-rev');
    }
    nodeEls.get(pk.from)?.classList.add('is-src');
    nodeEls.get(pk.to)?.classList.add('is-dst');
    if (prog >= 1) nodeEls.get(pk.to)?.classList.add('is-arrived');
  };

  draw();
  return ctx.player.sub(draw);
}
