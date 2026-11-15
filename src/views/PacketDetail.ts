// Packet detail ("dissector"): every layer and field of one message, with a linked hex dump.
// Replaces the main area while open. It follows the player, so ‹ › and ← → move it along.
import { dissect, type Field, type Layer } from '../dissect';
import { caps, locale, t } from '../i18n/i18n';
import { famVar, packetFamily } from '../protocols/colors';
import type { Packet, Protocol } from '../protocols/types';
import { IconButton } from '../ui/components';
import { clear, h } from '../ui/dom';
import { focusIndex, formatSize, formatTime, type ViewCtx } from './context';

const DUMP_LIMIT = 4096;

/** Colour per layer kind, so the layer bar, section borders and hex bytes match. */
function layerColor(l: Layer, pkColor: string): string {
  if (l.id === 'eth' || l.id === 'wifi') return 'var(--fam-infra)';
  if (l.id === 'ipv4' || l.id === 'ipv6') return 'var(--fam-network)';
  if (l.id === 'tcp' || l.id === 'udp') return 'var(--fam-transport)';
  if (l.id.startsWith('tls')) return 'var(--fam-security)';
  return pkColor;
}

/** Short title for a message, e.g. "SYN, ACK" or "GET /index.html". */
export function messageTitle(pk: Packet): string {
  if (pk.proto === 'TCP') {
    const f = /\[([A-Z, ]+)\]/.exec(pk.info)?.[1];
    if (f && /^(SYN|ACK|FIN|RST|PSH|URG)(, ?(SYN|ACK|FIN|RST|PSH|URG))*$/.test(f)) return f;
  }
  const s = pk.info.split(/\s{2,}|\s[(—]|:\s(?=[A-Z{])/)[0].trim();
  return s.length > 48 ? s.slice(0, 47) + '…' : s;
}

const tr = (vars?: Record<string, string>) => (vars ? Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, t(v)])) : undefined);

export interface DetailHandle {
  el: HTMLElement;
  /** Focus the dialog's heading (on open). */
  focus(): void;
  destroy(): void;
}

export function PacketDetail(ctx: ViewCtx, onClose: () => void, onIndex: (i: number) => void): DetailHandle {
  const p = ctx.protocol;
  const el = h('section', { class: 'panel detail', role: 'region', 'aria-label': t('ui.details') },
    h('span', { class: 'tick tl' }), h('span', { class: 'tick tr' }), h('span', { class: 'tick bl' }), h('span', { class: 'tick br' }));
  const body = h('div', { class: 'detail-inner' });
  el.append(body);

  let shown = -2;
  const render = (i: number) => {
    shown = i;
    clear(body);
    if (i < 0 || i >= p.packets.length) return;
    body.append(...renderDetail(p, i, ctx, onClose));
    onIndex(i);
  };

  const sync = () => {
    const f = Math.max(0, focusIndex(ctx.player.get()));
    if (f !== shown) render(f);
  };
  sync();
  const unsub = ctx.player.sub(sync);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      const open = document.querySelector('dialog[open]');
      if (open) return;
      e.preventDefault();
      onClose();
    }
  };
  document.addEventListener('keydown', onKey);

  return {
    el,
    focus: () => body.querySelector<HTMLElement>('.detail-title')?.focus(),
    destroy: () => {
      unsub();
      document.removeEventListener('keydown', onKey);
    },
  };
}

function renderDetail(p: Protocol, i: number, ctx: ViewCtx, onClose: () => void): Node[] {
  const pk = p.packets[i];
  const d = dissect(p, i);
  const loc = locale();
  const pkColor = famVar(packetFamily(pk.proto, p));
  const node = (id: string) => p.nodes.find((n) => n.id === id);
  const addr = (id: string) => node(id)?.addr ?? t(`node.${node(id)?.label ?? id}`);

  /* Header */
  const prev = IconButton({ label: t('ui.prevMsg'), icon: 'chevronLeft', variant: 'outline', className: 'chevron-flip', onClick: () => ctx.player.seek(i - 1) });
  const next = IconButton({ label: t('ui.nextMsg'), icon: 'chevronRight', variant: 'outline', className: 'chevron-flip', onClick: () => ctx.player.seek(i + 1) });
  prev.disabled = i === 0;
  next.disabled = i >= p.packets.length - 1;
  const close = IconButton({ label: t('ui.closeDetails'), icon: 'close', variant: 'outline', onClick: onClose });
  const no = h('span', { class: 'detail-no' }, String(i + 1));
  no.style.setProperty('--pkt', pkColor);
  const head = h('header', { class: 'detail-head' },
    no,
    h('div', { class: 'detail-titles' },
      h('h2', { class: 'detail-title', tabindex: -1, dir: 'ltr' }, messageTitle(pk)),
      h('p', { class: 'detail-sub', dir: 'ltr' },
        `${formatTime(pk.t, loc)} · ${addr(pk.from)} → ${addr(pk.to)} · ${pk.proto} · ${formatSize(d.bytes.length, loc)}`)),
    h('div', { class: 'detail-nav' }, prev, next, close));

  const ctxLine = h('p', { class: 'detail-ctx' }, t(d.context.key, tr(d.context.vars)));

  /* Layer bar */
  const total = d.bytes.length || 1;
  const bar = h('div', { class: 'detail-bar', 'aria-hidden': 'true', dir: 'ltr' },
    d.layers.filter((l) => l.length > 0).map((l) => {
      const seg = h('div', { class: 'detail-seg' },
        h('span', { class: 'detail-seg-line' }),
        h('span', { class: 'detail-seg-name' }, l.label),
        h('span', { class: 'detail-seg-len' }, String(l.length)));
      seg.style.setProperty('--lc', layerColor(l, pkColor));
      seg.style.flexGrow = String(Math.max(l.length / total, 0.06));
      return seg;
    }));

  /* Fields */
  const fieldsEl = h('div', { class: 'detail-fields', dir: 'ltr' });
  const fieldBtns: { btn: HTMLElement; f: Field }[] = [];
  const fieldRow = (f: Field, depth: number): HTMLElement => {
    const btn = h('button', { type: 'button', class: 'dt-field', style: `--depth:${depth}` },
      h('span', { class: 'dt-name' }, t(f.key)),
      h('span', { class: 'dt-val' },
        h('span', { class: 'dt-value' }, f.value),
        f.example ? h('span', { class: 'dt-eg', title: t('dis.legend.eg') }, t('dis.eg')) : null,
        f.note ? h('span', { class: 'dt-note' }, t(f.note, tr(f.vars))) : null));
    btn.dataset.off = String(f.offset);
    btn.dataset.len = String(f.length);
    fieldBtns.push({ btn, f });
    return btn;
  };
  const addFields = (list: Field[], depth: number, into: HTMLElement) => {
    for (const f of list) {
      into.append(fieldRow(f, depth));
      if (f.children) addFields(f.children, depth + 1, into);
    }
  };
  for (const l of d.layers) {
    const sec = h('section', { class: 'dt-layer' });
    sec.style.setProperty('--lc', layerColor(l, pkColor));
    sec.append(h('h3', { class: 'dt-layer-head' },
      h('span', { class: 'dt-layer-name' }, `${l.label} · ${t('dis.layerBytes', { n: l.length })}`),
      l.summary ? h('span', { class: 'dt-layer-sum' }, l.summary) : null));
    addFields(l.fields, 0, sec);
    fieldsEl.append(sec);
  }

  /* Hex dump */
  const shownBytes = Math.min(d.bytes.length, DUMP_LIMIT);
  const byteEls: HTMLElement[] = [];
  const asciiEls: HTMLElement[] = [];
  const layerOf = (off: number) => d.layers.find((l) => off >= l.offset && off < l.offset + l.length);
  const rows = h('div', { class: 'hex-rows' });
  for (let r = 0; r < shownBytes; r += 16) {
    const hexCells = h('span', { class: 'hex-bytes' });
    const ascCells = h('span', { class: 'hex-ascii' });
    for (let k = r; k < Math.min(r + 16, shownBytes); k++) {
      const b = d.bytes[k];
      const op = d.opaque[k];
      const cell = h('span', { class: `hb${op ? ' is-opaque' : ''}` }, op ? '··' : b.toString(16).padStart(2, '0'));
      const asc = h('span', { class: `ha${op ? ' is-opaque' : ''}` }, op ? '·' : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.');
      const l = layerOf(k);
      if (l) {
        cell.style.setProperty('--lc', layerColor(l, pkColor));
        asc.style.setProperty('--lc', layerColor(l, pkColor));
      }
      cell.dataset.i = String(k);
      asc.dataset.i = String(k);
      byteEls.push(cell);
      asciiEls.push(asc);
      hexCells.append(cell);
      ascCells.append(asc);
    }
    rows.append(h('div', { class: 'hex-row' }, h('span', { class: 'hex-off' }, r.toString(16).padStart(4, '0')), hexCells, ascCells));
  }
  if (d.bytes.length > shownBytes) rows.append(h('p', { class: 'hex-more' }, t('dis.dumpMore', { n: d.bytes.length - shownBytes })));
  const hexEl = h('div', { class: 'detail-hex', dir: 'ltr' },
    h('h3', { class: 'hex-head' }, caps(t('dis.bytes')), h('span', {}, t('dis.inFrame', { n: d.bytes.length }))),
    rows);

  /* Linked highlight between fields and bytes */
  let hl: { btn?: HTMLElement; from: number; to: number } | null = null;
  const clearHl = () => {
    if (!hl) return;
    hl.btn?.classList.remove('is-hl');
    for (let k = hl.from; k < hl.to && k < byteEls.length; k++) {
      byteEls[k].classList.remove('is-hl');
      asciiEls[k].classList.remove('is-hl');
    }
    hl = null;
  };
  const setHl = (btn: HTMLElement | undefined, from: number, len: number, scrollHex: boolean) => {
    clearHl();
    hl = { btn, from, to: from + len };
    btn?.classList.add('is-hl');
    for (let k = from; k < from + len && k < byteEls.length; k++) {
      byteEls[k].classList.add('is-hl');
      asciiEls[k].classList.add('is-hl');
    }
    if (scrollHex && byteEls[from]) scrollIntoViewWithin(hexEl, byteEls[from]);
  };
  for (const { btn, f } of fieldBtns) {
    const on = (scroll: boolean) => () => setHl(btn, f.offset, f.length, scroll);
    btn.addEventListener('mouseenter', on(false));
    btn.addEventListener('focus', on(true));
    btn.addEventListener('click', on(true));
  }
  // Byte → deepest field that contains it.
  const fieldAt = (k: number) => {
    let best: { btn: HTMLElement; f: Field } | undefined;
    for (const x of fieldBtns) if (k >= x.f.offset && k < x.f.offset + x.f.length && (!best || x.f.length <= best.f.length)) best = x;
    return best;
  };
  rows.addEventListener('mouseover', (e) => {
    const k = Number((e.target as HTMLElement).dataset?.i ?? NaN);
    if (Number.isNaN(k)) return;
    const x = fieldAt(k);
    if (x) {
      setHl(x.btn, x.f.offset, x.f.length, false);
      scrollIntoViewWithin(fieldsEl, x.btn);
    }
  });
  fieldsEl.addEventListener('mouseleave', clearHl);
  rows.addEventListener('mouseleave', clearHl);

  const legend = h('footer', { class: 'detail-legend' },
    h('span', {}, h('span', { class: 'dt-eg' }, t('dis.eg')), ' ', t('dis.legend.eg')),
    h('span', {}, h('span', { class: 'hb is-opaque' }, '··'), ' ', t('dis.legend.opaque')));

  return [head, ctxLine, bar, h('div', { class: 'detail-body' }, fieldsEl, hexEl), legend];
}

/** Scroll a child into view inside its own scroll box only (never scroll the page). */
function scrollIntoViewWithin(box: HTMLElement, child: HTMLElement): void {
  const b = box.getBoundingClientRect();
  const c = child.getBoundingClientRect();
  if (c.top < b.top + 8) box.scrollTop -= b.top + 8 - c.top;
  else if (c.bottom > b.bottom - 8) box.scrollTop += c.bottom - (b.bottom - 8);
}
