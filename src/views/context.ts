import type { Player, PlayerState } from '../core/player';
import type { Packet, Protocol } from '../protocols/types';

export interface ViewCtx {
  protocol: Protocol;
  player: Player;
  /** Open the packet detail view at a message (seeks the player there). */
  openDetail?: (index: number) => void;
}

/** Packet that is "current" for highlighting: the one in flight, else the last one that arrived. */
export function focusIndex(s: PlayerState): number {
  if (s.playing && s.index < s.count - 1) return s.index + 1;
  return s.index;
}

export function packetState(i: number, s: PlayerState): 'done' | 'current' | 'future' {
  const f = focusIndex(s);
  if (i === f) return 'current';
  return i < f ? 'done' : 'future';
}

export function activeStage(p: Protocol, s: PlayerState): number {
  const f = focusIndex(s);
  return f >= 0 ? p.packets[f].stage : -1;
}

export function formatTime(t: number, loc: string): string {
  return new Intl.NumberFormat(loc, { minimumFractionDigits: 3, maximumFractionDigits: 3, numberingSystem: 'latn' } as Intl.NumberFormatOptions).format(t) + 's';
}

export function formatSize(bytes: number, loc: string): string {
  const nf = (d: number) => new Intl.NumberFormat(loc, { maximumFractionDigits: d, numberingSystem: 'latn' } as Intl.NumberFormatOptions);
  if (bytes < 1024) return `${nf(0).format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${nf(1).format(bytes / 1024)} KB`;
  return `${nf(1).format(bytes / 1024 / 1024)} MB`;
}

export function nodeName(p: Protocol, id: string): string {
  return p.nodes.find((n) => n.id === id)?.addr ?? id;
}

export type { Packet };
