import { describe, expect, it } from 'vitest';
import { Player, type Clock } from '../src/core/player';

function fakeClock() {
  let t = 0;
  let id = 0;
  const frames = new Map<number, () => void>();
  const clock: Clock = {
    now: () => t,
    frame: (cb) => (frames.set(++id, cb), id),
    cancel: (i) => void frames.delete(i),
  };
  return {
    clock,
    pending: () => frames.size,
    /** advance time by ms and run the pending frame callback(s) once */
    advance(ms: number) {
      t += ms;
      const cbs = [...frames.values()];
      frames.clear();
      cbs.forEach((cb) => cb());
    },
  };
}

function make(count = 4, ms = 1000) {
  const f = fakeClock();
  return { f, p: new Player(count, ms, f.clock) };
}

describe('Player', () => {
  it('starts idle at index -1', () => {
    const { p } = make();
    expect(p.get()).toEqual({ index: -1, progress: 0, playing: false, speed: 1, count: 4 });
  });

  it('play starts playing and schedules a frame', () => {
    const { p, f } = make();
    p.play();
    expect(p.get().playing).toBe(true);
    expect(f.pending()).toBe(1);
  });

  it('progress advances with time', () => {
    const { p, f } = make();
    p.play();
    f.advance(250);
    expect(p.get().progress).toBeCloseTo(0.25);
    expect(p.get().index).toBe(-1);
  });

  it('index advances when progress reaches 1', () => {
    const { p, f } = make();
    p.play();
    f.advance(1500);
    expect(p.get().index).toBe(0);
    expect(p.get().progress).toBeCloseTo(0.5);
  });

  it('large time jump advances several packets but not past count-1 and stops', () => {
    const { p, f } = make();
    p.play();
    f.advance(2500);
    expect(p.get().index).toBe(1);
    f.advance(1e7);
    expect(p.get()).toMatchObject({ index: 3, progress: 0, playing: false });
    expect(f.pending()).toBe(0);
  });

  it('speed scales progress', () => {
    const { p, f } = make();
    p.setSpeed(2);
    p.play();
    f.advance(250);
    expect(p.get().progress).toBeCloseTo(0.5);
  });

  it('setSpeed ignores invalid values and keeps speed', () => {
    const { p } = make();
    for (const v of [0, -1, NaN, Infinity, -Infinity]) p.setSpeed(v);
    expect(p.get().speed).toBe(1);
    p.setSpeed(1.5);
    expect(p.get().speed).toBe(1.5);
  });

  it('pause stops the loop and keeps position', () => {
    const { p, f } = make();
    p.play();
    f.advance(1500);
    p.pause();
    expect(p.get()).toMatchObject({ playing: false, index: 0 });
    expect(f.pending()).toBe(0);
  });

  it('toggle switches between play and pause', () => {
    const { p } = make();
    p.toggle();
    expect(p.get().playing).toBe(true);
    p.toggle();
    expect(p.get().playing).toBe(false);
  });

  it('seek clamps to [-1, count-1] and pauses', () => {
    const { p } = make();
    p.play();
    p.seek(99);
    expect(p.get()).toMatchObject({ index: 3, playing: false, progress: 0 });
    p.seek(-50);
    expect(p.get().index).toBe(-1);
    p.seek(2);
    expect(p.get().index).toBe(2);
  });

  it('seek cancels the pending frame', () => {
    const { p, f } = make();
    p.play();
    p.seek(1);
    expect(f.pending()).toBe(0);
  });

  it('step moves to next packet instantly and back returns', () => {
    const { p } = make();
    p.step();
    p.step();
    expect(p.get().index).toBe(1);
    p.back();
    expect(p.get().index).toBe(0);
    p.back();
    p.back();
    expect(p.get().index).toBe(-1);
  });

  it('step does not go past the last packet', () => {
    const { p } = make(2);
    p.step();
    p.step();
    p.step();
    expect(p.get().index).toBe(1);
    expect(p.finished).toBe(true);
  });

  it('reset rewinds to -1', () => {
    const { p } = make();
    p.seek(2);
    p.reset();
    expect(p.get()).toMatchObject({ index: -1, progress: 0, playing: false });
  });

  it('play from the end restarts at -1', () => {
    const { p, f } = make();
    p.seek(3);
    p.play();
    expect(p.get()).toMatchObject({ index: -1, playing: true });
    f.advance(1000);
    expect(p.get().index).toBe(0);
  });

  it('replay after natural finish works', () => {
    const { p, f } = make(2);
    p.play();
    f.advance(5000);
    expect(p.get()).toMatchObject({ index: 1, playing: false });
    p.play();
    expect(p.get()).toMatchObject({ index: -1, playing: true });
  });

  it('stepAnimated animates exactly one packet then pauses', () => {
    const { p, f } = make();
    p.stepAnimated();
    expect(p.get().playing).toBe(true);
    f.advance(500);
    expect(p.get()).toMatchObject({ index: -1, playing: true });
    f.advance(600);
    expect(p.get()).toMatchObject({ index: 0, progress: 0, playing: false });
    expect(f.pending()).toBe(0);
  });

  it('stepAnimated with a huge time jump still stops after one packet', () => {
    const { p, f } = make();
    p.stepAnimated();
    f.advance(10000);
    expect(p.get()).toMatchObject({ index: 0, playing: false });
  });

  it('stepAnimated from the finished state restarts with the first packet', () => {
    const { p, f } = make();
    p.seek(3);
    p.stepAnimated();
    f.advance(1000);
    expect(p.get()).toMatchObject({ index: 0, playing: false });
  });

  it('stepAnimated while playing stops after the next packet', () => {
    const { p, f } = make();
    p.play();
    f.advance(1200); // index 0, packet 1 in flight
    p.stepAnimated();
    f.advance(10000);
    expect(p.get()).toMatchObject({ index: 1, playing: false });
  });

  it('play during stepAnimated converts to full play', () => {
    const { p, f } = make();
    p.stepAnimated();
    p.play();
    f.advance(1500);
    expect(p.get()).toMatchObject({ index: 0, playing: true });
    f.advance(1000);
    expect(p.get().index).toBe(1);
    expect(p.get().playing).toBe(true);
  });

  it('play/stepAnimated are no-ops with no packets', () => {
    const { p } = make(0);
    p.stepAnimated();
    p.play();
    expect(p.get().playing).toBe(false);
  });

  it('load rewinds, stops, applies the new count and keeps speed', () => {
    const { p, f } = make();
    p.setSpeed(2);
    p.play();
    f.advance(1200);
    p.load(7);
    expect(p.get()).toEqual({ index: -1, progress: 0, playing: false, speed: 2, count: 7 });
    expect(f.pending()).toBe(0);
  });

  it('subscribers are notified and can unsubscribe', () => {
    const { p } = make();
    const seen: number[] = [];
    const off = p.sub((s) => seen.push(s.index));
    p.step();
    off();
    p.step();
    expect(seen).toEqual([0]);
  });

  it('destroy stops the loop and drops subscribers', () => {
    const { p, f } = make();
    let calls = 0;
    p.sub(() => calls++);
    p.play();
    const before = calls;
    p.destroy();
    expect(f.pending()).toBe(0);
    p.step();
    expect(calls).toBe(before);
  });

  it('pause then play resumes from kept progress without counting paused time', () => {
    const { p, f } = make();
    p.play();
    f.advance(300);
    p.pause();
    f.advance(5000); // time passes while paused (no frame pending)
    p.play();
    f.advance(100);
    expect(p.get().progress).toBeCloseTo(0.4);
  });
});
