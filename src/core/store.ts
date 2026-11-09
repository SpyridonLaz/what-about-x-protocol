/** Minimal observable value. */
export class Signal<T> {
  private subs = new Set<(v: T) => void>();
  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(v: T): void {
    if (Object.is(v, this.value)) return;
    this.value = v;
    this.subs.forEach((fn) => fn(v));
  }

  /** Subscribe; returns an unsubscribe function. Does not call fn immediately. */
  sub(fn: (v: T) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
}

/** Storage that never throws (private mode, blocked cookies, previews). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};
