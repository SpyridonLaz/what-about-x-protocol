import type { Protocol } from '../protocols/types';
import { AI_EXAMPLES } from './ai';
import type { Example } from './types';

export type { Example, SceneEvent, SceneRole, WireLang, WireMsg } from './types';

export const EXAMPLES: Record<string, Example> = AI_EXAMPLES;

/** The real example of a scenario, or undefined when none has been written (only AI entries have one). */
export function exampleFor(p: Protocol): Example | undefined {
  return Object.prototype.hasOwnProperty.call(EXAMPLES, p.id) ? EXAMPLES[p.id] : undefined;
}

/** Structural problems of an example against its scenario (used by the content check and tests). */
export function validateExample(p: Protocol, ex: Example): string[] {
  const errs: string[] = [];
  const at = (msg: string) => errs.push(`[${p.id}] example: ${msg}`);
  if (!ex.app.trim()) at('missing app title');
  if (ex.wire.length !== p.packets.length) at(`${ex.wire.length} wire messages for ${p.packets.length} packets`);
  ex.wire.forEach((m, i) => {
    if (!m.body.trim()) at(`wire message ${i + 1} is empty`);
  });
  let last = -1;
  ex.scene.forEach((ev, i) => {
    if (!Number.isInteger(ev.at) || ev.at < 0 || ev.at >= p.packets.length) at(`scene event ${i + 1} points at packet ${ev.at + 1}, which does not exist`);
    if (ev.at < last) at(`scene event ${i + 1} goes back in time`);
    last = Math.max(last, ev.at);
    if (!ev.text.trim()) at(`scene event ${i + 1} is empty`);
  });
  if (!ex.scene.length) at('scene is empty');
  return errs;
}

export interface SceneItem {
  role: Example['scene'][number]['role'];
  text: string;
  /** True for the newest item when it belongs to the focused packet (it is typed out while in flight). */
  live: boolean;
}

/**
 * What the mock screen shows when packet `focus` is the current one (-1 = nothing sent yet).
 * `progress` (0..1) is how far the focused packet has travelled: text of an item that belongs
 * to it is cut to that share, so it types itself out. Pass 1 for a packet that has arrived.
 */
export function sceneAt(ex: Example, focus: number, progress = 1): SceneItem[] {
  const items: SceneItem[] = [];
  for (const ev of ex.scene) {
    if (ev.at > focus) break;
    const live = ev.at === focus;
    const k = Math.max(0, Math.min(1, progress));
    // A growing text keeps what was already on screen and types only the new part.
    let prev: SceneItem | undefined;
    if (ev.replace) for (let j = items.length - 1; j >= 0 && !prev; j--) if (items[j].role === ev.role) prev = items[j];
    const keep = prev && ev.text.startsWith(prev.text) ? prev.text.length : 0;
    const text = live && k < 1 ? ev.text.slice(0, keep + Math.ceil((ev.text.length - keep) * k)) : ev.text;
    if (prev) {
      prev.text = text;
      prev.live = live;
    } else items.push({ role: ev.role, text, live });
  }
  return items;
}
