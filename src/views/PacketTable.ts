import { locale, t } from '../i18n/i18n';
import { famVar, packetFamily } from '../protocols/colors';
import type { Packet } from '../protocols/types';
import { DataTable, type Column } from '../ui/components';
import { h } from '../ui/dom';
import { focusIndex, formatSize, formatTime, packetState, type ViewCtx } from './context';

export function PacketTable(container: HTMLElement, ctx: ViewCtx): () => void {
  const p = ctx.protocol;
  const loc = locale();
  const addr = (id: string) => {
    const nd = p.nodes.find((x) => x.id === id);
    return nd?.addr ?? (nd ? t(`node.${nd.label}`) : id);
  };
  const cols: Column<Packet>[] = [
    { key: 'no', label: t('col.no'), cell: (_r, i) => String(i + 1), className: 'c-no' },
    { key: 'time', label: t('col.time'), cell: (r) => formatTime(r.t, loc), className: 'c-time' },
    { key: 'src', label: t('col.source'), cell: (r) => addr(r.from), className: 'c-addr' },
    { key: 'dst', label: t('col.destination'), cell: (r) => addr(r.to), className: 'c-addr' },
    {
      key: 'proto',
      label: t('col.protocol'),
      cell: (r) => {
        const chip = h('span', { class: 'proto-chip' }, r.proto);
        chip.style.setProperty('--pkt', famVar(packetFamily(r.proto, p)));
        return chip;
      },
      className: 'c-proto',
    },
    { key: 'info', label: t('col.info'), cell: (r) => r.info, className: 'c-info' },
    { key: 'size', label: t('col.size'), cell: (r) => formatSize(r.size, loc), className: 'c-size' },
  ];
  const table = DataTable(cols, (i) => ctx.player.seek(i), t('ui.packets'));
  table.setRows(p.packets);
  table.el.querySelector('table')?.setAttribute('dir', 'ltr');
  container.append(table.el);

  let lastFocus = -2;
  const draw = () => {
    const st = ctx.player.get();
    table.rows.forEach((tr, i) => {
      const state = packetState(i, st);
      tr.className = `is-${state}`;
      if (state === 'current') tr.setAttribute('aria-current', 'step');
      else tr.removeAttribute('aria-current');
    });
    const f = focusIndex(st);
    if (f !== lastFocus) {
      lastFocus = f;
      const row = table.rows[f];
      const wrap = table.el;
      if (row && wrap.scrollHeight > wrap.clientHeight) {
        const top = row.offsetTop - wrap.clientHeight / 2;
        wrap.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    }
  };
  draw();
  return ctx.player.sub(draw);
}
