import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoStore } from '../../../src/core/library/photo-store.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { sampleJpeg } from '../../support/fixtures.ts';

test('paths live under Photos/ and Thumbs/', () => {
  const store = createPhotoStore({ fs: new MemoryFileSystem(), dir: '/data' });
  assert.equal(store.photoPath('x'), '/data/Photos/x.jpg');
  assert.equal(store.thumbPath('x'), '/data/Thumbs/x.jpg');
  assert.equal(store.photosDir, '/data/Photos');
});

test('deletePhotos removes both files for each ID', async () => {
  const fs = new MemoryFileSystem();
  const store = createPhotoStore({ fs, dir: '/data' });
  for (const id of ['a', 'b']) {
    await fs.writeAtomic(store.photoPath(id), sampleJpeg());
    await fs.writeAtomic(store.thumbPath(id), sampleJpeg());
  }
  await store.deletePhotos(['a']);
  assert.equal(await fs.exists(store.photoPath('a')), false);
  assert.equal(await fs.exists(store.thumbPath('a')), false);
  assert.equal(await fs.exists(store.photoPath('b')), true);
});

test('deleteAll empties both folders', async () => {
  const fs = new MemoryFileSystem();
  const store = createPhotoStore({ fs, dir: '/data' });
  await fs.writeAtomic(store.photoPath('a'), sampleJpeg());
  await fs.writeAtomic(store.thumbPath('b'), sampleJpeg());
  await store.deleteAll();
  assert.deepEqual(await fs.list('/data/Photos'), []);
  assert.deepEqual(await fs.list('/data/Thumbs'), []);
});

test('isValidJpeg is true only for an existing file starting FF D8 FF', async () => {
  const fs = new MemoryFileSystem();
  const store = createPhotoStore({ fs, dir: '/data' });
  await fs.writeAtomic(store.photoPath('ok'), sampleJpeg());
  await fs.writeAtomic(store.photoPath('bad'), 'not a jpeg');
  assert.equal(await store.isValidJpeg('ok'), true);
  assert.equal(await store.isValidJpeg('bad'), false);
  assert.equal(await store.isValidJpeg('missing'), false);
});
