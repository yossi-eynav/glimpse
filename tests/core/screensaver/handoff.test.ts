import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandoffWriter, defaultHandoffDir } from '../../../src/core/screensaver/handoff.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { ManualClock } from '../../../src/core/rotation/clock.ts';
import { sampleJpeg } from '../../support/fixtures.ts';

const DIR = '/Users/me/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper';

test('the default folder is inside the legacyScreenSaver container', () => {
  assert.equal(defaultHandoffDir('/Users/me'), DIR);
});

test('publish writes current.jpg, then the manifest', async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic('/data/Photos/p1.jpg', sampleJpeg());
  fs.writeLog.length = 0;
  const writer = createHandoffWriter({ fs, dir: DIR, clock: new ManualClock(Date.UTC(2026, 9, 27, 10, 0)) });
  await writer.publish('/data/Photos/p1.jpg', 'p1');

  assert.deepEqual(fs.writeLog, [`${DIR}/current.jpg`, `${DIR}/manifest.json`]);
  assert.deepEqual(await fs.read(`${DIR}/current.jpg`), sampleJpeg());
  assert.deepEqual(JSON.parse(new TextDecoder().decode(await fs.read(`${DIR}/manifest.json`))), {
    version: 1,
    photoId: 'p1',
    updatedAt: '2026-10-27T10:00:00.000Z',
    enabled: true,
  });
});

test('disable writes enabled: false', async () => {
  const fs = new MemoryFileSystem();
  const writer = createHandoffWriter({ fs, dir: DIR, clock: new ManualClock(0) });
  await writer.disable();
  const manifest = JSON.parse(new TextDecoder().decode(await fs.read(`${DIR}/manifest.json`)));
  assert.equal(manifest.enabled, false);
  assert.equal(manifest.version, 1);
});

test("disable deletes the screensaver's copy of the photo", async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic('/data/Photos/p1.jpg', sampleJpeg());
  const writer = createHandoffWriter({ fs, dir: DIR, clock: new ManualClock(0) });
  await writer.publish('/data/Photos/p1.jpg', 'p1');
  await writer.disable();
  assert.equal(await fs.exists(`${DIR}/current.jpg`), false);
  const manifest = JSON.parse(new TextDecoder().decode(await fs.read(`${DIR}/manifest.json`)));
  assert.equal(manifest.enabled, false);
});
