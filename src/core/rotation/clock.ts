import { setTimeout as delay } from 'node:timers/promises';

export type Clock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: async (ms) => {
    await delay(ms);
  },
};

/** Test clock: time only moves when told to, and sleep() jumps forward instead of waiting. */
export class ManualClock implements Clock {
  readonly sleeps: number[] = [];
  #now: number;

  constructor(start = 0) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  advance(ms: number): void {
    this.#now += ms;
  }

  async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    this.#now += ms;
  }
}
