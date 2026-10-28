import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDownloader, type DownloadUpdate } from '../../../src/core/library/downloader.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { bytesResponse, jsonResponse } from '../../support/fake-fetch.ts';
import { sampleJpeg } from '../../support/fixtures.ts';
import { signedInGoogle } from '../../support/google.ts';

const items = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, baseUrl: `https://lh3.googleusercontent.com/pk/p${i}` }));

const run = async (routes: Parameters<typeof signedInGoogle>[0], n: number, fs = new MemoryFileSystem()) => {
  const g = signedInGoogle(routes);
  const updates: DownloadUpdate[] = [];
  let lowDisk = 0;
  const downloader = createDownloader({ google: g.google, fs, dir: '/data', concurrency: 4, minFreeBytes: 1_000_000_000 });
  await downloader.downloadAll(items(n), { width: 3024, height: 1964 }, {
    onUpdate: (u) => updates.push(u),
    onLowDisk: () => lowDisk++,
  });
  return { ...g, fs, updates, lowDisk };
};

test('downloads the wallpaper size and a square thumbnail, with a Bearer token', async () => {
  const { calls, fs, updates } = await run([{ method: 'GET', url: /lh3/, respond: () => bytesResponse(200, sampleJpeg()) }], 1);
  assert.deepEqual(calls.map((c) => c.url).sort(), [
    'https://lh3.googleusercontent.com/pk/p0=w256-h256-c',
    'https://lh3.googleusercontent.com/pk/p0=w3024-h1964',
  ]);
  assert.ok(calls.every((c) => c.headers.authorization === 'Bearer a1'));
  assert.deepEqual(await fs.read('/data/Photos/p0.jpg'), sampleJpeg());
  assert.deepEqual(await fs.read('/data/Thumbs/p0.jpg'), sampleJpeg());
  assert.deepEqual(updates, [{ id: 'p0', status: 'saved' }]);
});

test('an HTTP failure after retries marks the photo unavailable', async () => {
  const { updates, calls } = await run([{ method: 'GET', url: /lh3/, respond: () => jsonResponse(500, {}) }], 1);
  assert.deepEqual(updates, [{ id: 'p0', status: 'unavailable' }]);
  assert.equal(calls.length, 5);
});

test('a network error leaves the photo pending', async () => {
  const { updates } = await run([{ method: 'GET', url: /lh3/, respond: () => { throw new TypeError('fetch failed'); } }], 1);
  assert.deepEqual(updates, [{ id: 'p0', status: 'pending' }]);
});

test('runs at most 4 photos at a time', async () => {
  let inFlight = 0;
  let max = 0;
  const { updates } = await run(
    [{
      method: 'GET',
      url: /=w3024/,
      respond: async () => {
        max = Math.max(max, ++inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return bytesResponse(200, sampleJpeg());
      },
    }, { method: 'GET', url: /=w256/, respond: () => bytesResponse(200, sampleJpeg()) }],
    10,
  );
  assert.equal(updates.length, 10);
  assert.ok(max <= 4 && max > 1, `max in flight was ${max}`);
});

test('stops starting downloads when free space is under the minimum', async () => {
  const fs = new MemoryFileSystem();
  fs.free = 500_000_000;
  const { calls, updates, lowDisk } = await run([{ method: 'GET', url: /lh3/, respond: () => bytesResponse(200, sampleJpeg()) }], 3, fs);
  assert.equal(calls.length, 0);
  assert.deepEqual(updates, []);
  assert.equal(lowDisk, 1);
});
