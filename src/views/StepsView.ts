// Steps view: every message as a numbered list, grouped by stage. Follows the player;
// clicking a step opens its packet details.
import { caps, locale, t } from '../i18n/i18n';
import { famVar, packetFamily } from '../protocols/colors';
import { h } from '../ui/dom';
import { focusIndex, formatTime, packetState, type ViewCtx } from './context';

export function StepsView(container: HTMLElement, ctx: ViewCtx): () => void {
  const p = ctx.protocol;
  const loc = locale();
  const name = (id: string) => {
    const nd = p.nodes.find((n) => n.id === id);
    return nd ? t(`node.${nd.label}`) : id;
  };

  const list = h('ol', { class: 'steps', 'aria-label': t('ui.steps') });
  const rows: HTMLElement[] = [];
  let stage = -1;
  let group: HTMLElement | null = null;
  p.packets.forEach((pk, i) => {
    if (pk.stage !== stage || !group) {
      stage = pk.stage;
      group = h('ol', { class: 'steps-group' });
      list.append(h('li', { class: 'steps-stage' },
        h('div', { class: 'steps-stage-head' },
          h('span', { class: 'steps-stage-no' }, String(stage + 1)),
          h('span', { class: 'steps-stage-title' }, caps(t(`p.${p.id}.s${stage + 1}.t`))),
          h('span', { class: 'steps-stage-sub' }, t(`p.${p.id}.s${stage + 1}.d`))),
        group));
    }
    const chip = h('span', { class: 'proto-chip' }, pk.proto);
    chip.style.setProperty('--pkt', famVar(packetFamily(pk.proto, p)));
    const btn = h('button', { type: 'button', class: 'step-btn', 'aria-label': `${t(ctx.openDetail ? 'ui.openDetails' : 'ui.messageNo', { n: i + 1 })}: ${pk.proto} ${pk.info}` },
      h('span', { class: 'step-no' }, String(i + 1)),
      h('span', { class: 'step-time' }, formatTime(pk.t, loc)),
      h('span', { class: 'step-route' }, `${name(pk.from)} → ${name(pk.to)}`),
      chip,
      h('span', { class: 'step-info', dir: 'ltr' }, pk.info));
    btn.addEventListener('click', () => (ctx.openDetail ? ctx.openDetail(i) : ctx.player.seek(i)));
    const li = h('li', { class: 'step' }, btn);
    li.style.setProperty('--pkt', famVar(packetFamily(pk.proto, p)));
    rows.push(li);
    group!.append(li);
  });

  const scroller = h('div', { class: 'steps-scroll' }, list);
  container.append(scroller);

  let lastFocus = -2;
  const draw = () => {
    const st = ctx.player.get();
    rows.forEach((li, i) => {
      const state = packetState(i, st);
      li.className = `step is-${state}`;
      if (state === 'current') li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    const f = focusIndex(st);
    if (f !== lastFocus && f >= 0) {
      lastFocus = f;
      const li = rows[f];
      const top = li.offsetTop; // .steps-scroll is the offset parent
      if (top < scroller.scrollTop + 24 || top > scroller.scrollTop + scroller.clientHeight - 48) {
        scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 2), behavior: 'smooth' });
      }
    }
  };
  draw();
  return ctx.player.sub(draw);
}
