// Byte writer that remembers where each field lives, plus the internet checksum.
import type { Field, Layer } from './types';

export class ByteWriter {
  readonly bytes: number[] = [];
  readonly opaque: boolean[] = [];

  get pos(): number {
    return this.bytes.length;
  }

  u8(v: number, opaque = false): void {
    this.bytes.push(v & 0xff);
    this.opaque.push(opaque);
  }

  u16(v: number): void {
    this.u8(v >>> 8);
    this.u8(v);
  }

  u24(v: number): void {
    this.u8(v >>> 16);
    this.u16(v);
  }

  u32(v: number): void {
    this.u16(v >>> 16);
    this.u16(v);
  }

  raw(list: ArrayLike<number>, opaque = false): void {
    for (let i = 0; i < list.length; i++) this.u8(list[i], opaque);
  }

  ascii(s: string): void {
    for (const ch of s) {
      const c = ch.codePointAt(0)!;
      if (c < 0x80) this.u8(c);
      else this.raw(new TextEncoder().encode(ch));
    }
  }

  /** Bytes the lesson can't show. Filled with a stable pseudo-random pattern so the dump looks real. */
  opaqueFill(n: number, seed: number): void {
    let x = (seed >>> 0) || 0x9e3779b9;
    for (let i = 0; i < n; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.u8(x >>> 0, true);
    }
  }

  set16(at: number, v: number): void {
    this.bytes[at] = (v >>> 8) & 0xff;
    this.bytes[at + 1] = v & 0xff;
  }

  set8(at: number, v: number): void {
    this.bytes[at] = v & 0xff;
  }
}

/** RFC 1071 ones'-complement checksum over byte lists. */
export function inetChecksum(...parts: ArrayLike<number>[]): number {
  let sum = 0;
  let odd: number | null = null;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      if (odd === null) odd = part[i];
      else {
        sum += (odd << 8) | part[i];
        odd = null;
      }
    }
  }
  if (odd !== null) sum += odd << 8;
  while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
  return ~sum & 0xffff;
}

/** Builds one layer: each `field()` call writes bytes and records their range. */
export class LayerBuilder {
  readonly layer: Layer;
  private stack: Field[][] = [];

  constructor(readonly w: ByteWriter, id: string, label: string, summary = '', literal = false) {
    this.layer = { id, label, literal, summary, offset: w.pos, length: 0, fields: [] };
    this.stack.push(this.layer.fields);
  }

  field(key: string, value: string, write: () => void, opts: Partial<Pick<Field, 'note' | 'example' | 'vars'>> = {}): Field {
    const offset = this.w.pos;
    write();
    const f: Field = { key, value, offset, length: this.w.pos - offset, ...opts };
    this.stack[this.stack.length - 1].push(f);
    return f;
  }

  /** A field with nested children (e.g. TCP options). */
  group(key: string, value: (len: number) => string, body: () => void, opts: Partial<Pick<Field, 'note' | 'example'>> = {}): Field {
    const offset = this.w.pos;
    const f: Field = { key, value: '', offset, length: 0, children: [], ...opts };
    this.stack[this.stack.length - 1].push(f);
    this.stack.push(f.children!);
    body();
    this.stack.pop();
    f.length = this.w.pos - offset;
    f.value = value(f.length);
    if (!f.children!.length) delete f.children;
    return f;
  }

  done(): Layer {
    this.layer.length = this.w.pos - this.layer.offset;
    return this.layer;
  }
}

export const hex = (v: number, digits = 4): string => `0x${v.toString(16).padStart(digits, '0')}`;

/** Small stable string hash (FNV-1a), for deterministic example values. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
