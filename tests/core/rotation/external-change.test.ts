import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, MIN } from '../../support/engine.ts';
import { signedInState } from '../../support/state.ts';

test('a wallpaper set outside the app pauses rotation at the next scheduled change (FR-018)', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  desktop.current = ['/System/Library/Desktop Pictures/Sonoma.heic'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'pausedExternalChange');
  assert.equal(engine.getState().rotation.nextChangeAt, null);
  assert.equal(desktop.calls.length, 1);
});

test('only one screen changed outside the app is enough to pause', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  desktop.current = [desktop.current[0], '/Users/me/Pictures/cat.jpg'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'pausedExternalChange');
});

test("paths inside the app's Photos folder are not treated as external changes", async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  desktop.current = ['/data/Photos/b.jpg'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.equal(desktop.calls.length, 2);
});

test('a folder that merely starts with the Photos path is still external', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  desktop.current = ['/data/Photos-backup/x.jpg'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'pausedExternalChange');
});

// --- Amendment A: pw-helper reports manual changes as they happen ---

test('externalChange() pauses a running rotation without touching the wallpaper', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.externalChange();
  assert.equal(engine.getState().rotation.mode, 'pausedExternalChange');
  assert.equal(engine.getState().rotation.nextChangeAt, null);
  assert.equal(desktop.calls.length, 1);
});

test('externalChange() does nothing unless running', async () => {
  const { engine } = await makeEngine(signedInState(['a', 'b']));
  await engine.externalChange();
  assert.equal(engine.getState().rotation.mode, 'stopped');
  await engine.start();
  await engine.pause();
  await engine.externalChange();
  assert.equal(engine.getState().rotation.mode, 'paused');
});

test('after resume, the next due tick sets a Google photo again', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.externalChange();
  await engine.resume();
  desktop.current = ['/data/Photos/a.jpg'];
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.equal(desktop.calls.length, 2);
});
