import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterStillPhotos, parseDuration, type PickedMediaItem } from '../../../src/core/picker/models.ts';
import { fixture } from '../../support/fixtures.ts';

test('keeps only PHOTO items with an image MIME type', () => {
  const items: PickedMediaItem[] = [
    ...fixture('picker_media_page1.json').mediaItems,
    ...fixture('picker_media_page2.json').mediaItems,
  ];
  const { photos, skipped } = filterStillPhotos(items);
  assert.deepEqual(photos.map((p) => p.id), ['item-1', 'item-2', 'item-4', 'item-5']);
  assert.equal(skipped, 1);
});

test('rejects a PHOTO whose MIME type is not an image', () => {
  const item = fixture('picker_media_page2.json').mediaItems[0];
  item.mediaFile.mimeType = 'application/octet-stream';
  assert.deepEqual(filterStillPhotos([item]), { photos: [], skipped: 1 });
});

test('parseDuration converts protobuf duration strings to ms', () => {
  assert.equal(parseDuration('5s'), 5_000);
  assert.equal(parseDuration('1800s'), 1_800_000);
  assert.equal(parseDuration('0.5s'), 500);
  assert.equal(parseDuration(undefined), null);
});
