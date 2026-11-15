// Packet dissection model: what the packet detail view shows for one message.
// Field names and notes are i18n keys (dis.*); values are wire values and never translated.

export interface Field {
  /** i18n key of the field name, e.g. 'dis.ipv4.ttl'. */
  key: string;
  /** Wire value as text, e.g. "64" or "0x0800 (IPv4)". */
  value: string;
  /** i18n key of a one-line explanation, if any. */
  note?: string;
  /** Placeholder values for the note, e.g. { node: 'Router' } (already translated). */
  vars?: Record<string, string>;
  /** The value is an example: it differs in every real capture. */
  example?: boolean;
  /** Byte range inside Dissection.bytes. */
  offset: number;
  length: number;
  children?: Field[];
}

export interface Layer {
  id: string;
  /** i18n key of the layer name, or a literal protocol label (when `literal`). */
  label: string;
  literal?: boolean;
  /** Short wire summary shown next to the layer name, e.g. "192.168.1.10 → 203.0.113.10". */
  summary: string;
  offset: number;
  length: number;
  fields: Field[];
}

export interface Dissection {
  layers: Layer[];
  bytes: Uint8Array;
  /** true where the lesson can't show the real byte (encrypted, random, file contents). */
  opaque: boolean[];
  /** i18n key of the "where this was seen" line, plus its placeholder values. */
  context: { key: string; vars: Record<string, string> };
}
