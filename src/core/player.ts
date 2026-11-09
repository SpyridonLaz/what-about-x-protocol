/**
 * Timeline over a scenario's packets. `index` is the last packet that has fully arrived
 * (-1 = nothing sent yet). While playing, packet `index + 1` is in flight and `progress`
 * goes 0 → 1; when it reaches 1 the index advances.
 */
export interface PlayerState {
  index: number;
  progress: number;
  playing: boolean;
  speed: number;
  count: number;
}

export type Clock = {
  now(): number;
  frame(cb: () => void): number;
  cancel(id: number): void;
};

const browserClock: Clock = {
  now: () => performance.now(),
  frame: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export const SPEEDS = [0.5, 1, 1.5, 2] as const;

export class Player {
  private state: PlayerState;
  private subs = new Set<(s: PlayerState) => void>();
  private raf = 0;
  private last = 0;
  /** When set, playback pauses after this packet arrives (used by animated Step). */
  private stopAt: number | null = null;

  /** @param packetMs duration of one packet's flight at 1× speed. */
  constructor(count: number, private packetMs = 900, private clock: Clock = browserClock) {
    this.state = { index: -1, progress: 0, playing: false, speed: 1, count };
  }

  get(): PlayerState {
    return this.state;
  }

  sub(fn: (s: PlayerState) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private emit(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    this.subs.forEach((fn) => fn(this.state));
  }

  get finished(): boolean {
    return this.state.index >= this.state.count - 1;
  }

  /** Load a new scenario: stops and rewinds. Speed is kept. */
  load(count: number): void {
    this.stopLoop();
    this.emit({ count, index: -1, progress: 0, playing: false });
  }

  play(): void {
    this.stopAt = null;
    this.start();
  }

  /** Animate only the next packet, then pause. */
  stepAnimated(): void {
    if (this.state.count === 0) return;
    if (this.state.playing) {
      this.stopAt = Math.min(this.state.index + 1, this.state.count - 1);
      return;
    }
    if (this.finished) this.emit({ index: -1, progress: 0 });
    this.stopAt = this.state.index + 1;
    this.start();
  }

  private start(): void {
    if (this.state.playing || this.state.count === 0) return;
    if (this.finished) this.emit({ index: -1, progress: 0 }); // replay from the start
    this.emit({ playing: true });
    this.last = this.clock.now();
    this.raf = this.clock.frame(this.tick);
  }

  pause(): void {
    if (!this.state.playing) return;
    this.stopLoop();
    this.emit({ playing: false });
  }

  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  /** Jump to a packet (it counts as arrived). Clamped to [-1, count-1]; pauses playback. */
  seek(index: number): void {
    this.stopLoop();
    const i = Math.max(-1, Math.min(this.state.count - 1, Math.trunc(index)));
    this.emit({ index: i, progress: 0, playing: false });
  }

  /** Finish the next packet immediately. */
  step(): void {
    this.seek(this.state.index + 1);
  }

  back(): void {
    this.seek(this.state.index - 1);
  }

  reset(): void {
    this.seek(-1);
  }

  setSpeed(speed: number): void {
    if (!(speed > 0) || !Number.isFinite(speed)) return;
    this.emit({ speed });
  }

  destroy(): void {
    this.stopLoop();
    this.subs.clear();
  }

  private stopLoop(): void {
    if (this.raf) this.clock.cancel(this.raf);
    this.raf = 0;
    this.stopAt = null;
  }

  /** Advance by elapsed wall time. Exposed for tests through the injected clock. */
  private tick = (): void => {
    this.raf = 0;
    if (!this.state.playing) return;
    const now = this.clock.now();
    const dt = Math.max(0, now - this.last);
    this.last = now;
    let { index, progress } = this.state;
    const limit = Math.min(this.stopAt ?? this.state.count - 1, this.state.count - 1);
    progress += (dt * this.state.speed) / this.packetMs;
    while (progress >= 1 && index < limit) {
      index += 1;
      progress -= 1;
    }
    if (index >= limit) {
      this.stopAt = null;
      this.emit({ index: limit, progress: 0, playing: false });
      return;
    }
    this.emit({ index, progress });
    this.raf = this.clock.frame(this.tick);
  };
}
