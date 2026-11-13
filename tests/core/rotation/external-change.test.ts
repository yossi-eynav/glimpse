import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, MIN } from '../../support/engine.ts';
import { signedInState } from '../../support/state.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { loadState, saveState } from '../../../src/core/persistence/state-file.ts';

// Feature 009: a wallpaper the user sets outside the app never pauses rotation.

test("a wallpaper set outside the app doesn't stop the next scheduled change (FR-001)", async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  desktop.current = ['/System/Library/Desktop Pictures/Sonoma.heic'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.equal(desktop.calls.length, 2);
  assert.ok(desktop.current[0].startsWith('/data/Photos/'));
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
});

test('with one of two screens changed, the next change sets every screen (FR-002)', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  desktop.current = ['/System/Library/Desktop Pictures/Default.heic', '/System/Library/Desktop Pictures/Default.heic'];
  await engine.start();
  desktop.current = [desktop.current[0], '/Users/me/Pictures/cat.jpg'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.ok(desktop.current.every((path) => path === desktop.calls.at(-1)));
});

test('a Glimpse photo on screen: the next change happens as usual', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  desktop.current = ['/data/Photos/b.jpg'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.equal(desktop.calls.length, 2);
});

test('while paused by the user, a manual wallpaper and a due tick change nothing', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.pause();
  desktop.current = ['/Users/me/Pictures/cat.jpg'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'paused');
  assert.equal(desktop.calls.length, 1);
  assert.deepEqual(desktop.current, ['/Users/me/Pictures/cat.jpg']);
  await engine.resume();
  assert.equal(engine.getState().rotation.mode, 'running');
});

test('a legacy auto-paused state shows a photo at launch and schedules the next change (FR-006)', async () => {
  const fs = new MemoryFileSystem();
  const saved = signedInState(['a', 'b']);
  saved.rotation = { mode: 'pausedExternalChange' as never, currentPhotoId: 'a', nextChangeAt: null };
  await saveState(fs, '/data', saved);
  const { engine, desktop, clock } = await makeEngine(await loadState(fs, '/data'));
  await engine.restore();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.equal(desktop.calls.length, 1);
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
});
