import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSelection } from '../support/render-selection.ts';

const count = (html: string, needle: string | RegExp) => html.split(needle).length - 1;

test('empty draft shows the empty state and no images', async () => {
  const html = await renderSelection({ draft: { photos: [], skippedNonPhotoCount: 0 } });
  assert.match(html, /No photos yet/);
  assert.match(html, /Pick photos in Google Photos to use them as your wallpaper\./);
  assert.match(html, /Add from Google Photos/);
  assert.equal(count(html, '<img'), 0);
});

test('tiles render per state with the right labels', async () => {
  const html = await renderSelection({
    draft: {
      photos: [
        { id: 'a', status: 'saved' },
        { id: 'b', status: 'saved' },
        { id: 'c', status: 'pending' },
        { id: 'd', status: 'unavailable' },
      ],
      skippedNonPhotoCount: 0,
    },
  });
  assert.match(html, /4 photos/);
  assert.equal(count(html, '<img'), 3);
  assert.equal(count(html, 'src="photo://thumb/'), 3);
  assert.equal(count(html, 'aria-busy="true"'), 1);
  assert.match(html, /This photo is unavailable\. Remove it, or pick it again\./);
  assert.equal(count(html, 'aria-label="Remove photo"'), 4);
  assert.match(html, />Cancel</);
  assert.match(html, />Done</);
});

test('picking shows the browser overlay with Cancel', async () => {
  const html = await renderSelection({ draft: { photos: [], skippedNonPhotoCount: 0 }, picking: true });
  assert.match(html, /Finish choosing in your browser…/);
});

test('a message is rendered', async () => {
  const html = await renderSelection({ draft: { photos: [], skippedNonPhotoCount: 0 }, message: { severity: 'error', text: 'boom' } });
  assert.match(html, /boom/);
});

test('dark mode renders', async () => {
  await renderSelection({ draft: { photos: [{ id: 'a', status: 'saved' }], skippedNonPhotoCount: 0 }, dark: true });
});

test('no permanent note about skipped videos (FR-010)', async () => {
  const html = await renderSelection({ draft: { photos: [{ id: 'a', status: 'saved' }], skippedNonPhotoCount: 3 }, message: null });
  assert.doesNotMatch(html, /video/i);
  assert.doesNotMatch(html, /skipped/i);
});
