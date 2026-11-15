import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../src/core/player';
import { byId } from '../src/protocols';
import { PacketDetail } from '../src/views/PacketDetail';
import { StepsView } from '../src/views/StepsView';
import { SequenceView } from '../src/views/SequenceView';
import { PacketTable } from '../src/views/PacketTable';
import { dissect } from '../src/dissect';
import type { ViewCtx } from '../src/views/context';

const proto = byId('http')!;
const make = (extra: Partial<ViewCtx> = {}) => {
  const player = new Player(proto.packets.length, 1000);
  const ctx: ViewCtx = { protocol: proto, player, ...extra };
  return { player, ctx };
};

// jsdom does not implement scrollTo; the views call it to keep the current row visible.
Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('PacketDetail', () => {
  it('renders message 1 when the player has not started', () => {
    const { ctx } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    expect(d.el.querySelector('.detail-no')!.textContent).toBe('1');
    d.destroy();
  });

  it('shows the SYN title after seek(2)', () => {
    const { ctx, player } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    player.seek(2);
    expect(d.el.querySelector('.detail-title')!.textContent).toBe('SYN');
    expect(d.el.querySelector('.detail-no')!.textContent).toBe('3');
    d.destroy();
  });

  it('reports the shown index through onIndex', () => {
    const { ctx, player } = make();
    const onIndex = vi.fn();
    const d = PacketDetail(ctx, () => {}, onIndex);
    player.seek(4);
    expect(onIndex).toHaveBeenLastCalledWith(4);
    d.destroy();
  });

  it('the next button seeks forward and re-renders', () => {
    const { ctx, player } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    player.seek(2);
    const next = d.el.querySelector<HTMLButtonElement>('button[aria-label="Next message"], .detail-nav button:nth-child(2)')!;
    next.click();
    expect(player.get().index).toBe(3);
    expect(d.el.querySelector('.detail-no')!.textContent).toBe('4');
    d.destroy();
  });

  it('the previous button seeks back', () => {
    const { ctx, player } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    player.seek(2);
    d.el.querySelectorAll<HTMLButtonElement>('.detail-nav button')[0].click();
    expect(player.get().index).toBe(1);
    d.destroy();
  });

  it('previous is disabled at the first message and next at the last', () => {
    const { ctx, player } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    player.seek(0);
    let btns = d.el.querySelectorAll<HTMLButtonElement>('.detail-nav button');
    expect(btns[0].disabled).toBe(true);
    expect(btns[1].disabled).toBe(false);
    player.seek(proto.packets.length - 1);
    btns = d.el.querySelectorAll<HTMLButtonElement>('.detail-nav button');
    expect(btns[0].disabled).toBe(false);
    expect(btns[1].disabled).toBe(true);
    d.destroy();
  });

  it('the close button calls onClose', () => {
    const { ctx } = make();
    const onClose = vi.fn();
    const d = PacketDetail(ctx, onClose, () => {});
    host.append(d.el);
    d.el.querySelectorAll<HTMLButtonElement>('.detail-nav button')[2].click();
    expect(onClose).toHaveBeenCalledTimes(1);
    d.destroy();
  });

  it('Escape calls onClose', () => {
    const { ctx } = make();
    const onClose = vi.fn();
    const d = PacketDetail(ctx, onClose, () => {});
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    d.destroy();
  });

  it('Escape is ignored while a dialog is open', () => {
    const { ctx } = make();
    const onClose = vi.fn();
    const d = PacketDetail(ctx, onClose, () => {});
    const dlg = document.createElement('dialog');
    dlg.setAttribute('open', '');
    document.body.append(dlg);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    d.destroy();
  });

  it('destroy stops reacting to the player and to Escape', () => {
    const { ctx, player } = make();
    const onClose = vi.fn();
    const d = PacketDetail(ctx, onClose, () => {});
    host.append(d.el);
    d.destroy();
    player.seek(5);
    expect(d.el.querySelector('.detail-no')!.textContent).toBe('1');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hex dump has one cell per byte and opaque cells show ··', () => {
    const tp = byId('https')!;
    const player = new Player(tp.packets.length, 1000);
    const d = PacketDetail({ protocol: tp, player }, () => {}, () => {});
    host.append(d.el);
    const i = tp.packets.findIndex((x) => /Client Hello/.test(x.info));
    player.seek(i);
    const dis = dissect(tp, i);
    const cells = d.el.querySelectorAll('.hex-bytes .hb');
    expect(cells.length).toBe(Math.min(dis.bytes.length, 4096));
    const opaqueCount = dis.opaque.slice(0, cells.length).filter(Boolean).length;
    expect(opaqueCount).toBeGreaterThan(0);
    const shown = [...cells].filter((c) => c.textContent === '··');
    expect(shown.length).toBe(opaqueCount);
    d.destroy();
  });

  it('caps the dump at 4096 bytes and shows a "more" line for big frames', () => {
    const big = byId('ftp')!;
    const player = new Player(big.packets.length, 1000);
    const d = PacketDetail({ protocol: big, player }, () => {}, () => {});
    host.append(d.el);
    const i = big.packets.findIndex((x) => x.proto === 'FTP-DATA');
    player.seek(i);
    expect(d.el.querySelectorAll('.hex-bytes .hb').length).toBe(4096);
    expect(d.el.querySelector('.hex-more')).not.toBeNull();
    d.destroy();
  });

  it('field rows carry data-off / data-len matching the dissection', () => {
    const { ctx, player } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    player.seek(2);
    const rows = d.el.querySelectorAll<HTMLElement>('button.dt-field');
    expect(rows.length).toBeGreaterThan(10);
    const total = dissect(proto, 2).bytes.length;
    rows.forEach((r) => {
      if (r.dataset.off === undefined) return;
      expect(Number(r.dataset.off) + Number(r.dataset.len)).toBeLessThanOrEqual(total);
    });
    d.destroy();
  });

  it('hovering a field highlights exactly its bytes; focusing too', () => {
    const { ctx, player } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    player.seek(2);
    const rows = [...d.el.querySelectorAll<HTMLElement>('button.dt-field')].filter((r) => Number(r.dataset.len) > 1);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    const off = Number(row.dataset.off);
    const len = Number(row.dataset.len);
    row.dispatchEvent(new MouseEvent('mouseenter'));
    const lit = [...d.el.querySelectorAll<HTMLElement>('.hex-bytes .hb.is-hl')].map((c) => Number(c.dataset.i));
    expect(lit).toEqual(Array.from({ length: len }, (_, k) => off + k));
    expect(row.classList.contains('is-hl')).toBe(true);

    const other = rows[rows.length - 1];
    other.dispatchEvent(new FocusEvent('focus'));
    expect(row.classList.contains('is-hl')).toBe(other === row);
    const lit2 = d.el.querySelectorAll('.hex-bytes .hb.is-hl');
    expect(lit2.length).toBe(Number(other.dataset.len));
    d.destroy();
  });

  it('mouse leaving the fields clears the highlight', () => {
    const { ctx, player } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    player.seek(2);
    const row = d.el.querySelector<HTMLElement>('button.dt-field')!;
    row.dispatchEvent(new MouseEvent('mouseenter'));
    expect(d.el.querySelectorAll('.is-hl').length).toBeGreaterThan(0);
    d.el.querySelector('.detail-fields')!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(d.el.querySelectorAll('.is-hl').length).toBe(0);
    d.destroy();
  });

  it('focus() focuses the heading', () => {
    const { ctx } = make();
    const d = PacketDetail(ctx, () => {}, () => {});
    host.append(d.el);
    d.focus();
    expect(document.activeElement).toBe(d.el.querySelector('.detail-title'));
    d.destroy();
  });
});

describe('StepsView', () => {
  it('renders one button per packet, grouped by stage', () => {
    const { ctx } = make();
    const stop = StepsView(host, ctx);
    expect(host.querySelectorAll('button.step-btn').length).toBe(proto.packets.length);
    const stages = new Set(proto.packets.map((p) => p.stage));
    expect(host.querySelectorAll('li.steps-stage').length).toBe(stages.size);
    // each group holds exactly the packets of its stage
    const sizes = [...host.querySelectorAll('li.steps-stage')].map((li) => li.querySelectorAll('li.step').length);
    const expected = [...stages].sort((a, b) => a - b).map((s) => proto.packets.filter((p) => p.stage === s).length);
    expect(sizes).toEqual(expected);
    stop();
  });

  it('the current class follows the player', () => {
    const { ctx, player } = make();
    const stop = StepsView(host, ctx);
    player.seek(3);
    const items = [...host.querySelectorAll('li.step')];
    expect(items[3].classList.contains('is-current')).toBe(true);
    expect(items[3].getAttribute('aria-current')).toBe('step');
    expect(items[0].classList.contains('is-done')).toBe(true);
    expect(items[4].classList.contains('is-future')).toBe(true);
    expect(host.querySelectorAll('li.is-current').length).toBe(1);
    player.seek(5);
    expect(items[3].classList.contains('is-done')).toBe(true);
    expect(items[3].hasAttribute('aria-current')).toBe(false);
    stop();
  });

  it('click calls ctx.openDetail with the packet index', () => {
    const openDetail = vi.fn();
    const { ctx } = make({ openDetail });
    const stop = StepsView(host, ctx);
    host.querySelectorAll<HTMLButtonElement>('button.step-btn')[4].click();
    expect(openDetail).toHaveBeenCalledWith(4);
    stop();
  });

  it('click falls back to seeking when openDetail is missing', () => {
    const { ctx, player } = make();
    const stop = StepsView(host, ctx);
    host.querySelectorAll<HTMLButtonElement>('button.step-btn')[4].click();
    expect(player.get().index).toBe(4);
    stop();
  });

  it('cleanup unsubscribes from the player', () => {
    const { ctx, player } = make();
    const stop = StepsView(host, ctx);
    stop();
    player.seek(6);
    expect(host.querySelector('li.is-current')?.isSameNode(host.querySelectorAll('li.step')[6])).toBeFalsy();
  });
});

describe('SequenceView', () => {
  it('arrows are focusable buttons with labels', () => {
    const { ctx } = make();
    const stop = SequenceView(host, ctx);
    const arrows = host.querySelectorAll('g.seq-msg');
    expect(arrows.length).toBe(proto.packets.length);
    expect(arrows[0].getAttribute('role')).toBe('button');
    expect(arrows[0].getAttribute('tabindex')).toBe('0');
    expect(arrows[0].getAttribute('aria-label')).toBeTruthy();
    stop();
  });

  it('click calls ctx.openDetail', () => {
    const openDetail = vi.fn();
    const { ctx } = make({ openDetail });
    const stop = SequenceView(host, ctx);
    host.querySelectorAll('g.seq-msg')[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(openDetail).toHaveBeenCalledWith(2);
    stop();
  });

  it.each(['Enter', ' '])('key %j calls ctx.openDetail', (key) => {
    const openDetail = vi.fn();
    const { ctx } = make({ openDetail });
    const stop = SequenceView(host, ctx);
    host.querySelectorAll('g.seq-msg')[1].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(openDetail).toHaveBeenCalledWith(1);
    stop();
  });

  it('other keys do nothing', () => {
    const openDetail = vi.fn();
    const { ctx } = make({ openDetail });
    const stop = SequenceView(host, ctx);
    host.querySelectorAll('g.seq-msg')[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(openDetail).not.toHaveBeenCalled();
    stop();
  });

  it('falls back to seek without openDetail', () => {
    const { ctx, player } = make();
    const stop = SequenceView(host, ctx);
    host.querySelectorAll('g.seq-msg')[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.get().index).toBe(3);
    stop();
  });
});

describe('PacketTable', () => {
  it('row click calls ctx.openDetail', () => {
    const openDetail = vi.fn();
    const { ctx } = make({ openDetail });
    const stop = PacketTable(host, ctx);
    const rows = host.querySelectorAll('tbody tr');
    expect(rows.length).toBe(proto.packets.length);
    rows[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(openDetail).toHaveBeenCalledWith(3);
    stop?.();
  });
});
