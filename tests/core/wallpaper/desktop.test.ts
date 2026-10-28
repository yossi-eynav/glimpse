import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPhoto, FakeDesktop } from '../../../src/core/wallpaper/desktop.ts';

test('applyPhoto sets <photosDir>/<id>.jpg on the desktop', async () => {
  const desktop = new FakeDesktop();
  const path = await applyPhoto(desktop, '/data/Photos', 'p1');
  assert.equal(path, '/data/Photos/p1.jpg');
  assert.deepEqual(desktop.calls, ['/data/Photos/p1.jpg']);
  assert.deepEqual(await desktop.get(), ['/data/Photos/p1.jpg']);
});

test('FakeDesktop can simulate a wallpaper set outside the app', async () => {
  const desktop = new FakeDesktop(2);
  desktop.current = ['/System/Library/Desktop Pictures/Sonoma.heic', '/data/Photos/p1.jpg'];
  assert.deepEqual(await desktop.get(), ['/System/Library/Desktop Pictures/Sonoma.heic', '/data/Photos/p1.jpg']);
});
