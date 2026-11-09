// App shell: header, protocol drawer, search palette, main grid of views, player bar.
import { Player, SPEEDS } from './core/player';
import { hashFor, navigate, onRoute, parseHash } from './core/router';
import { safeStorage, Signal } from './core/store';
import { detectLocale } from './i18n/detect';
import { caps, locale, onLocaleChange, setLocale, t } from './i18n/i18n';
import { LOCALES } from './i18n/locales';
import { icon } from './icons/ui';
import { PROTOCOLS, byId, searchProtocols } from './protocols';
import { FAMILIES } from './protocols/types';
import { Button, Dialog, IconButton, Menu, Panel, SegmentedControl, setButton } from './ui/components';
import { clear, h, svgFromString } from './ui/dom';
import { NetworkView } from './views/NetworkView';
import { OverviewPanel } from './views/OverviewPanel';
import { PacketTable } from './views/PacketTable';
import { SequenceView } from './views/SequenceView';
import { StageBar } from './views/StageBar';
import type { ViewCtx } from './views/context';

type View = 'network' | 'sequence';
type Theme = 'dark' | 'light';

const DEFAULT_ID = 'http';
const REPO_URL = '';


export async function startApp(root: HTMLElement): Promise<void> {
  const protocolId = new Signal<string>(byId(parseHash(location.hash) ?? '')?.id ?? DEFAULT_ID);
  const view = new Signal<View>((safeStorage.get('pe.view') as View) === 'sequence' ? 'sequence' : 'network');
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
    const ctx: ViewCtx = { protocol: proto, player };

    // Drawer listing every protocol by family.
    const drawer = Dialog(t('ui.menu'), 'drawer');
    const drawerList = h('nav', { class: 'drawer-nav', 'aria-label': t('ui.menu') });
    for (const fam of FAMILIES) {
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
      langMenu.el,
      themeCtl.el,
    );

    // Main grid.
    const stageHost = h('div', { class: 'stage-host' });
    const viewSeg = SegmentedControl<View>(
      [
        { value: 'network', label: caps(t('ui.network')), icon: 'network' },
        { value: 'sequence', label: caps(t('ui.sequence')), icon: 'sequence' },
      ],
      view.get(),
      (v) => view.set(v),
      `${t('ui.network')} / ${t('ui.sequence')}`,
    );
    const diagram = Panel('', { className: 'panel-diagram' });
    diagram.head.prepend(viewSeg.el);
    const diagramBody = diagram.body;
    let viewCleanup = () => {};
    const mountView = () => {
      viewCleanup();
      clear(diagramBody);
      diagramBody.className = `panel-body diagram-body is-${view.get()}`;
      viewCleanup = view.get() === 'network' ? NetworkView(diagramBody, ctx) : SequenceView(diagramBody, ctx);
    };
    mountView();
    cleanups.push(() => viewCleanup());
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
      header, main, bar, drawer.el, palette.el,
    );

    // Keyboard shortcuts.
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      const typing = tgt.closest('input, textarea, select, [contenteditable="true"]');
      if (palette.el.open || drawer.el.open) return;
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === ' ' && !tgt.closest('button, a, [role="radio"], tr')) {
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

  render();
  onLocaleChange(render);

  protocolId.sub((id) => {
    player.load(byId(id)!.packets.length);
    render();
    window.scrollTo({ top: 0 });
  });
  onRoute((id) => {
    const p = id ? byId(id) : undefined;
    if (p) protocolId.set(p.id);
    else if (location.hash) navigate(protocolId.get());
  });
}
