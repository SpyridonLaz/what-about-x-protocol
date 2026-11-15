import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Player, type Clock } from '../src/core/player';
import { EXAMPLES } from '../src/examples';
import { AI_EXAMPLES } from '../src/examples/ai';
import { highlight } from '../src/examples/highlight';
import { byId } from '../src/protocols';
import { setLocale, t } from '../src/i18n/i18n';
import { ExampleView } from '../src/views/ExampleView';
import { Narration } from '../src/views/Narration';
import { SequenceView } from '../src/views/SequenceView';
import { StepsView } from '../src/views/StepsView';
import type { ViewCtx } from '../src/views/context';

Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;

/** Manual clock: advance(ms) moves time and runs the pending frame once. */
const manualClock = () => {
  let now = 0;
  let cb: (() => void) | null = null;
  const clock: Clock = {
    now: () => now,
    frame: (f) => {
      cb = f;
      return 1;
    },
    cancel: () => {
      cb = null;
    },
  };
  const advance = (ms: number) => {
    now += ms;
    const f = cb;
    cb = null;
    f?.();
  };
  return { clock, advance };
};

const make = (id: string, extra: Partial<ViewCtx> = {}) => {
  const protocol = byId(id)!;
  const mc = manualClock();
  const player = new Player(protocol.packets.length, 1000, mc.clock);
  const ctx: ViewCtx = { protocol, player, ...extra };
  return { protocol, player, ctx, advance: mc.advance };
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

describe('ExampleView caret and live region', () => {
  it.each(['mcp', 'multi-agent'])('%s: no caret remains after playing to the end', (id) => {
    const { ctx, player, protocol, advance } = make(id);
    ExampleView(host, ctx, EXAMPLES[id]);
    player.seek(protocol.packets.length - 2);
    player.play();
    expect(player.get().playing).toBe(true);
    let guard = 0;
    while (player.get().playing && guard++ < 50) {
      advance(250);
    }
    expect(player.get().playing).toBe(false);
    expect(player.get().index).toBe(protocol.packets.length - 1);
    expect(host.querySelector('.ex-caret')).toBeNull();
  });

  it('shows the caret mid-flight on a live user bubble, and removes it on arrival', () => {
    const { ctx, player, advance } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    player.play();
    advance(300);
    expect(player.get().playing).toBe(true);
    const live = host.querySelector('.ex-msg.is-live .ex-bubble');
    expect(live).not.toBeNull();
    expect(live!.querySelector('.ex-caret')).not.toBeNull();
    player.seek(0);
    expect(host.querySelector('.ex-caret')).toBeNull();
  });

  it('shows the caret mid-flight on a live assistant bubble', () => {
    const { ctx, player, protocol, advance } = make('llm-api');
    ExampleView(host, ctx, EXAMPLES['llm-api']);
    // find a packet whose scene has a live assistant bubble
    let found = -1;
    for (let i = 0; i < protocol.packets.length && found < 0; i++) {
      player.seek(i - 1);
      player.play();
      advance(300);
      if (host.querySelector('.ex-assistant.is-live .ex-caret')) found = i;
    }
    expect(found).toBeGreaterThanOrEqual(0);
  });

  it('.ex-chat is a group, not a live log', () => {
    const { ctx } = make('mcp');
    ExampleView(host, ctx, EXAMPLES.mcp);
    const chat = host.querySelector('.ex-chat')!;
    expect(chat.getAttribute('role')).toBe('group');
    expect(chat.getAttribute('role')).not.toBe('log');
    expect(chat.hasAttribute('aria-live')).toBe(false);
  });
});

describe('Narration aria-live', () => {
  it('has a label from narr.label', () => {
    const { ctx } = make('mcp');
    Narration(host, ctx);
    expect(t('narr.label')).not.toBe('narr.label');
    expect(host.querySelector('.narr')!.getAttribute('aria-label')).toBe(t('narr.label'));
  });
  it('is polite when paused, off while playing, polite again when stopped', () => {
    const { ctx, player, advance } = make('mcp');
    Narration(host, ctx);
    const el = host.querySelector('.narr')!;
    expect(el.getAttribute('aria-live')).toBe('polite');
    player.play();
    expect(el.getAttribute('aria-live')).toBe('off');
    advance(300);
    expect(el.getAttribute('aria-live')).toBe('off');
    player.pause();
    expect(el.getAttribute('aria-live')).toBe('polite');
  });
  it('stays polite when stepping by hand', () => {
    const { ctx, player } = make('mcp');
    Narration(host, ctx);
    player.step();
    expect(host.querySelector('.narr')!.getAttribute('aria-live')).toBe('polite');
  });
  it('goes back to polite when playback ends by itself', () => {
    const { ctx, player, protocol, advance } = make('mcp');
    Narration(host, ctx);
    player.seek(protocol.packets.length - 2);
    player.play();
    advance(2000);
    expect(player.get().playing).toBe(false);
    expect(host.querySelector('.narr')!.getAttribute('aria-live')).toBe('polite');
  });
});

describe('highlight: // inside JSON strings', () => {
  const kinds = (s: string) => highlight(s, 'json').flat();
  const roundTrip = (s: string) => expect(kinds(s).map((k) => k.text).join('')).toBe(s);

  it('a // inside a string is not a comment', () => {
    const toks = kinds('{ "text": "a // b" }');
    expect(toks.some((k) => k.kind === 'com')).toBe(false);
    expect(toks.filter((k) => k.kind === 'str').map((k) => k.text)).toEqual(['"a // b"']);
    roundTrip('{ "text": "a // b" }');
  });
  it('a real trailing comment after such a string is still a comment', () => {
    const src = '{ "text": "a // b" } // real';
    const toks = kinds(src);
    expect(toks.filter((k) => k.kind === 'str').map((k) => k.text)).toEqual(['"a // b"']);
    expect(toks.filter((k) => k.kind === 'com').map((k) => k.text)).toEqual([' // real']);
    roundTrip(src);
  });
  it('a trailing comment after a number is a comment', () => {
    const src = '"a": 1 // note';
    const com = kinds(src).filter((k) => k.kind === 'com');
    expect(com.map((k) => k.text)).toEqual([' // note']);
    roundTrip(src);
  });
  it('escaped quotes before the // are handled', () => {
    const src = '{ "t": "say \\"x\\" // y" }';
    expect(kinds(src).some((k) => k.kind === 'com')).toBe(false);
    roundTrip(src);
  });
  it('two slashes-in-string occurrences then a real comment', () => {
    const src = '{ "a": "x // y // z" } // end';
    expect(kinds(src).filter((k) => k.kind === 'com').map((k) => k.text)).toEqual([' // end']);
    roundTrip(src);
  });
  it('a lone unterminated quote keeps its text', () => {
    roundTrip('{ "oops');
    roundTrip('say " // hi');
  });
  it('a full-line comment is still a comment', () => {
    expect(kinds('// whole line').map((k) => k.kind)).toEqual(['com']);
  });
  it('every shipped wire body still round-trips', () => {
    for (const [id, ex] of Object.entries(EXAMPLES)) {
      ex.wire.forEach((m, i) => {
        const text = highlight(m.body, m.lang).map((l) => l.map((k) => k.text).join('')).join('\n');
        expect(text, `${id} #${i + 1}`).toBe(m.body);
      });
    }
  });
});

describe('A2A and MCP example facts', () => {
  const a2a = AI_EXAMPLES.a2a.wire;
  const streamReplies = () =>
    a2a.map((m, i) => ({ m, i })).filter(({ m, i }) => i > 0 && /SendStreamingMessage/.test(a2a[i - 1].body) && /text\/event-stream/.test(m.body));

  it('there are two streaming replies and each begins with a task object', () => {
    const replies = streamReplies();
    expect(replies).toHaveLength(2);
    for (const { m } of replies) {
      const firstData = m.body.split('\n').find((l) => l.startsWith('data:'))!;
      expect(firstData).toContain('"result":{"task"');
      expect(firstData).not.toContain('statusUpdate');
    }
  });
  it('the Agent Card has defaultInputModes and defaultOutputModes', () => {
    const card = a2a.find((m) => m.body.includes('"supportedInterfaces"'))!;
    expect(card.body).toContain('"defaultInputModes"');
    expect(card.body).toContain('"defaultOutputModes"');
  });
  it('the MCP authorize request carries state and the redirect returns the same state', () => {
    const msg = AI_EXAMPLES.mcp.wire.find((m) => m.body.includes('GET /authorize'))!;
    const sent = /&state=([\w-]+)/.exec(msg.body)?.[1];
    const back = /callback\?code=[\w-]+&state=([\w-]+)/.exec(msg.body)?.[1];
    expect(sent).toBeTruthy();
    expect(back).toBe(sent);
  });
});

describe('aria-label of messages: local vs non-local', () => {
  const labels = (sel: string) => [...host.querySelectorAll(sel)].map((e) => e.getAttribute('aria-label')!);

  it('SequenceView, local entry: uses "Message n", not "Show details"', () => {
    const { ctx, protocol } = make('llm-inside');
    expect(protocol.local).toBe(true);
    SequenceView(host, ctx);
    const ls = labels('.seq-msg');
    expect(ls.length).toBe(protocol.packets.length);
    expect(ls[0].startsWith(t('ui.messageNo', { n: 1 }))).toBe(true);
    for (const l of ls) expect(l).not.toContain(t('ui.openDetails', { n: 1 }).replace('1', '').trim());
  });
  it('StepsView, local entry: uses "Message n", not "Show details"', () => {
    const { ctx, protocol } = make('llm-inside');
    StepsView(host, ctx);
    const ls = labels('button.step-btn');
    expect(ls.length).toBe(protocol.packets.length);
    expect(ls[2].startsWith(t('ui.messageNo', { n: 3 }))).toBe(true);
    for (const l of ls) expect(l).not.toContain(t('ui.openDetails', { n: 1 }).replace('1', '').trim());
  });
  it('SequenceView, non-local with openDetail: uses ui.openDetails', () => {
    const { ctx } = make('llm-api', { openDetail: () => {} });
    SequenceView(host, ctx);
    expect(labels('.seq-msg')[0].startsWith(t('ui.openDetails', { n: 1 }))).toBe(true);
  });
  it('StepsView, non-local with openDetail: uses ui.openDetails', () => {
    const { ctx } = make('llm-api', { openDetail: () => {} });
    StepsView(host, ctx);
    expect(labels('button.step-btn')[1].startsWith(t('ui.openDetails', { n: 2 }))).toBe(true);
  });
});
