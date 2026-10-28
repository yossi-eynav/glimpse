import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinutes, validateInterval } from '../../../src/core/rotation/custom-interval.ts';

const HINT = 'Between 1 minute and 7 days';

test('toMinutes converts units', () => {
  assert.equal(toMinutes(90, 'minutes'), 90);
  assert.equal(toMinutes(2, 'hours'), 120);
  assert.equal(toMinutes(7, 'days'), 10_080);
});

test('valid intervals pass', () => {
  assert.deepEqual(validateInterval(90, 'minutes'), { ok: true, minutes: 90 });
  assert.deepEqual(validateInterval(7, 'days'), { ok: true, minutes: 10_080 });
  assert.deepEqual(validateInterval(1, 'minutes'), { ok: true, minutes: 1 });
});

test('invalid intervals fail with the hint', () => {
  for (const [v, u] of [[0, 'minutes'], [-1, 'hours'], [1.5, 'minutes'], [8, 'days'], [Number.NaN, 'minutes']] as const) {
    assert.deepEqual(validateInterval(v, u), { ok: false, hint: HINT }, `${v} ${u}`);
  }
});
