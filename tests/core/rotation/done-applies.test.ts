import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, MIN } from '../../support/engine.ts';
import { photo, seededRandom, signedInState } from '../../support/state.ts';
import type { PhotoStatus } from '../../../src/core/persistence/app-state.ts';

/** a and b are the existing photos; extra ones (with status) play the "just added" photos. */
const state = (added: [string, PhotoStatus][] = [['c', 'saved'], ['d', 'saved']]) =>
  signedInState(['a', 'b'], (s) => {
    for (const [id, status] of added) s.selection.photos.push(photo(id, status));
  });

const shownId = (path: string | undefined) => path?.split('/').pop()?.replace('.jpg', '');

test('while running, Done shows one of the newly added photos and restarts the interval', async () => {
  const { engine, desktop, clock } = await makeEngine(state());
  await engine.start();
  clock.advance(10 * MIN);
  await engine.selectionChanged({ addedIds: ['c', 'd'] });
  assert.ok(['c', 'd'].includes(shownId(desktop.calls.at(-1))!));
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
});

for (const [name, prepare] of [
  ['stopped', async () => {}],
  ['paused', async (e: Awaited<ReturnType<typeof makeEngine>>['engine']) => { await e.start(); await e.pause(); }],
  ['pausedExternalChange', async (e: Awaited<ReturnType<typeof makeEngine>>['engine']) => { await e.start(); await e.externalChange(); }],
] as const) {
  test(`from ${name}, Done shows a new photo and the rotation runs`, async () => {
    const { engine, desktop } = await makeEngine(state());
    await prepare(engine);
    const before = desktop.calls.length;
    await engine.selectionChanged({ addedIds: ['c', 'd'] });
    assert.equal(engine.getState().rotation.mode, 'running');
    assert.equal(desktop.calls.length, before + 1);
    assert.ok(['c', 'd'].includes(shownId(desktop.calls.at(-1))!));
  });
}

test('only the newly added photos are candidates', async () => {
  for (let seed = 0; seed < 20; seed++) {
    const s = signedInState(['a', 'b', 'c', 'd', 'e', 'x', 'y']);
    const { engine, desktop } = await makeEngine(s, { random: seededRandom(seed) });
    await engine.start();
    await engine.selectionChanged({ addedIds: ['x', 'y'] });
    assert.ok(['x', 'y'].includes(shownId(desktop.calls.at(-1))!), `seed ${seed}`);
  }
});

test('the screensaver gets the new photo', async () => {
  const published: string[] = [];
  const handoff = { publish: async (_p: string, id: string) => void published.push(id), disable: async () => {} };
  const s = state();
  s.settings.useForScreensaver = true;
  const { engine } = await makeEngine(s, { handoff });
  await engine.selectionChanged({ addedIds: ['c'] });
  assert.deepEqual(published, ['c']);
});

test('a photo still downloading is shown as soon as it is saved', async () => {
  const { engine, desktop } = await makeEngine(state([['c', 'pending']]));
  await engine.start();
  const before = desktop.calls.length;
  await engine.selectionChanged({ addedIds: ['c'] });
  assert.equal(desktop.calls.length, before);
  assert.equal(engine.getState().rotation.mode, 'running');
  await engine.photoStatusChanged('c', 'saved');
  assert.equal(shownId(desktop.calls.at(-1)), 'c');
  assert.equal(engine.getState().selection.photos.find((p) => p.id === 'c')?.status, 'saved');
});

test('if every added photo fails, a normal change shows a saved photo', async () => {
  const { engine, desktop } = await makeEngine(state([['c', 'pending'], ['d', 'pending']]));
  await engine.selectionChanged({ addedIds: ['c', 'd'] });
  assert.equal(desktop.calls.length, 0);
  await engine.photoStatusChanged('c', 'unavailable');
  assert.equal(desktop.calls.length, 0);
  await engine.photoStatusChanged('d', 'unavailable');
  assert.equal(desktop.calls.length, 1);
  assert.ok(['a', 'b'].includes(shownId(desktop.calls[0])!));
});

test('an added photo with a missing file is skipped for another added photo', async () => {
  const { engine, desktop, fs, photos } = await makeEngine(state());
  await fs.remove(photos.photoPath('c'));
  await engine.selectionChanged({ addedIds: ['c', 'd'] });
  assert.equal(shownId(desktop.calls.at(-1)), 'd');
  assert.equal(engine.getState().selection.photos.find((p) => p.id === 'c')?.status, 'unavailable');
});

test('Done without added photos changes nothing', async () => {
  const { engine, desktop } = await makeEngine(state());
  await engine.start();
  const before = { calls: desktop.calls.length, rotation: structuredClone(engine.getState().rotation) };
  await engine.selectionChanged({ addedIds: [] });
  await engine.selectionChanged();
  assert.equal(desktop.calls.length, before.calls);
  assert.deepEqual(engine.getState().rotation, before.rotation);
});

test('photoStatusChanged for a photo not waiting to be shown only updates its status', async () => {
  const { engine, desktop } = await makeEngine(state());
  await engine.start();
  const current = engine.getState().rotation.currentPhotoId;
  const other = ['a', 'b', 'c', 'd'].find((id) => id !== current)!;
  const before = desktop.calls.length;
  await engine.photoStatusChanged(other, 'unavailable');
  assert.equal(desktop.calls.length, before);
  assert.equal(engine.getState().selection.photos.find((p) => p.id === other)?.status, 'unavailable');
});
