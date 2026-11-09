// Sequence diagram: one lifeline per node that sends or receives, one arrow per packet.
import { caps, locale, t } from '../i18n/i18n';
import { famVar, packetFamily } from '../protocols/colors';
import { s } from '../ui/dom';
import { formatTime, packetState, focusIndex, type ViewCtx } from './context';

const COL = 150;
const ROW = 40;
const HEAD = 64;
const SIDE = 80;

export function SequenceView(container: HTMLElement, ctx: ViewCtx): () => void {
  const p = ctx.protocol;
  const used = new Set(p.packets.flatMap((pk) => [pk.from, pk.to]));
  const cols = p.nodes.filter((nd) => used.has(nd.id)).sort((a, b) => a.x - b.x || a.y - b.y);
  const colX = new Map(cols.map((nd, i) => [nd.id, SIDE + i * COL]));
  const w = SIDE * 2 + (cols.length - 1) * COL;
  const h = HEAD + p.packets.length * ROW + 24;

  const scroller = document.createElement('div');
  scroller.className = 'seq-scroll';
  const svg = s('svg', { class: 'seq', viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img', 'aria-label': t('ui.sequence'), dir: 'ltr' });

  for (const nd of cols) {
    const x = colX.get(nd.id)!;
    svg.append(
      s('line', { class: 'seq-life', x1: x, y1: HEAD - 8, x2: x, y2: h - 8 }),
      s('rect', { class: 'seq-head', x: x - 64, y: 8, width: 128, height: 40, rx: 4 }),
      s('text', { class: 'seq-head-label', x, y: 26, 'text-anchor': 'middle' }, caps(t(`node.${nd.label}`))),
      s('text', { class: 'seq-head-addr', x, y: 40, 'text-anchor': 'middle' }, nd.addr ?? ''),
    );
  }

  const arrows = p.packets.map((pk, i) => {
    const y = HEAD + i * ROW + ROW / 2;
    const x1 = colX.get(pk.from) ?? SIDE;
    const x2 = colX.get(pk.to) ?? SIDE;
    const dir = x2 >= x1 ? 1 : -1;
    const xEnd = x2 - 8 * dir;
    const len = Math.abs(xEnd - x1);
    const g = s('g', { class: 'seq-msg' });
    g.style.setProperty('--pkt', famVar(packetFamily(pk.proto, p)));
    const line = s('line', { class: 'seq-line', x1, y1: y, x2: xEnd, y2: y });
    line.style.strokeDasharray = `${len}`;
    const head = s('path', { class: 'seq-head-arrow', d: `M${x2},${y} l${-9 * dir},-5 l0,10 z` });
    const maxChars = Math.max(12, Math.floor((Math.max(len, COL) - 16) / 6.6));
    const label = `${pk.proto} · ${pk.info}`;
    const short = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
    const tx = (x1 + x2) / 2;
    const text = s('text', { class: 'seq-text', x: tx, y: y - 6, 'text-anchor': 'middle' }, short);
    const title = s('title', {}, label);
    const time = s('text', { class: 'seq-time', x: 8, y: y + 4 }, formatTime(pk.t, locale()));
    g.append(title, line, head, text, time);
    g.addEventListener('click', () => ctx.player.seek(i));
    svg.append(g);
    return { g, line, len, y };
  });

  scroller.append(svg);
  container.append(scroller);

  let lastFocus = -2;
  const draw = () => {
    const st = ctx.player.get();
    arrows.forEach(({ g, line, len }, i) => {
      const state = packetState(i, st);
      const inFlight = state === 'current' && st.playing;
      g.setAttribute('class', `seq-msg is-${state}${inFlight ? ' is-flying' : ''}`);
      line.style.strokeDashoffset = inFlight ? `${len * (1 - st.progress)}` : '0';
    });
    const f = focusIndex(st);
    if (f !== lastFocus && f >= 0) {
      lastFocus = f;
      const y = arrows[f].y;
      const top = scroller.scrollTop;
      const vh = scroller.clientHeight;
      if (y < top + 40 || y > top + vh - 40) scroller.scrollTo({ top: Math.max(0, y - vh / 2), behavior: 'smooth' });
    }
  };
  draw();
  return ctx.player.sub(draw);
}
