import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, MIN } from '../../support/engine.ts';
import { signedInState } from '../../support/state.ts';

test('a photo whose saved file is missing is marked unavailable and another is shown (FR-024)', async () => {
  const { engine, fs, photos, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  const current = engine.getState().rotation.currentPhotoId;
  const others = ['a', 'b', 'c'].filter((id) => id !== current);
  await fs.remove(photos.photoPath(others[0]));
  clock.advance(30 * MIN);
  await engine.tick();
  const s = engine.getState();
  assert.equal(s.rotation.mode, 'running');
  assert.equal(s.rotation.currentPhotoId, others[1]);
  assert.equal(s.selection.photos.find((p) => p.id === others[0])?.status, 'unavailable');
  assert.equal(desktop.calls.at(-1), `/data/Photos/${others[1]}.jpg`);
});

test('a corrupt file is treated the same as a missing one', async () => {
  const { engine, fs, photos } = await makeEngine(signedInState(['a']));
  await fs.writeAtomic(photos.photoPath('a'), 'not a jpeg');
  await engine.start();
  assert.equal(engine.getState().selection.photos[0].status, 'unavailable');
});

test('when every photo is unavailable, rotation becomes blockedNoPhotos and the wallpaper stays', async () => {
  const { engine, fs, photos, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  for (const id of ['a', 'b']) await fs.remove(photos.photoPath(id));
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'blockedNoPhotos');
  assert.equal(desktop.calls.length, 1);
});
