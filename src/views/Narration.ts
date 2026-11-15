// Narration: one plain-language sentence about the current message, under the diagram.
// Only scenarios that have notes (the AI entries) show it.
import { caps, t } from '../i18n/i18n';
import { famVar, packetFamily } from '../protocols/colors';
import { clear, h } from '../ui/dom';
import { focusIndex, type ViewCtx } from './context';

export function hasNarration(ctx: ViewCtx): boolean {
  return (ctx.protocol.text.notes?.length ?? 0) > 0;
}

export function Narration(container: HTMLElement, ctx: ViewCtx): () => void {
  const p = ctx.protocol;
  const name = (id: string) => {
    const nd = p.nodes.find((n) => n.id === id);
    return nd ? t(`node.${nd.label}`) : id;
  };
  const el = h('div', { class: 'narr', role: 'group', 'aria-live': 'polite', 'aria-label': t('narr.label') });
  container.append(el);

  let last = -2;
  const draw = () => {
    const st = ctx.player.get();
    // Announce each step when the user steps by hand; stay quiet during playback.
    const live = st.playing ? 'off' : 'polite';
    if (el.getAttribute('aria-live') !== live) el.setAttribute('aria-live', live);
    const f = focusIndex(st);
    if (f === last) return;
    last = f;
    clear(el);
    if (f < 0) {
      el.classList.add('is-idle');
      el.append(h('span', { class: 'narr-no' }, '▶'), h('p', { class: 'narr-text' }, t('narr.idle')));
      return;
    }
    el.classList.remove('is-idle');
    const pk = p.packets[f];
    el.style.setProperty('--pkt', famVar(packetFamily(pk.proto, p)));
    el.append(
      h('span', { class: 'narr-no' }, `${f + 1}/${p.packets.length}`),
      h('div', { class: 'narr-body' },
        h('span', { class: 'narr-route' }, caps(`${name(pk.from)} → ${name(pk.to)}`)),
        h('p', { class: 'narr-text' }, t(`p.${p.id}.m${f + 1}`))),
    );
  };
  draw();
  return ctx.player.sub(draw);
}
