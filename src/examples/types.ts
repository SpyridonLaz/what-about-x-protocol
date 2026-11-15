// "Real example" data: what one concrete run of a scenario looks like — on the user's
// screen (scene) and on the wire (the full content of every message).
// Like packet info lines, this content is example data and is never translated.

/** How a wire text is coloured: `http` starts in the header block, `json`/`sse` in the body, `text` is plain. */
export type WireLang = 'http' | 'json' | 'sse' | 'text';

export interface WireMsg {
  lang: WireLang;
  body: string;
}

/**
 * One thing that appears on the mock screen.
 * user = right bubble, assistant = left bubble, tool = a tool call chip,
 * result = a tool result chip, status = a small centred line.
 */
export type SceneRole = 'user' | 'assistant' | 'tool' | 'result' | 'status';

export interface SceneEvent {
  /** 0-based packet index at which it appears (while that packet is in flight, text is typed out). */
  at: number;
  role: SceneRole;
  text: string;
  /** Replace the previous event of the same role instead of adding a new one (growing text). */
  replace?: boolean;
}

export interface Example {
  /** Title of the mock screen (never translated, like the content). */
  app: string;
  /** `node.*` keys naming the two speakers; default: You / Assistant. */
  names?: { user?: string; assistant?: string };
  scene: SceneEvent[];
  /** Full wire content, one entry per packet (same order as the scenario's packets). */
  wire: WireMsg[];
}
