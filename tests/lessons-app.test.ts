import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Player, type Clock } from '../src/core/player';
import { byId } from '../src/protocols';
import { NetworkView } from '../src/views/NetworkView';
import { startApp } from '../src/app';

Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
window.scrollTo = (() => {}) as typeof window.scrollTo;

const fakeClock = (): Clock => ({ now: () => 0, frame: () => 1, cancel: () => {} });

describe('NetworkView zones and arrival', () => {
  let host: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.append(host);
  });
  const mount = (id: string) => {
    const protocol = byId(id)!;
    const player = new Player(protocol.packets.length, 900, fakeClock());
    NetworkView(host, { protocol, player });
    return { protocol, player };
  };
  it('draws one zone frame per zone on mcp', () => {
    const { protocol } = mount('mcp');
    expect(host.querySelectorAll('.net-zone')).toHaveLength(protocol.zones!.length);
    expect(host.querySelectorAll('.net-zone-label')).toHaveLength(protocol.zones!.length);
  });
  it('draws no zone for http', () => {
    mount('http');
    expect(host.querySelector('.net-zone')).toBeNull();
  });
  it('marks the destination node as arrived once the packet has landed', () => {
    const { player, protocol } = mount('http');
    player.seek(0);
    expect(host.querySelectorAll('.is-arrived')).toHaveLength(1);
    expect(host.querySelectorAll('.is-src')).toHaveLength(1);
    expect(host.querySelectorAll('.is-dst')).toHaveLength(1);
    expect(protocol.packets.length).toBeGreaterThan(0);
  });
  it('shows nothing highlighted at index -1', () => {
    mount('http');
    expect(host.querySelectorAll('.is-arrived, .is-src, .is-dst, .is-hot')).toHaveLength(0);
  });
});

describe('app shell: real-example switch and local entries', () => {
  let root: HTMLElement;
  const start = async (hash: string) => {
    location.hash = hash;
    await startApp(root);
  };
  const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const sw = () => root.querySelector<HTMLButtonElement>('.switch');

  // startApp registers document-level listeners and returns no cleanup: remove them between tests.
  const added: [string, EventListenerOrEventListenerObject][] = [];
  const addedWin: [string, EventListenerOrEventListenerObject][] = [];
  const realAdd = document.addEventListener.bind(document);
  const realWinAdd = window.addEventListener.bind(window);
  beforeEach(() => {
    window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: unknown) => {
      addedWin.push([type, fn]);
      realWinAdd(type, fn, o as AddEventListenerOptions);
    }) as typeof window.addEventListener;
    document.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: unknown) => {
      added.push([type, fn]);
      realAdd(type, fn, o as AddEventListenerOptions);
    }) as typeof document.addEventListener;
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    document.documentElement.classList.remove('is-present');
  });
  afterEach(() => {
    for (const [t, fn] of addedWin.splice(0)) window.removeEventListener(t, fn);
    window.addEventListener = realWinAdd;
    for (const [t, fn] of added.splice(0)) document.removeEventListener(t, fn);
    document.addEventListener = realAdd;
    document.documentElement.classList.remove('is-present');
    history.replaceState(null, '', '#');
  });

  it('http has no switch and no example pane content', async () => {
    await start('#/p/http');
    expect(sw()).toBeNull();
    expect(root.querySelector('.diagram-ex .ex')).toBeNull();
  });
  it('an AI entry has the switch, off by default and not pressed', async () => {
    await start('#/p/mcp');
    expect(sw()).not.toBeNull();
    expect(sw()!.getAttribute('role')).toBe('switch');
    expect(sw()!.getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector<HTMLElement>('.diagram-ex')!.hidden).toBe(true);
  });
  it('clicking the switch shows the example, persists "1", and clicking again hides it and persists "0"', async () => {
    await start('#/p/mcp');
    sw()!.click();
    expect(sw()!.getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector<HTMLElement>('.diagram-ex')!.hidden).toBe(false);
    expect(root.querySelector('.diagram-ex .ex')).not.toBeNull();
    expect(localStorage.getItem('pe.example')).toBe('1');
    sw()!.click();
    expect(sw()!.getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector<HTMLElement>('.diagram-ex')!.hidden).toBe(true);
    expect(localStorage.getItem('pe.example')).toBe('0');
  });
  it('key e toggles the example', async () => {
    await start('#/p/mcp');
    key('e');
    expect(sw()!.getAttribute('aria-checked')).toBe('true');
    key('e');
    expect(sw()!.getAttribute('aria-checked')).toBe('false');
  });
  it('key e does nothing on an entry without an example', async () => {
    await start('#/p/http');
    key('e');
    // (not asserting on localStorage: apps from earlier tests may still be listening)
    expect(sw()).toBeNull();
    expect(root.querySelector('.diagram-ex .ex')).toBeNull();
    expect(root.querySelector('.has-example')).toBeNull();
    expect(root.querySelector('.diagram-ex')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.diagram-ex')!.children).toHaveLength(0);
  });
  it('a saved "1" opens the example on start', async () => {
    localStorage.setItem('pe.example', '1');
    await start('#/p/rag');
    expect(sw()!.getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('.diagram-ex .ex')).not.toBeNull();
  });
  it('shows the narration under the diagram for an AI entry, not for http', async () => {
    await start('#/p/a2a');
    expect(root.querySelector('.narr')).not.toBeNull();
    root.innerHTML = '';
    await start('#/p/http');
    expect(root.querySelector('.narr')).toBeNull();
  });
  it('key p toggles presentation mode, Escape leaves it', async () => {
    await start('#/p/http');
    key('p');
    expect(document.documentElement.classList.contains('is-present')).toBe(true);
    key('Escape');
    expect(document.documentElement.classList.contains('is-present')).toBe(false);
    key('p');
    key('p');
    expect(document.documentElement.classList.contains('is-present')).toBe(false);
  });
  it('?msg= opens the packet detail for a network entry', async () => {
    await start('#/p/llm-api?msg=2');
    expect(root.querySelector('.detail-host')!.hasAttribute('hidden')).toBe(false);
  });
  it('?msg= is ignored for a local entry (llm-inside): detail stays closed', async () => {
    await start('#/p/llm-inside?msg=2');
    expect(root.querySelector('.detail-host')!.hasAttribute('hidden')).toBe(true);
  });
  it('the drawer lists the AI family first', async () => {
    await start('#/p/http');
    const first = root.querySelector('.drawer-group .drawer-short')!;
    expect(first.textContent).toBe(byId('mcp')!.short);
    const shorts = [...root.querySelectorAll('.drawer-group')].map((g) => g.querySelectorAll('.drawer-link').length);
    expect(shorts[0]).toBe(7);
  });
});
