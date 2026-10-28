import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRandom } from '../../../src/core/rotation/random-pick.ts';
import type { PhotoStatus, Selection } from '../../../src/core/persistence/app-state.ts';
import { photo, seededRandom } from '../../support/state.ts';

const selection = (entries: (string | [string, PhotoStatus])[]): Selection => ({
  photos: entries.map((e) => (typeof e === 'string' ? photo(e) : photo(e[0], e[1]))),
  skippedNonPhotoCount: 0,
});

/** Chains n picks, passing each result back in as the current photo. */
const chain = (sel: Selection, n: number, random: () => number): string[] => {
  const picks: string[] = [];
  let current: string | null = null;
  for (let i = 0; i < n; i++) {
    current = pickRandom(current, sel, random);
    assert.ok(current);
    picks.push(current);
  }
  return picks;
};

test('candidates are the saved photos other than the one on screen', () => {
  const sel = selection(['a', 'b', 'c']);
  assert.equal(pickRandom('b', sel, () => 0), 'a');
  assert.equal(pickRandom('b', sel, () => 0.99), 'c');
});

test('never picks the photo on screen twice in a row (FR-002, SC-001)', () => {
  const picks = chain(selection(['a', 'b', 'c', 'd']), 1_000, seededRandom(1));
  for (let i = 1; i < picks.length; i++) assert.notEqual(picks[i], picks[i - 1], `pick ${i}`);
});

test('picks are fair: each of 4 photos within 250 ± 25% of 1,000 picks (SC-002)', () => {
  for (const seed of [1, 99]) {
    const counts = new Map<string, number>();
    for (const id of chain(selection(['a', 'b', 'c', 'd']), 1_000, seededRandom(seed))) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const id of ['a', 'b', 'c', 'd']) {
      const n = counts.get(id) ?? 0;
      assert.ok(n >= 188 && n <= 312, `seed ${seed}: ${id} picked ${n} times`);
    }
  }
});

test('there are no rounds: a photo repeats before all 3 have been shown (SC-003, FR-004)', () => {
  const picks = chain(selection(['a', 'b', 'c']), 50, seededRandom(7));
  const repeatsEarly = picks.some((id, i) => {
    const prev = picks.lastIndexOf(id, i - 1);
    return prev >= 0 && new Set(picks.slice(prev + 1, i)).size < 2;
  });
  assert.ok(repeatsEarly, `no early repeat in ${picks.join('')}`);
});

test('a single saved photo is kept (FR-003)', () => {
  assert.equal(pickRandom('a', selection(['a']), seededRandom()), 'a');
});

test('only saved photos are candidates (FR-005)', () => {
  const sel = selection([['a', 'pending'], ['b', 'unavailable'], 'c']);
  assert.equal(pickRandom(null, sel, seededRandom()), 'c');
  assert.equal(pickRandom('c', sel, seededRandom()), 'c');
});

test('returns null when nothing is saved', () => {
  assert.equal(pickRandom(null, selection([['a', 'pending']]), seededRandom()), null);
});

test('when the photo on screen was removed, every saved photo is a candidate', () => {
  assert.equal(pickRandom('z', selection(['a', 'b']), () => 0), 'a');
});
