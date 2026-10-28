import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../../src/main/scheduler.ts';
import { defaultState, type AppState } from '../../src/core/persistence/app-state.ts';

const fakeEngine = (nextChangeAt: number | null) => {
  const state = defaultState();
  state.rotation.nextChangeAt = nextChangeAt;
  const listeners = new Set<(s: AppState) => void>();
  let ticks = 0;
  return {
    state,
    ticks: () => ticks,
    emit: () => listeners.forEach((l) => l(state)),
    engine: {
      getState: () => state,
      onChange: (l: (s: AppState) => void) => (listeners.add(l), () => listeners.delete(l)),
      tick: async () => void ticks++,
    },
  };
};

const fakeTimers = () => {
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let id = 0;
  return {
    timers,
    api: {
      setTimeout: (fn: () => void, ms: number) => (timers.set(++id, { fn, ms }), id),
      clearTimeout: (h: number) => void timers.delete(h),
    },
  };
};

test('schedules one timer for nextChangeAt and ticks when it fires', () => {
  const f = fakeEngine(10_000);
  const t = fakeTimers();
  createScheduler(f.engine, { now: () => 4_000, ...t.api });
  assert.equal(t.timers.size, 1);
  const [timer] = t.timers.values();
  assert.equal(timer.ms, 6_000);
  timer.fn();
  assert.equal(f.ticks(), 1);
});

test('reschedules on every engine change and clears when nextChangeAt is null', () => {
  const f = fakeEngine(10_000);
  const t = fakeTimers();
  createScheduler(f.engine, { now: () => 0, ...t.api });
  f.state.rotation.nextChangeAt = 20_000;
  f.emit();
  assert.deepEqual([...t.timers.values()].map((x) => x.ms), [20_000]);
  f.state.rotation.nextChangeAt = null;
  f.emit();
  assert.equal(t.timers.size, 0);
});

test('an overdue deadline fires immediately', () => {
  const f = fakeEngine(1_000);
  const t = fakeTimers();
  createScheduler(f.engine, { now: () => 5_000, ...t.api });
  assert.equal([...t.timers.values()][0].ms, 0);
});
