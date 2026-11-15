// "Real example" pane: one concrete run of the scenario, in step with the player.
// Top: what the user sees (a mock screen). Bottom: the full content of the current message.
import { highlight } from '../examples/highlight';
import { sceneAt, type Example } from '../examples';
import { caps, t } from '../i18n/i18n';
import { famVar, packetFamily } from '../protocols/colors';
import { clear, h } from '../ui/dom';
import { focusIndex, type ViewCtx } from './context';

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function ExampleView(container: HTMLElement, ctx: ViewCtx, ex: Example): () => void {
  const p = ctx.protocol;
  const nodeLabel = (id: string) => {
    const nd = p.nodes.find((n) => n.id === id);
    return nd ? t(`node.${nd.label}`) : id;
  };
  const speaker = {
    user: t(ex.names?.user ?? 'ex.you'),
    assistant: t(ex.names?.assistant ?? 'ex.assistant'),
  };

  const chat = h('div', { class: 'ex-chat', role: 'group', 'aria-label': t('ex.screen') });
  const screen = h('section', { class: 'ex-screen' },
    h('h3', { class: 'ex-tag' }, caps(t('ex.screen'))),
    h('div', { class: 'ex-window' },
      h('div', { class: 'ex-bar', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}), h('span', { class: 'ex-app', dir: 'ltr' }, ex.app)),
      chat));

  const meta = h('span', { class: 'ex-meta' });
  const code = h('pre', { class: 'ex-code', dir: 'ltr', tabindex: 0, 'aria-label': t('ex.wire') });
  const wire = h('section', { class: 'ex-wire' },
    h('div', { class: 'ex-wire-head' }, h('h3', { class: 'ex-tag' }, caps(t('ex.wire'))), meta),
    code);

  const root = h('div', { class: 'ex' }, screen, wire);
  root.style.setProperty('--pkt', famVar(p.family));
  container.append(root);

  let lastWire = -2;
  let lastScene = '';

  const drawWire = (f: number) => {
    clear(code);
    clear(meta);
    const msg = ex.wire[f];
    if (f < 0 || !msg) {
      code.append(h('span', { class: 'tk-com' }, t('ex.idle')));
      return;
    }
    const pk = p.packets[f];
    const chip = h('span', { class: 'proto-chip' }, pk.proto);
    chip.style.setProperty('--pkt', famVar(packetFamily(pk.proto, p)));
    meta.append(h('span', { class: 'ex-no' }, `#${f + 1}`), h('span', { class: 'ex-route' }, `${nodeLabel(pk.from)} → ${nodeLabel(pk.to)}`), chip);
    highlight(msg.body, msg.lang).forEach((line, i) => {
      if (i) code.append('\n');
      for (const tok of line) code.append(tok.kind === 'plain' ? tok.text : h('span', { class: `tk-${tok.kind}` }, tok.text));
    });
    code.scrollTop = 0;
  };

  const drawScene = (f: number, progress: number) => {
    const items = sceneAt(ex, f, progress);
    const typing = progress < 1;
    const sig = `${f}|${items.length}|${items[items.length - 1]?.text.length ?? 0}|${typing}`;
    if (sig === lastScene) return;
    lastScene = sig;
    clear(chat);
    if (!items.length) {
      chat.append(h('p', { class: 'ex-empty' }, t('ex.idle')));
      return;
    }
    for (const it of items) {
      const live = it.live ? ' is-live' : '';
      if (it.role === 'user' || it.role === 'assistant') {
        chat.append(h('div', { class: `ex-msg ex-${it.role}${live}` },
          h('span', { class: 'ex-who' }, speaker[it.role]),
          h('p', { class: 'ex-bubble', dir: 'ltr' }, it.text, it.live && typing ? h('span', { class: 'ex-caret', 'aria-hidden': 'true' }) : null)));
      } else if (it.role === 'status') {
        chat.append(h('p', { class: `ex-status${live}`, dir: 'ltr' }, it.text));
      } else {
        chat.append(h('div', { class: `ex-tool ex-${it.role}${live}` },
          h('span', { class: 'ex-tool-tag' }, caps(t(it.role === 'tool' ? 'ex.toolCall' : 'ex.toolResult'))),
          h('code', { dir: 'ltr' }, it.text)));
      }
    }
    chat.scrollTop = chat.scrollHeight;
  };

  const draw = () => {
    const st = ctx.player.get();
    const f = focusIndex(st);
    const flying = st.playing && f > st.index;
    const progress = flying && !reducedMotion() ? st.progress : 1;
    if (f !== lastWire) {
      lastWire = f;
      drawWire(f);
    }
    // The message is uncovered from the top while its packet travels.
    code.style.setProperty('--reveal', progress.toFixed(3));
    drawScene(f, progress);
  };
  draw();
  return ctx.player.sub(draw);
}
