// Reusable UI components. Each is a small factory returning a DOM element (plus an
// update handle where the component has state). Styling lives in styles/app.css and uses tokens only.
import { icon } from '../icons/ui';
import { clear, h, svgFromString } from './dom';

/* ---------- Button / IconButton ---------- */

export interface ButtonProps {
  label: string;
  icon?: string;
  variant?: 'primary' | 'ghost' | 'outline';
  /** Hide the text visually but keep it for screen readers (icon-only button). */
  iconOnly?: boolean;
  onClick?: (e: MouseEvent) => void;
  title?: string;
  className?: string;
}

export function Button(p: ButtonProps): HTMLButtonElement {
  const btn = h('button', {
    type: 'button',
    class: `btn btn-${p.variant ?? 'outline'}${p.iconOnly ? ' btn-icon' : ''}${p.className ? ' ' + p.className : ''}`,
    'aria-label': p.iconOnly ? p.label : undefined,
    'data-tip': p.iconOnly ? (p.title ?? p.label) : p.title,
  });
  setButton(btn, p);
  if (p.onClick) btn.addEventListener('click', p.onClick as EventListener);
  return btn;
}

/** Update a button's label and icon in place (e.g. Play ⇄ Pause, after a language switch). */
export function setButton(btn: HTMLButtonElement, p: Pick<ButtonProps, 'label' | 'icon' | 'iconOnly' | 'title'>): void {
  clear(btn);
  if (p.icon) btn.append(svgFromString(icon(p.icon)));
  if (p.iconOnly) {
    btn.setAttribute('aria-label', p.label);
    btn.dataset.tip = p.title ?? p.label;
  } else {
    btn.append(h('span', { class: 'btn-label' }, p.label));
  }
}

export function IconButton(p: Omit<ButtonProps, 'iconOnly'> & { icon: string }): HTMLButtonElement {
  return Button({ ...p, iconOnly: true, variant: p.variant ?? 'ghost' });
}

/* ---------- SegmentedControl ---------- */

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

export interface SegmentedHandle<T extends string> {
  el: HTMLElement;
  set(value: T): void;
  relabel(segments: Segment<T>[]): void;
}

export function SegmentedControl<T extends string>(
  segments: Segment<T>[],
  value: T,
  onChange: (v: T) => void,
  ariaLabel: string,
): SegmentedHandle<T> {
  const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': ariaLabel });
  let current = value;
  const buttons = new Map<T, HTMLButtonElement>();

  const render = (segs: Segment<T>[]) => {
    clear(el);
    buttons.clear();
    for (const s of segs) {
      const b = h('button', { type: 'button', class: 'seg-btn', role: 'radio', 'data-value': s.value });
      if (s.icon) b.append(svgFromString(icon(s.icon, 15)));
      b.append(h('span', {}, s.label));
      b.addEventListener('click', () => {
        if (current !== s.value) {
          set(s.value);
          onChange(s.value);
        }
      });
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const vals = segs.map((x) => x.value);
        const rtl = getComputedStyle(el).direction === 'rtl';
        const fwd = (e.key === 'ArrowRight') !== rtl;
        const i = (vals.indexOf(current) + (fwd ? 1 : -1) + vals.length) % vals.length;
        set(vals[i]);
        onChange(vals[i]);
        buttons.get(vals[i])?.focus();
      });
      buttons.set(s.value, b);
      el.append(b);
    }
    set(current);
  };

  const set = (v: T) => {
    current = v;
    buttons.forEach((b, k) => {
      const on = k === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  };

  render(segments);
  return { el, set, relabel: render };
}

/* ---------- Panel ---------- */

export interface PanelHandle {
  el: HTMLElement;
  body: HTMLElement;
  head: HTMLElement;
  setTitle(title: string): void;
}

/** Framed section with a mono title and corner ticks. */
export function Panel(title: string, opts: { className?: string; actions?: Node[] } = {}): PanelHandle {
  const titleEl = h('h2', { class: 'panel-title' }, title);
  const head = h('div', { class: 'panel-head' }, titleEl, h('div', { class: 'panel-actions' }, opts.actions ?? []));
  const body = h('div', { class: 'panel-body' });
  const el = h('section', { class: `panel${opts.className ? ' ' + opts.className : ''}` },
    h('span', { class: 'tick tl' }), h('span', { class: 'tick tr' }), h('span', { class: 'tick bl' }), h('span', { class: 'tick br' }),
    head, body);
  return { el, body, head, setTitle: (t) => (titleEl.textContent = t) };
}

/* ---------- Badge ---------- */

export function Badge(text: string, tone: 'accent' | 'ok' | 'warn' | 'family' = 'accent', family?: string): HTMLSpanElement {
  const el = h('span', { class: `badge badge-${tone}` }, text);
  if (family) el.style.setProperty('--badge-color', `var(--fam-${family})`);
  return el;
}

/* ---------- KeyValueGrid ---------- */

export function KeyValueGrid(rows: [string, string][]): HTMLDListElement {
  return h('dl', { class: 'kv' }, rows.map(([k, v]) => h('div', { class: 'kv-row' }, h('dt', {}, k), h('dd', {}, v))));
}

/* ---------- DataTable ---------- */

export interface Column<R> {
  key: string;
  label: string;
  cell: (row: R, i: number) => string | Node;
  className?: string;
}

export interface TableHandle<R> {
  el: HTMLElement;
  rows: HTMLTableRowElement[];
  setColumns(cols: Column<R>[]): void;
  setRows(data: R[]): void;
}

export function DataTable<R>(columns: Column<R>[], onRowClick?: (i: number) => void, caption?: string): TableHandle<R> {
  const table = h('table', { class: 'table' });
  const wrap = h('div', { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': caption ?? '' }, table);
  let cols = columns;
  let data: R[] = [];
  const handle: TableHandle<R> = {
    el: wrap,
    rows: [],
    setColumns(c) {
      cols = c;
      render();
    },
    setRows(d) {
      data = d;
      render();
    },
  };
  const render = () => {
    clear(table);
    table.append(h('thead', {}, h('tr', {}, cols.map((c) => h('th', { scope: 'col', class: c.className }, c.label)))));
    const tbody = h('tbody');
    handle.rows = data.map((row, i) => {
      const tr = h('tr', { 'data-i': i }, cols.map((c) => h('td', { class: c.className }, c.cell(row, i))));
      if (onRowClick) {
        tr.tabIndex = 0;
        tr.addEventListener('click', () => onRowClick(i));
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRowClick(i);
          }
        });
      }
      tbody.append(tr);
      return tr;
    });
    table.append(tbody);
  };
  render();
  return handle;
}

/* ---------- Menu (dropdown) ---------- */

export interface MenuItem {
  value: string;
  label: string;
  hint?: string;
  badge?: string;
  lang?: string;
}

export interface MenuHandle {
  el: HTMLElement;
  setItems(items: MenuItem[], selected: string): void;
  setTrigger(label: string, ariaLabel: string): void;
  close(): void;
}

export function Menu(triggerIcon: string, onSelect: (v: string) => void): MenuHandle {
  const trigger = h('button', { type: 'button', class: 'btn btn-ghost menu-trigger', 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
  const list = h('div', { class: 'menu-list', role: 'menu', hidden: true });
  const el = h('div', { class: 'menu' }, trigger, list);
  let triggerLabel = '';

  const open = () => {
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    (list.querySelector('[aria-checked="true"]') as HTMLElement | null ?? list.querySelector('button'))?.focus();
    document.addEventListener('pointerdown', outside, true);
  };
  const close = () => {
    if (list.hidden) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
  };
  const outside = (e: Event) => {
    if (!el.contains(e.target as Node)) close();
  };

  trigger.addEventListener('click', () => (list.hidden ? open() : close()));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) {
      e.stopPropagation();
      close();
      trigger.focus();
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !list.hidden) {
      e.preventDefault();
      const items = [...list.querySelectorAll<HTMLButtonElement>('button')];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      next?.focus();
    }
  });

  return {
    el,
    close,
    setTrigger(label, ariaLabel) {
      triggerLabel = label;
      clear(trigger);
      if (triggerIcon) trigger.append(svgFromString(icon(triggerIcon, 16)));
      trigger.append(h('span', { class: 'btn-label' }, triggerLabel), svgFromString(icon('chevronDown', 14)));
      trigger.setAttribute('aria-label', ariaLabel);
    },
    setItems(items, selected) {
      clear(list);
      for (const it of items) {
        const b = h('button', { type: 'button', role: 'menuitemradio', class: 'menu-item', 'aria-checked': String(it.value === selected), lang: it.lang },
          it.badge ? h('span', { class: 'menu-badge' }, it.badge) : null,
          h('span', { class: 'menu-label' }, it.label),
          it.hint ? h('span', { class: 'menu-hint' }, it.hint) : null);
        b.addEventListener('click', () => {
          close();
          trigger.focus();
          onSelect(it.value);
        });
        list.append(b);
      }
    },
  };
}

/* ---------- Dialog ---------- */

export interface DialogHandle {
  el: HTMLDialogElement;
  body: HTMLElement;
  open(): void;
  close(): void;
}

export function Dialog(ariaLabel: string, className = ''): DialogHandle {
  const body = h('div', { class: 'dialog-body' });
  const el = h('dialog', { class: `dialog ${className}`, 'aria-label': ariaLabel }, body);
  el.addEventListener('click', (e) => {
    if (e.target === el) el.close(); // click on the backdrop
  });
  return {
    el,
    body,
    open: () => {
      if (!el.open) el.showModal();
    },
    close: () => el.close(),
  };
}

/* ---------- Toast ---------- */

let toastHost: HTMLElement | null = null;

export function toast(message: string, ms = 2600): void {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const t = h('div', { class: 'toast' }, message);
  toastHost.append(t);
  setTimeout(() => t.remove(), ms);
}
