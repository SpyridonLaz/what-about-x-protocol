import { caps, t } from '../i18n/i18n';
import { famVar, packetFamily } from '../protocols/colors';
import { Badge, KeyValueGrid } from '../ui/components';
import { h } from '../ui/dom';
import type { ViewCtx } from './context';

export function OverviewPanel(container: HTMLElement, ctx: ViewCtx): () => void {
  const p = ctx.protocol;
  const f = p.facts;
  const rows: [string, string][] = [
    [t('fact.layer'), t(`layer.${f.layer}`)],
    [t('fact.port'), f.port],
    [t('fact.transport'), f.transport],
    [t('fact.format'), t(`p.${p.id}.format`)],
  ];
  if (f.methods) rows.push([t('fact.methods'), f.methods]);
  rows.push([t('fact.spec'), f.spec]);

  const flow = [...new Set(p.packets.map((pk) => pk.proto))];
  const chips = h('div', { class: 'flow-chips' }, flow.map((proto) => {
    const c = h('span', { class: 'proto-chip' }, proto);
    c.style.setProperty('--pkt', famVar(packetFamily(proto, p)));
    return c;
  }));

  const head = h('div', { class: 'ov-head' },
    h('span', { class: 'ov-short' }, p.short),
    p.kind === 'pattern' ? Badge(caps(t('ui.pattern')), 'warn') : Badge(caps(t('ui.active')), 'ok'),
    Badge(caps(t(`fam.${p.family}`)), 'family', p.family));

  container.append(
    head,
    h('h3', { class: 'ov-name' }, t(`p.${p.id}.name`)),
    h('p', { class: 'ov-desc' }, t(`p.${p.id}.desc`)),
    KeyValueGrid(rows),
    h('h4', { class: 'ov-sub' }, caps(t('ui.packetFlow'))),
    chips,
  );
  return () => {};
}
