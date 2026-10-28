import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, MIN } from '../../support/engine.ts';
import { signedInState } from '../../support/state.ts';

const fakeHandoff = () => {
  const calls: string[] = [];
  return { calls, handoff: { publish: async (_p: string, id: string) => void calls.push(`publish:${id}`), disable: async () => void calls.push('disable') } };
};

test('the original wallpaper is recorded just before the first change', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  desktop.current = ['/Users/me/Pictures/mine.jpg'];
  await engine.start();
  assert.deepEqual(engine.getState().original?.wallpapers, ['/Users/me/Pictures/mine.jpg']);
  assert.ok(desktop.calls.length === 1);
});

test("a wallpaper that is already one of the app's photos is recorded as unknown", async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  desktop.current = ['/data/Photos/a.jpg'];
  await engine.start();
  assert.deepEqual(engine.getState().original?.wallpapers, [null]);
});

test('originals are recorded only once', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  desktop.current = ['/Users/me/Pictures/mine.jpg'];
  await engine.start();
  await engine.stop();
  await engine.start();
  assert.deepEqual(engine.getState().original?.wallpapers, ['/Users/me/Pictures/mine.jpg']);
});

test('turnOff restores the originals, stops, disables the screensaver, and keeps the setup', async () => {
  const h = fakeHandoff();
  const s = signedInState(['a', 'b'], (st) => (st.settings.useForScreensaver = true));
  const { engine, desktop, saved } = await makeEngine(s, { handoff: h.handoff });
  desktop.current = ['/Users/me/Pictures/mine.jpg'];
  await engine.start();
  const before = structuredClone(engine.getState());
  await engine.turnOff();
  const after = engine.getState();
  assert.equal(after.power, 'off');
  assert.deepEqual(after.rotation, { mode: 'stopped', currentPhotoId: null, nextChangeAt: null });
  assert.deepEqual(desktop.restoreCalls, [['/Users/me/Pictures/mine.jpg']]);
  assert.deepEqual(desktop.current, ['/Users/me/Pictures/mine.jpg']);
  assert.equal(h.calls.at(-1), 'disable');
  assert.deepEqual(after.account, before.account);
  assert.deepEqual(after.selection, before.selection);
  assert.deepEqual(after.settings, before.settings);
  assert.equal(saved.at(-1)?.power, 'off');
});

test('while off, nothing changes the wallpaper or screensaver (FR-011)', async () => {
  const h = fakeHandoff();
  const s = signedInState(['a', 'b', 'c'], (st) => (st.settings.useForScreensaver = true));
  const { engine, desktop, clock } = await makeEngine(s, { handoff: h.handoff });
  await engine.start();
  await engine.turnOff();
  const sets = desktop.calls.length;
  const publishes = h.calls.filter((c) => c.startsWith('publish')).length;
  clock.advance(60 * MIN);
  await engine.tick();
  await engine.next();
  await engine.start();
  await engine.resume();
  await engine.restore();
  await engine.displaysChanged();
  await engine.photoStatusChanged('a', 'saved');
  await engine.selectionChanged({ addedIds: ['b'] });
  assert.equal(desktop.calls.length, sets);
  assert.equal(h.calls.filter((c) => c.startsWith('publish')).length, publishes);
  assert.equal(engine.getState().power, 'off');
  assert.equal(engine.getState().rotation.mode, 'stopped');
});

test('turnOn records new originals, shows a photo and runs', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.turnOff();
  desktop.current = ['/Users/me/Pictures/new-choice.jpg'];
  const sets = desktop.calls.length;
  await engine.turnOn();
  const s = engine.getState();
  assert.equal(s.power, 'on');
  assert.deepEqual(s.original?.wallpapers, ['/Users/me/Pictures/new-choice.jpg']);
  assert.equal(desktop.calls.length, sets + 1);
  assert.equal(s.rotation.mode, 'running');
});

test('turnOn with no saved photos turns on without changing anything', async () => {
  const { engine, desktop } = await makeEngine(signedInState([]));
  await engine.turnOff();
  await engine.turnOn();
  assert.equal(engine.getState().power, 'on');
  assert.equal(engine.getState().rotation.mode, 'stopped');
  assert.equal(desktop.calls.length, 0);
});
