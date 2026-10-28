import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ManualClock } from '../../../src/core/rotation/clock.ts';

test('ManualClock starts at the given time and advances on demand', () => {
  const clock = new ManualClock(1_000);
  assert.equal(clock.now(), 1_000);
  clock.advance(500);
  assert.equal(clock.now(), 1_500);
});

test('ManualClock.sleep moves time forward and resolves immediately', async () => {
  const clock = new ManualClock(0);
  await clock.sleep(5_000);
  await clock.sleep(2_000);
  assert.equal(clock.now(), 7_000);
  assert.deepEqual(clock.sleeps, [5_000, 2_000]);
});
