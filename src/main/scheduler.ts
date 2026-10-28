import type { AppState } from '../core/persistence/app-state.ts';

type EngineLike = {
  getState(): AppState;
  onChange(listener: (s: AppState) => void): () => void;
  tick(): Promise<void>;
};

type Timers = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: never): void;
};

/** Keeps exactly one timer pending for the engine's nextChangeAt (research R8). */
export function createScheduler(engine: EngineLike, timers: Timers = { now: Date.now, setTimeout, clearTimeout }) {
  let handle: unknown;
  let scheduledFor: number | null = null;

  const reschedule = () => {
    const at = engine.getState().rotation.nextChangeAt;
    if (at === scheduledFor) return;
    if (handle !== undefined) timers.clearTimeout(handle as never);
    handle = undefined;
    scheduledFor = at;
    if (at === null) return;
    handle = timers.setTimeout(() => {
      handle = undefined;
      scheduledFor = null;
      void engine.tick();
    }, Math.max(0, at - timers.now()));
  };

  const unsubscribe = engine.onChange(reschedule);
  reschedule();
  return { dispose: () => (unsubscribe(), handle !== undefined && timers.clearTimeout(handle as never)) };
}
