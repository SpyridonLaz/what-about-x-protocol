import { t } from '../i18n/i18n';
import { h } from '../ui/dom';
import { activeStage, type ViewCtx } from './context';

/** Numbered stage cards; clicking one jumps to its first packet. */
export function StageBar(container: HTMLElement, ctx: ViewCtx): () => void {
  const p = ctx.protocol;
  const list = h('ol', { class: 'stages', 'aria-label': t('ui.stages') });
  const items = p.text.stages.map((_, i) => {
    const first = p.packets.findIndex((pk) => pk.stage === i);
    const btn = h('button', { type: 'button', class: 'stage' },
      h('span', { class: 'stage-no' }, String(i + 1)),
      h('span', { class: 'stage-text' },
        h('span', { class: 'stage-title' }, t(`p.${p.id}.s${i + 1}.t`)),
        h('span', { class: 'stage-sub' }, t(`p.${p.id}.s${i + 1}.d`))));
    btn.addEventListener('click', () => {
      if (first >= 0) ctx.player.seek(first);
    });
    const li = h('li', {}, btn);
    list.append(li);
    return btn;
  });
  container.append(list);

  const draw = () => {
    const st = ctx.player.get();
    const a = activeStage(p, st);
    const finished = st.index >= st.count - 1 && !st.playing;
    items.forEach((b, i) => {
      b.classList.toggle('is-active', i === a && !finished);
      b.classList.toggle('is-done', i < a || (finished && st.count > 0));
      if (i === a) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  };
  draw();
  return ctx.player.sub(draw);
}
