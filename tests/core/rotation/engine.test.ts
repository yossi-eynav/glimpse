import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, MIN } from '../../support/engine.ts';
import { signedInState } from '../../support/state.ts';

test('start sets a wallpaper immediately and schedules the next change', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  const s = engine.getState();
  assert.equal(s.rotation.mode, 'running');
  assert.equal(desktop.calls.length, 1);
  assert.equal(desktop.calls[0], `/data/Photos/${s.rotation.currentPhotoId}.jpg`);
  assert.equal(s.rotation.nextChangeAt, clock.now() + 30 * MIN);
});

test('start does nothing when no photo is available', async () => {
  const { engine, desktop } = await makeEngine(signedInState([]));
  await engine.start();
  assert.equal(engine.getState().rotation.mode, 'stopped');
  assert.equal(desktop.calls.length, 0);
});

test('tick changes the photo only once nextChangeAt has passed', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  clock.advance(29 * MIN);
  await engine.tick();
  assert.equal(desktop.calls.length, 1);
  clock.advance(1 * MIN);
  await engine.tick();
  assert.equal(desktop.calls.length, 2);
  assert.notEqual(desktop.calls[0], desktop.calls[1]);
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
});

test('tick does nothing unless running', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a']));
  clock.advance(100 * MIN);
  await engine.tick();
  assert.equal(desktop.calls.length, 0);
});

test('setInterval stores the interval and reschedules from now', async () => {
  const { engine, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  clock.advance(5 * MIN);
  await engine.setInterval(15);
  const s = engine.getState();
  assert.equal(s.settings.intervalMinutes, 15);
  assert.equal(s.rotation.nextChangeAt, clock.now() + 15 * MIN);
});

test('setInterval rejects values outside 1..10080', async () => {
  const { engine } = await makeEngine(signedInState(['a']));
  await assert.rejects(engine.setInterval(0), RangeError);
  await assert.rejects(engine.setInterval(10_081), RangeError);
  await assert.rejects(engine.setInterval(1.5), RangeError);
});

test('when no saved photo is left, the mode becomes blockedNoPhotos and the wallpaper stays', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.update((s) => {
    for (const p of s.selection.photos) p.status = 'unavailable';
  });
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(engine.getState().rotation.mode, 'blockedNoPhotos');
  assert.equal(engine.getState().rotation.nextChangeAt, null);
  assert.equal(desktop.calls.length, 1);
});

test('displaysChanged re-applies the current photo', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.displaysChanged();
  assert.equal(desktop.calls.length, 2);
  assert.equal(desktop.calls[0], desktop.calls[1]);
});

test('every change is saved and listeners are notified', async () => {
  const { engine, saved, clock } = await makeEngine(signedInState(['a', 'b']));
  let notified = 0;
  engine.onChange(() => notified++);
  await engine.start();
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(saved.length, 2);
  assert.equal(notified, 2);
  assert.equal(saved[1].rotation.currentPhotoId, engine.getState().rotation.currentPhotoId);
});

// --- US3: control and keep the rotation running ---

test('pause stops changes until resume, which reschedules from now', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  await engine.pause();
  assert.equal(engine.getState().rotation.mode, 'paused');
  assert.equal(engine.getState().rotation.nextChangeAt, null);
  clock.advance(60 * MIN);
  await engine.tick();
  assert.equal(desktop.calls.length, 1);
  await engine.resume();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
  assert.equal(desktop.calls.length, 1);
});

test('next changes the photo immediately, from running or paused', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  clock.advance(10 * MIN);
  await engine.next();
  assert.equal(desktop.calls.length, 2);
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
  await engine.pause();
  await engine.next();
  assert.equal(desktop.calls.length, 3);
  assert.equal(engine.getState().rotation.mode, 'paused');
});

test('selectionChanged keeps the current photo when it is still selected', async () => {
  const { engine } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.update((s) => (s.rotation.currentPhotoId = 'a'));
  await engine.selectionChanged();
  assert.equal(engine.getState().rotation.currentPhotoId, 'a');
});

test('selectionChanged clears the current photo if it was removed', async () => {
  const { engine } = await makeEngine(signedInState(['a', 'b']));
  await engine.update((s) => (s.rotation.currentPhotoId = 'a'));
  await engine.update((s) => (s.selection.photos = s.selection.photos.filter((p) => p.id !== 'a')));
  await engine.selectionChanged();
  assert.equal(engine.getState().rotation.currentPhotoId, null);
});

test('sleeping through several intervals makes exactly one change on wake (FR-017)', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  clock.advance(5 * 30 * MIN);
  await engine.tick();
  await engine.tick();
  assert.equal(desktop.calls.length, 2);
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
});

test('restore makes one change for an overdue running state and leaves paused alone', async () => {
  const overdue = signedInState(['a', 'b'], (s) => {
    s.rotation = { mode: 'running', currentPhotoId: 'a', nextChangeAt: 0 };
  });
  const r = await makeEngine(overdue);
  await r.engine.restore();
  assert.equal(r.desktop.calls.length, 1);
  assert.equal(r.engine.getState().rotation.currentPhotoId, 'b');

  const paused = signedInState(['a', 'b'], (s) => {
    s.rotation = { mode: 'paused', currentPhotoId: 'a', nextChangeAt: null };
  });
  const p = await makeEngine(paused);
  await p.engine.restore();
  assert.equal(p.desktop.calls.length, 0);
  assert.equal(p.engine.getState().rotation.mode, 'paused');
});

test('restore re-applies the current photo when the running state is not yet due', async () => {
  const s = signedInState(['a', 'b'], (st) => {
    st.rotation = { mode: 'running', currentPhotoId: 'a', nextChangeAt: Date.UTC(2026, 9, 27, 11, 0) };
  });
  const { engine, desktop } = await makeEngine(s);
  await engine.restore();
  assert.deepEqual(desktop.calls, ['/data/Photos/a.jpg']);
});

test('stop clears the rotation', async () => {
  const { engine } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.stop();
  assert.deepEqual(engine.getState().rotation, { mode: 'stopped', currentPhotoId: null, nextChangeAt: null });
});

// --- US2: screensaver handoff ---

const fakeHandoff = () => {
  const calls: string[] = [];
  return {
    calls,
    handoff: {
      publish: async (path: string, id: string) => void calls.push(`publish:${id}:${path}`),
      disable: async () => void calls.push('disable'),
    },
  };
};

test('with useForScreensaver on, every photo change is published to the screensaver', async () => {
  const h = fakeHandoff();
  const { engine, clock } = await makeEngine(signedInState(['a', 'b'], (s) => (s.settings.useForScreensaver = true)), { handoff: h.handoff });
  await engine.start();
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(h.calls.length, 2);
  const id = engine.getState().rotation.currentPhotoId;
  assert.equal(h.calls[1], `publish:${id}:/data/Photos/${id}.jpg`);
});

test('nothing is published while useForScreensaver is off', async () => {
  const h = fakeHandoff();
  const { engine } = await makeEngine(signedInState(['a', 'b']), { handoff: h.handoff });
  await engine.start();
  assert.deepEqual(h.calls, []);
});

test('setUseForScreensaver(true) publishes the current photo; false disables the handoff', async () => {
  const h = fakeHandoff();
  const { engine } = await makeEngine(signedInState(['a', 'b']), { handoff: h.handoff });
  await engine.start();
  await engine.setUseForScreensaver(true);
  assert.equal(engine.getState().settings.useForScreensaver, true);
  assert.match(h.calls[0], /^publish:/);
  await engine.setUseForScreensaver(false);
  assert.deepEqual(h.calls.slice(1), ['disable']);
  await engine.next();
  assert.equal(h.calls.length, 2);
});

// --- Amendment A: pw-helper ---

test('stop tells the desktop helper to forget the current photo', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  await engine.stop();
  assert.equal(desktop.cleared, 1);
});

test('a failed wallpaper set keeps the current photo and retries next interval', async () => {
  const logged: string[] = [];
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b', 'c']), { log: (level, msg) => void logged.push(`${level}:${msg}`) });
  await engine.start();
  const before = structuredClone(engine.getState().rotation);
  desktop.failNextSet = true;
  clock.advance(30 * MIN);
  await engine.tick();
  const after = engine.getState().rotation;
  assert.equal(after.mode, 'running');
  assert.equal(after.currentPhotoId, before.currentPhotoId);
  assert.equal(after.nextChangeAt, clock.now() + 30 * MIN);
  assert.ok(logged.some((l) => l.startsWith('warn:')));
  clock.advance(30 * MIN);
  await engine.tick();
  assert.equal(desktop.calls.length, 2);
});

test('a failed set on start still starts the rotation schedule', async () => {
  const { engine, desktop, clock } = await makeEngine(signedInState(['a', 'b']), { log: () => {} });
  desktop.failNextSet = true;
  await engine.start();
  assert.equal(engine.getState().rotation.mode, 'running');
  assert.equal(engine.getState().rotation.currentPhotoId, null);
  assert.equal(engine.getState().rotation.nextChangeAt, clock.now() + 30 * MIN);
});

// --- Feature 002: fully random picks ---

test('next never repeats the photo on screen', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b', 'c']));
  await engine.start();
  for (let i = 0; i < 30; i++) await engine.next();
  for (let i = 1; i < desktop.calls.length; i++) assert.notEqual(desktop.calls[i], desktop.calls[i - 1], `change ${i}`);
  assert.equal(desktop.calls.length, 31);
});

test('with 2 photos, changes alternate', async () => {
  const { engine, desktop } = await makeEngine(signedInState(['a', 'b']));
  await engine.start();
  for (let i = 0; i < 4; i++) await engine.next();
  const [first, second] = desktop.calls;
  assert.notEqual(first, second);
  assert.deepEqual(desktop.calls, [first, second, first, second, first]);
});
