// App shell: header, protocol drawer, search palette, main grid of views, player bar.
import { Player, SPEEDS } from './core/player';
import { hashFor, navigate, onRoute, parseHash, parseMsg, replaceHash } from './core/router';
import { safeStorage, Signal } from './core/store';
import { exampleFor } from './examples';
import { detectLocale } from './i18n/detect';
import { caps, locale, onLocaleChange, setLocale, t } from './i18n/i18n';
import { LOCALES } from './i18n/locales';
import { icon } from './icons/ui';
import { PROTOCOLS, byId, searchProtocols } from './protocols';
import { FAMILIES } from './protocols/types';
import { Button, Dialog, IconButton, Menu, Panel, SegmentedControl, setButton } from './ui/components';
import { clear, h, svgFromString } from './ui/dom';
import { ExampleView } from './views/ExampleView';
import { Narration, hasNarration } from './views/Narration';
import { NetworkView } from './views/NetworkView';
import { OverviewPanel } from './views/OverviewPanel';
import { PacketDetail, type DetailHandle } from './views/PacketDetail';
import { PacketTable } from './views/PacketTable';
import { SequenceView } from './views/SequenceView';
import { StageBar } from './views/StageBar';
import { StepsView } from './views/StepsView';
import type { ViewCtx } from './views/context';

type View = 'network' | 'sequence' | 'steps';
const VIEWS: View[] = ['network', 'sequence', 'steps'];
type Theme = 'dark' | 'light';

const DEFAULT_ID = 'llm-api';
const REPO_URL = '';


export async function startApp(root: HTMLElement): Promise<void> {
  const protocolId = new Signal<string>(byId(parseHash(location.hash) ?? '')?.id ?? DEFAULT_ID);
  const savedView = safeStorage.get('pe.view') as View;
  const view = new Signal<View>(VIEWS.includes(savedView) ? savedView : 'network');
  /** Packet detail open? Its message is the player's focus; the URL carries it as ?msg=<n>. */
  const detailOpen = new Signal<boolean>(false);
  /** "Real example" switch: shows a concrete run next to the diagram (entries that have one). */
  const exampleOn = new Signal<boolean>(safeStorage.get('pe.example') === '1');
  exampleOn.sub((v) => safeStorage.set('pe.example', v ? '1' : '0'));
  /** Presentation mode: only the stages and the diagram, for a projector. Not remembered. */
  const presenting = new Signal<boolean>(false);
  presenting.sub((v) => document.documentElement.classList.toggle('is-present', v));
  /** True when we added the ?msg history entry ourselves, so closing can go back instead of adding one. */
  let pushedDetail = false;
  const savedTheme = safeStorage.get('pe.theme');
  const theme = new Signal<Theme>(
    savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  );
  const applyTheme = () => document.documentElement.setAttribute('data-theme', theme.get());
  applyTheme();
  theme.sub((v) => {
    safeStorage.set('pe.theme', v);
    applyTheme();
  });

  const player = new Player(byId(protocolId.get())!.packets.length, 900);

  await setLocale(detectLocale(safeStorage.get('pe.locale'), navigator.languages ?? [navigator.language]));

  let cleanups: (() => void)[] = [];
  const cleanup = () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
  };

  /* ---------- static shell (rebuilt on language change) ---------- */
  const render = () => {
    cleanup();
    clear(root);
    const proto = byId(protocolId.get())!;
    document.title = `${proto.short} · ${t('app.title')}`;
    const ctx: ViewCtx = {
      protocol: proto,
      player,
      // In-program steps (no network) have no packets to dissect: a click only moves the player.
      openDetail: proto.local ? undefined : (i) => {
        player.seek(i);
        if (!detailOpen.get()) pushedDetail = true;
        navigate(proto.id, i);
      },
    };
    const example = exampleFor(proto);

    // Drawer listing every protocol by family.
    const drawer = Dialog(t('ui.menu'), 'drawer');
    const drawerList = h('nav', { class: 'drawer-nav', 'aria-label': t('ui.menu') });
    // AI comes first: it is the focus of the lessons.
    for (const fam of ['ai' as const, ...FAMILIES.filter((f) => f !== 'ai')]) {
      const items = PROTOCOLS.filter((p) => p.family === fam);
      if (!items.length) continue;
      const group = h('div', { class: 'drawer-group' }, h('h3', { class: 'drawer-fam' }, caps(t(`fam.${fam}`))));
      group.style.setProperty('--badge-color', `var(--fam-${fam})`);
      for (const p of items) {
        const a = h('a', { href: hashFor(p.id), class: `drawer-link${p.id === proto.id ? ' is-on' : ''}`, 'aria-current': p.id === proto.id ? 'page' : undefined },
          h('span', { class: 'drawer-short' }, p.short), h('span', { class: 'drawer-name' }, t(`p.${p.id}.name`)));
        a.addEventListener('click', () => drawer.close());
        group.append(a);
      }
      drawerList.append(group);
    }
    drawer.body.append(
      h('div', { class: 'drawer-head' }, h('span', { class: 'drawer-title' }, caps(t('ui.menu'))),
        IconButton({ label: t('ui.closeMenu'), icon: 'close', onClick: () => drawer.close() })),
      drawerList,
    );

    // Search palette.
    const palette = Dialog(t('ui.search'), 'palette');
    const input = h('input', { type: 'search', class: 'palette-input', placeholder: t('ui.searchHint'), 'aria-label': t('ui.search'), autocomplete: 'off', spellcheck: 'false',
      role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-results', 'aria-autocomplete': 'list' });
    const results = h('ul', { class: 'palette-results', id: 'palette-results', role: 'listbox', 'aria-label': t('ui.search') });
    let sel = 0;
    let hits = PROTOCOLS;
    const go = (id: string) => {
      palette.close();
      navigate(id);
    };
    const renderResults = () => {
      hits = searchProtocols(input.value, (id) => t(`p.${id}.name`), (f) => t(`fam.${f}`));
      sel = Math.min(sel, Math.max(0, hits.length - 1));
      clear(results);
      if (!hits.length) results.append(h('li', { class: 'palette-empty' }, t('ui.noResults')));
      hits.forEach((p, i) => {
        const li = h('li', { role: 'option', id: `palette-opt-${p.id}`, class: `palette-item${i === sel ? ' is-sel' : ''}`, 'aria-selected': String(i === sel) },
          h('span', { class: 'palette-short' }, p.short), h('span', { class: 'palette-name' }, t(`p.${p.id}.name`)),
          h('span', { class: 'palette-fam' }, t(`fam.${p.family}`)));
        li.style.setProperty('--badge-color', `var(--fam-${p.family})`);
        li.addEventListener('click', () => go(p.id));
        results.append(li);
      });
      const selEl = results.querySelector('.is-sel');
      if (selEl) input.setAttribute('aria-activedescendant', selEl.id);
      else input.removeAttribute('aria-activedescendant');
      selEl?.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', () => {
      sel = 0;
      renderResults();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!hits.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
        renderResults();
      } else if (e.key === 'Enter' && hits[sel]) {
        e.preventDefault();
        go(hits[sel].id);
      }
    });
    palette.body.append(h('div', { class: 'palette-bar' }, svgFromString(icon('search')), input), results);
    const openSearch = () => {
      input.value = '';
      sel = 0;
      renderResults();
      palette.open();
      input.focus();
    };

    // Header.
    const langMenu = Menu('globe', async (code) => {
      safeStorage.set('pe.locale', code);
      await setLocale(code);
    });
    const cur = LOCALES.find((l) => l.code === locale())!;
    cleanups.push(() => langMenu.close());
    langMenu.setTrigger(cur.badge, `${t('ui.language')}: ${cur.native}`);
    langMenu.setItems(LOCALES.map((l) => ({ value: l.code, label: l.native, hint: l.english, badge: l.badge, lang: l.code })), locale());

    const themeCtl = SegmentedControl<Theme>(
      [
        { value: 'light', label: '', icon: 'sun' },
        { value: 'dark', label: '', icon: 'moon' },
      ],
      theme.get(),
      (v) => theme.set(v),
      `${t('ui.themeLight')} / ${t('ui.themeDark')}`,
    );
    themeCtl.el.querySelectorAll('button').forEach((b) => {
      const v = b.getAttribute('data-value');
      b.setAttribute('aria-label', v === 'light' ? t('ui.themeLight') : t('ui.themeDark'));
      b.dataset.tip = v === 'light' ? t('ui.themeLight') : t('ui.themeDark');
    });
    themeCtl.el.classList.add('seg-icons');

    const searchBtn = h('button', { type: 'button', class: 'searchbar' },
      svgFromString(icon('search', 16)), h('span', {}, t('ui.search')), h('kbd', {}, '/'));
    searchBtn.addEventListener('click', openSearch);

    const header = h('header', { class: 'top' },
      IconButton({ label: t('ui.menu'), icon: 'menu', onClick: () => drawer.open() }),
      h('a', { class: 'brand', href: hashFor(DEFAULT_ID) },
        h('span', { class: 'brand-mark' }, svgFromString(icon('logo', 22))),
        h('span', { class: 'brand-text' }, h('span', { class: 'brand-a' }, caps(t('app.title').split(' ')[0] ?? '')), ' ', h('em', { class: 'brand-b' }, caps(t('app.title').split(' ').slice(1).join(' '))))),
      searchBtn,
      h('div', { class: 'top-spacer' }),
      IconButton({ label: t('ui.present'), icon: 'expand', onClick: () => presenting.set(!presenting.get()), className: 'present-btn' }),
      langMenu.el,
      themeCtl.el,
    );

    // Main grid.
    const stageHost = h('div', { class: 'stage-host' });
    const viewSeg = SegmentedControl<View>(
      [
        { value: 'network', label: caps(t('ui.network')), icon: 'network' },
        { value: 'sequence', label: caps(t('ui.sequence')), icon: 'sequence' },
        { value: 'steps', label: caps(t('ui.steps')), icon: 'list' },
      ],
      view.get(),
      (v) => view.set(v),
      `${t('ui.network')} / ${t('ui.sequence')} / ${t('ui.steps')}`,
    );
    const diagram = Panel('', { className: 'panel-diagram' });
    diagram.head.prepend(viewSeg.el);
    // Diagram panel = [ view + narration | real example ].
    const diagramBody = h('div', { class: 'diagram-body' });
    const narrHost = h('div', { class: 'narr-host' });
    const exHost = h('div', { class: 'diagram-ex', hidden: true });
    diagram.body.classList.add('diagram-wrap');
    diagram.body.append(h('div', { class: 'diagram-col' }, diagramBody, narrHost), exHost);
    if (hasNarration(ctx)) cleanups.push(Narration(narrHost, ctx));
    let viewCleanup = () => {};
    const mountView = () => {
      viewCleanup();
      clear(diagramBody);
      diagramBody.className = `diagram-body is-${view.get()}`;
      const v = view.get();
      viewCleanup = v === 'network' ? NetworkView(diagramBody, ctx) : v === 'sequence' ? SequenceView(diagramBody, ctx) : StepsView(diagramBody, ctx);
    };
    mountView();
    cleanups.push(() => viewCleanup());

    // Real example switch (only where an example exists).
    if (example) {
      const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'false', 'data-tip': t('ex.hint') },
        h('span', { class: 'switch-track', 'aria-hidden': 'true' }, h('span', { class: 'switch-knob' })),
        h('span', { class: 'switch-label' }, caps(t('ex.toggle'))));
      sw.addEventListener('click', () => exampleOn.set(!exampleOn.get()));
      diagram.head.append(sw);
      let exCleanup = () => {};
      const syncExample = () => {
        const on = exampleOn.get();
        sw.setAttribute('aria-checked', String(on));
        diagram.el.classList.toggle('has-example', on);
        exHost.hidden = !on;
        exCleanup();
        exCleanup = () => {};
        clear(exHost);
        if (on) exCleanup = ExampleView(exHost, ctx, example);
      };
      syncExample();
      cleanups.push(exampleOn.sub(syncExample), () => exCleanup());
    }
    cleanups.push(view.sub((v) => {
      safeStorage.set('pe.view', v);
      viewSeg.set(v);
      mountView();
    }));

    const overview = Panel(caps(t('ui.overview')), { className: 'panel-overview' });
    const packets = Panel(caps(t('ui.packets')), { className: 'panel-packets' });

    cleanups.push(StageBar(stageHost, ctx));
    cleanups.push(OverviewPanel(overview.body, ctx));
    cleanups.push(PacketTable(packets.body, ctx));

    const main = h('main', { class: 'main', id: 'main', tabindex: -1 }, stageHost, h('div', { class: 'grid' }, diagram.el, overview.el), packets.el);

    // Packet detail: replaces the main area while open.
    const detailHost = h('div', { class: 'detail-host', hidden: true });
    let detail: DetailHandle | null = null;
    let returnFocus: HTMLElement | null = null;
    const closeDetail = () => {
      if (pushedDetail) {
        pushedDetail = false;
        history.back(); // hashchange → route handler closes the view
      } else {
        replaceHash(proto.id);
        detailOpen.set(false);
      }
    };
    const syncDetail = (focus: boolean) => {
      const open = detailOpen.get();
      if (open && !detail) {
        returnFocus = focus ? (document.activeElement as HTMLElement | null) : null;
        detail = PacketDetail(ctx, closeDetail, (i) => replaceHash(proto.id, i));
        detailHost.append(detail.el);
        detailHost.hidden = false;
        main.hidden = true;
        if (focus) detail.focus();
      } else if (!open && detail) {
        detail.destroy();
        detail.el.remove();
        detail = null;
        detailHost.hidden = true;
        main.hidden = false;
        const back = returnFocus && document.contains(returnFocus) ? returnFocus : null;
        returnFocus = null;
        back?.focus();
      }
    };
    syncDetail(false);
    cleanups.push(detailOpen.sub(() => syncDetail(true)));
    cleanups.push(() => detail?.destroy());

    // Player bar.
    const speedMenu = Menu('', (v) => player.setSpeed(Number(v)));
    const setSpeedUi = () => {
      const sp = player.get().speed;
      speedMenu.setTrigger(`${sp}×`, `${t('ui.speed')}: ${sp}×`);
      speedMenu.setItems(SPEEDS.map((x) => ({ value: String(x), label: `${x}×` })), String(sp));
    };
    setSpeedUi();
    cleanups.push(() => speedMenu.close());
    speedMenu.el.classList.add('menu-up', 'speed-menu');
    const backBtn = IconButton({ label: t('ui.back'), icon: 'chevronLeft', onClick: () => player.back(), variant: 'outline', className: 'chevron-flip' });
    const playBtn = Button({ label: caps(t('ui.play')), icon: 'play', variant: 'primary', className: 'play-btn', onClick: () => player.toggle() });
    const nextBtn = IconButton({ label: t('ui.next'), icon: 'chevronRight', onClick: () => player.step(), variant: 'outline', className: 'chevron-flip' });
    const stepBtn = Button({ label: caps(t('ui.step')), variant: 'outline', onClick: () => player.stepAnimated() });
    const resetBtn = IconButton({ label: t('ui.reset'), icon: 'reset', onClick: () => player.reset(), variant: 'outline' });
    const status = h('div', { class: 'status', 'aria-live': 'polite' });
    const bar = h('div', { class: 'playerbar', role: 'toolbar', 'aria-label': t('ui.play') },
      h('div', { class: 'playerbar-inner' }, speedMenu.el, backBtn, playBtn, nextBtn, stepBtn, resetBtn, status));

    let lastPlaying: boolean | null = null;
    let lastStatus = '';
    const syncBar = () => {
      const st = player.get();
      if (st.playing !== lastPlaying) {
        lastPlaying = st.playing;
        setButton(playBtn, { label: caps(t(st.playing ? 'ui.pause' : 'ui.play')), icon: st.playing ? 'pause' : 'play' });
      }
      const text = st.index < 0 && !st.playing ? t('ui.ready')
        : st.index >= st.count - 1 && !st.playing ? `${t('ui.done')} · ${t('ui.packetOf', { n: st.count, total: st.count })}`
        : t('ui.packetOf', { n: Math.min(st.count, st.index + 1 + (st.playing ? 1 : 0)), total: st.count });
      if (text !== lastStatus) {
        lastStatus = text;
        status.textContent = text;
      }
      backBtn.disabled = st.index < 0 && !st.playing;
      nextBtn.disabled = st.index >= st.count - 1;
      setSpeedLabelIfChanged();
    };
    let lastSpeed = player.get().speed;
    const setSpeedLabelIfChanged = () => {
      if (player.get().speed !== lastSpeed) {
        lastSpeed = player.get().speed;
        setSpeedUi();
      }
    };
    syncBar();
    cleanups.push(player.sub(syncBar));

    // Small print lives at the end of the (scrollable) overview card, so the page itself never scrolls.
    overview.body.append(h('div', { class: 'ov-foot' },
      locale() !== 'en' ? h('p', { class: 'foot-note' }, t('app.machineTranslated')) : null,
      REPO_URL ? h('p', {}, h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'GitHub')) : null,
      h('p', { class: 'foot-keys' }, t('ui.keyboard')),
    ));

    root.append(
      h('button', { type: 'button', class: 'skip', onclick: () => main.focus() }, t('ui.skip')),
      header, main, detailHost, bar, drawer.el, palette.el,
    );

    // Keyboard shortcuts.
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target instanceof Element ? e.target : document.body;
      const typing = tgt.closest('input, textarea, select, [contenteditable="true"]');
      if (palette.el.open || drawer.el.open) return;
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key.toLowerCase() === 'e' && example && !detailOpen.get()) {
        exampleOn.set(!exampleOn.get());
        return;
      }
      if (e.key.toLowerCase() === 'p') {
        presenting.set(!presenting.get());
        return;
      }
      if (e.key === 'Escape' && presenting.get() && !detailOpen.get()) {
        presenting.set(false);
        return;
      }
      if (e.key === ' ' && !tgt.closest('button, a, [role="radio"], [role="button"], tr')) {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'ArrowRight' && !tgt.closest('[role="radiogroup"], [role="menu"]')) {
        document.documentElement.dir === 'rtl' ? player.back() : player.step();
      } else if (e.key === 'ArrowLeft' && !tgt.closest('[role="radiogroup"], [role="menu"]')) {
        document.documentElement.dir === 'rtl' ? player.step() : player.back();
      }
    };
    document.addEventListener('keydown', onKey);
    cleanups.push(() => document.removeEventListener('keydown', onKey));
  };

  const applyMsg = () => {
    const msg = parseMsg(location.hash);
    const proto = byId(protocolId.get())!;
    const count = proto.packets.length;
    if (msg !== null && msg < count && !proto.local) {
      if (player.get().index !== msg) player.seek(msg);
      detailOpen.set(true);
    } else {
      pushedDetail = false;
      detailOpen.set(false);
    }
  };

  applyMsg();
  render();
  onLocaleChange(render);

  protocolId.sub((id) => {
    player.load(byId(id)!.packets.length);
    render();
    window.scrollTo({ top: 0 });
  });
  onRoute((id) => {
    const p = id ? byId(id) : undefined;
    if (p) {
      protocolId.set(p.id);
      applyMsg();
    } else if (location.hash) navigate(protocolId.get());
  });
}
