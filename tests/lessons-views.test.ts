import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Player, type Clock } from '../src/core/player';
import { EXAMPLES } from '../src/examples';
import { byId } from '../src/protocols';
import { protocolKeys } from '../src/i18n/messages';
import { setLocale, t } from '../src/i18n/i18n';
import { ExampleView } from '../src/views/ExampleView';
import { Narration, hasNarration } from '../src/views/Narration';
import { OverviewPanel } from '../src/views/OverviewPanel';
import type { ViewCtx } from '../src/views/context';

Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;

const fakeClock = (): Clock => ({ now: () => 0, frame: () => 1, cancel: () => {} });
const make = (id: string) => {
  const protocol = byId(id)!;
  const player = new Player(protocol.packets.length, 900, fakeClock());
  const ctx: ViewCtx = { protocol, player };
  return { protocol, player, ctx };
};

let host: HTMLElement;
beforeEach(async () => {
  await setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('hasNarration', () => {
  it('true for an AI entry', () => expect(hasNarration(make('mcp').ctx)).toBe(true));
  it('false for http', () => expect(hasNarration(make('http').ctx)).toBe(false));
});

describe('Narration', () => {
  it('shows the idle hint at index -1', () => {
    const { ctx } = make('mcp');
    Narration(host, ctx);
    expect(host.querySelector('.narr')!.classList.contains('is-idle')).toBe(true);
    expect(host.querySelector('.narr-text')!.textContent).toBe(t('narr.idle'));
  });
  it('shows note m<focus+1> and n/total after seeking', () => {
    const { ctx, player, protocol } = make('mcp');
    Narration(host, ctx);
    player.seek(2);
    expect(host.querySelector('.narr-text')!.textContent).toBe(protocol.text.notes![2]);
    expect(host.querySelector('.narr-no')!.textContent).toBe(`3/${protocol.packets.length}`);
    expect(host.querySelector('.narr')!.classList.contains('is-idle')).toBe(false);
  });
  it('shows the last note at the last packet', () => {
    const { ctx, player, protocol } = make('rag');
    Narration(host, ctx);
    player.seek(protocol.packets.length - 1);
    expect(host.querySelector('.narr-text')!.textContent).toBe(protocol.text.notes!.at(-1));
  });
  it('goes back to idle when the player resets', () => {
    const { ctx, player } = make('mcp');
    Narration(host, ctx);
    player.seek(1);
    player.seek(-1);
    expect(host.querySelector('.narr')!.classList.contains('is-idle')).toBe(true);
  });
  it('every note of every AI entry resolves through t() to its English text', () => {
    for (const id of ['mcp', 'a2a', 'llm-api', 'rag', 'agent-loop', 'multi-agent', 'llm-inside']) {
      const p = byId(id)!;
      p.text.notes!.forEach((n, i) => expect(t(`p.${id}.m${i + 1}`), `${id} ${i + 1}`).toBe(n));
    }
  });
  it('cleanup stops following the player', () => {
    const { ctx, player } = make('mcp');
    const off = Narration(host, ctx);
    off();
    player.seek(3);
    expect(host.querySelector('.narr')!.classList.contains('is-idle')).toBe(true);
  });
  it('is localised: German note differs from English', async () => {
    await setLocale('de');
    const { ctx, player, protocol } = make('mcp');
    Narration(host, ctx);
    player.seek(0);
    const text = host.querySelector('.narr-text')!.textContent;
    expect(text).not.toBe(protocol.text.notes![0]);
    expect(text).not.toBe('p.mcp.m1');
  });
});

describe('ExampleView', () => {
  it('shows idle text in chat and code at index -1', () => {
    const { ctx } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    expect(host.querySelector('.ex-chat .ex-empty')!.textContent).toBe(t('ex.idle'));
    expect(host.querySelector('.ex-code')!.textContent).toBe(t('ex.idle'));
  });
  it('shows the user bubble and the first wire message after seeking to packet 0', () => {
    const { ctx, player } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    player.seek(0);
    expect(host.querySelector('.ex-user .ex-bubble')!.textContent).toBe('What’s the weather in Athens?');
    expect(host.querySelector('.ex-code')!.textContent).toBe(EXAMPLES['llm-api'].wire[0].body);
    expect(host.querySelector('.ex-meta .ex-no')!.textContent).toBe('#1');
  });
  it('code text equals the wire body for every packet of every AI entry (nothing lost by colouring)', () => {
    for (const id of Object.keys(EXAMPLES)) {
      const { ctx, player, protocol } = make(id);
      document.body.innerHTML = '';
      host = document.createElement('div');
      document.body.append(host);
      const off = ExampleView(host, ctx, EXAMPLES[id]);
      for (let i = 0; i < protocol.packets.length; i++) {
        player.seek(i);
        expect(host.querySelector('.ex-code')!.textContent, `${id} #${i + 1}`).toBe(EXAMPLES[id].wire[i].body);
      }
      off();
    }
  });
  it('colours tokens with tk-* spans', () => {
    const { ctx, player } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    player.seek(0);
    expect(host.querySelector('.ex-code .tk-start')).not.toBeNull();
    expect(host.querySelector('.ex-code .tk-key')).not.toBeNull();
  });
  it('renders tool and result chips and status lines', () => {
    const { ctx, player } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    player.seek(7);
    expect(host.querySelector('.ex-tool.ex-tool code')!.textContent).toContain('get_weather');
    expect(host.querySelector('.ex-result code')!.textContent).toContain('24');
    const m = make('mcp');
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.append(host);
    ExampleView(host, m.ctx, EXAMPLES.mcp);
    m.player.seek(0);
    expect(host.querySelector('.ex-status')!.textContent).toContain('mcp.weather.example');
  });
  it('is not live-typing when progress is complete (no caret)', () => {
    const { ctx, player } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    player.seek(0);
    expect(host.querySelector('.ex-caret')).toBeNull();
    expect(host.querySelector('.ex-code')!.getAttribute('style')).toContain('--reveal: 1');
  });
  it('shows the app title', () => {
    const { ctx } = make('rag');
    ExampleView(host, ctx, EXAMPLES.rag);
    expect(host.querySelector('.ex-app')!.textContent).toBe(EXAMPLES.rag.app);
  });
  it('uses node names for custom speakers (a2a)', () => {
    const { ctx, player } = make('a2a');
    ExampleView(host, ctx, EXAMPLES.a2a);
    player.seek(2);
    expect(host.querySelector('.ex-user .ex-who')!.textContent).toBe(t('node.clientAgent'));
  });
  it('seeking backwards removes later chat items', () => {
    const { ctx, player } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    player.seek(9);
    expect(host.querySelector('.ex-assistant')).not.toBeNull();
    player.seek(0);
    expect(host.querySelector('.ex-assistant')).toBeNull();
    expect(host.querySelector('.ex-code')!.textContent).toBe(EXAMPLES['llm-api'].wire[0].body);
  });
  it('returns to idle when the player resets', () => {
    const { ctx, player } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    player.seek(2);
    player.seek(-1);
    expect(host.querySelector('.ex-empty')).not.toBeNull();
    expect(host.querySelector('.ex-code')!.textContent).toBe(t('ex.idle'));
  });
  it('cleanup stops following the player', () => {
    const { ctx, player } = make('llm-api');
    const off = ExampleView(host, ctx, EXAMPLES['llm-api']);
    off();
    player.seek(0);
    expect(host.querySelector('.ex-empty')).not.toBeNull();
  });
  it('every ex.* string it uses exists', () => {
    for (const k of ['ex.you', 'ex.assistant', 'ex.screen', 'ex.wire', 'ex.idle', 'ex.toolCall', 'ex.toolResult', 'ex.toggle', 'ex.hint', 'narr.idle', 'ui.keyIdeas']) {
      expect(t(k), k).not.toBe(k);
    }
  });
});

describe('OverviewPanel ideas', () => {
  it('renders one li per key idea for an AI entry', () => {
    const { ctx, protocol } = make('mcp');
    OverviewPanel(host, ctx);
    const lis = [...host.querySelectorAll('.ov-ideas li')];
    expect(lis.map((l) => l.textContent)).toEqual(protocol.text.ideas);
  });
  it('renders no ideas list for http', () => {
    OverviewPanel(host, make('http').ctx);
    expect(host.querySelector('.ov-ideas')).toBeNull();
    expect(host.querySelector('.ov-sub-ideas')).toBeNull();
  });
  it('keys exist for the ideas', () => {
    const keys = protocolKeys(byId('rag')!);
    expect(keys['p.rag.k1']).toBeTruthy();
  });
});
