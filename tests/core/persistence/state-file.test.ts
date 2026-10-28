import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { defaultState, availableCount } from '../../../src/core/persistence/app-state.ts';
import { loadState, saveState } from '../../../src/core/persistence/state-file.ts';

test('defaults match the data model', () => {
  const s = defaultState();
  assert.deepEqual(s.account, { status: 'signedOut', email: null });
  assert.deepEqual(s.settings, { intervalMinutes: 30, useForScreensaver: false, startAtLogin: false });
  assert.deepEqual(s.rotation, { mode: 'stopped', currentPhotoId: null, nextChangeAt: null });
  assert.deepEqual(s.selection, { photos: [], skippedNonPhotoCount: 0 });
});

test('loadState returns defaults when state.json is missing', async () => {
  assert.deepEqual(await loadState(new MemoryFileSystem(), '/data'), defaultState());
});

test('loadState returns defaults when state.json is corrupt', async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic('/data/state.json', '{not json');
  assert.deepEqual(await loadState(fs, '/data'), defaultState());
});

test('saveState then loadState round-trips', async () => {
  const fs = new MemoryFileSystem();
  const s = defaultState();
  s.account = { status: 'signedIn', email: 'a@b.c' };
  s.settings.intervalMinutes = 15;
  s.selection.photos.push({ id: 'p1', createdAt: null, width: 10, height: 20, status: 'saved', addedAt: 5 });
  s.rotation = { mode: 'running', currentPhotoId: 'p1', nextChangeAt: 99 };
  await saveState(fs, '/data', s);
  assert.deepEqual(await loadState(fs, '/data'), s);
});

test('loadState drops a saved shownThisRound from feature 001', async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic(
    '/data/state.json',
    JSON.stringify({ rotation: { mode: 'running', currentPhotoId: 'p1', shownThisRound: ['p1'], nextChangeAt: 5 } }),
  );
  const s = await loadState(fs, '/data');
  assert.deepEqual(s.rotation, { mode: 'running', currentPhotoId: 'p1', nextChangeAt: 5 });
  await saveState(fs, '/data', s);
  assert.equal(new TextDecoder().decode(await fs.read('/data/state.json')).includes('shownThisRound'), false);
});

test('saved state never contains token fields', async () => {
  const fs = new MemoryFileSystem();
  await saveState(fs, '/data', defaultState());
  const json = new TextDecoder().decode(await fs.read('/data/state.json'));
  for (const key of ['accessToken', 'refreshToken', 'access_token', 'refresh_token']) {
    assert.equal(json.includes(key), false, key);
  }
});

test('availableCount counts only saved photos', () => {
  const s = defaultState();
  for (const status of ['saved', 'pending', 'unavailable', 'saved'] as const) {
    s.selection.photos.push({ id: String(s.selection.photos.length), createdAt: null, width: 1, height: 1, status, addedAt: 0 });
  }
  assert.equal(availableCount(s.selection), 2);
});

// --- Feature 004: power and original wallpapers ---

test('power defaults to on and original to null', () => {
  const s = defaultState();
  assert.equal(s.power, 'on');
  assert.equal(s.original, null);
});

test('power and original survive a round-trip', async () => {
  const fs = new MemoryFileSystem();
  const s = defaultState();
  s.power = 'off';
  s.original = { wallpapers: ['/x.heic', null], recordedAt: 5 };
  await saveState(fs, '/data', s);
  const loaded = await loadState(fs, '/data');
  assert.equal(loaded.power, 'off');
  assert.deepEqual(loaded.original, { wallpapers: ['/x.heic', null], recordedAt: 5 });
});

test('a state file from before feature 004 loads as on, with no originals', async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic('/data/state.json', JSON.stringify({ settings: { intervalMinutes: 15 } }));
  const s = await loadState(fs, '/data');
  assert.equal(s.power, 'on');
  assert.equal(s.original, null);
});
