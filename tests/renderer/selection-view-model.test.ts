import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headerTitle, pickMessage, plural, tileModel } from '../../src/renderer/selection/view-model.ts';
import type { DraftPhotoView } from '../../src/shared/ipc-types.ts';

const draft = (n: number, skippedNonPhotoCount = 0) => ({
  photos: Array.from({ length: n }, (_, i): DraftPhotoView => ({ id: `p${i}`, status: 'saved' })),
  skippedNonPhotoCount,
});

test('plural picks the singular only for exactly 1', () => {
  assert.equal(plural(1, 'photo', 'photos'), '1 photo');
  assert.equal(plural(0, 'photo', 'photos'), '0 photos');
  assert.equal(plural(2, 'photo', 'photos'), '2 photos');
  assert.equal(plural(1, 'video', 'videos'), '1 video');
  assert.equal(plural(3, 'video', 'videos'), '3 videos');
});

test('headerTitle', () => {
  assert.equal(headerTitle(draft(0)), 'No photos yet');
  assert.equal(headerTitle(draft(1)), '1 photo');
  assert.equal(headerTitle(draft(12)), '12 photos');
});

test('tileModel maps each status to a tile state', () => {
  assert.deepEqual(tileModel({ id: 'a', status: 'saved' }), { id: 'a', state: 'ready', thumbUrl: 'photo://thumb/a', label: 'Photo' });
  assert.equal(tileModel({ id: 'a/b', status: 'saved' }).thumbUrl, 'photo://thumb/a%2Fb');
  assert.deepEqual(tileModel({ id: 'a', status: 'pending' }), { id: 'a', state: 'loading', thumbUrl: null, label: 'Downloading…' });
  assert.deepEqual(tileModel({ id: 'a', status: 'unavailable' }), {
    id: 'a',
    state: 'unavailable',
    thumbUrl: 'photo://thumb/a',
    label: 'This photo is unavailable. Remove it, or pick it again.',
  });
});

test('pickMessage: added photos, nothing picked, cancelled', () => {
  assert.deepEqual(pickMessage({ kind: 'added', added: 3, skippedNonPhotoCount: 0 }), { severity: 'success', text: 'Added 3 photos' });
  assert.deepEqual(pickMessage({ kind: 'added', added: 1, skippedNonPhotoCount: 0 }), { severity: 'success', text: 'Added 1 photo' });
  assert.equal(pickMessage({ kind: 'added', added: 0, skippedNonPhotoCount: 0 }), null);
  assert.equal(pickMessage({ kind: 'cancelled' }), null);
});

test('pickMessage: timeout, sign-in and errors', () => {
  assert.deepEqual(pickMessage({ kind: 'timedOut' }), { severity: 'warning', text: 'The Google Photos picker timed out. Try again.' });
  assert.deepEqual(pickMessage({ kind: 'needsSignIn' }), {
    severity: 'warning',
    text: 'Your Google sign-in expired. Choose "Sign in again" in the menu bar, then try again.',
  });
  assert.deepEqual(pickMessage({ kind: 'error', message: 'Google Photos access was not granted.' }), {
    severity: 'error',
    text: 'Google Photos access was not granted.',
  });
});

// --- US2: videos are ignored, clearly and quietly ---

test('pickMessage: photos plus ignored videos', () => {
  assert.deepEqual(pickMessage({ kind: 'added', added: 2, skippedNonPhotoCount: 1 }), {
    severity: 'success',
    text: 'Added 2 photos · 1 video ignored (only photos can be wallpapers)',
  });
  assert.equal(
    pickMessage({ kind: 'added', added: 1, skippedNonPhotoCount: 3 })?.text,
    'Added 1 photo · 3 videos ignored (only photos can be wallpapers)',
  );
});

test('pickMessage: only videos picked', () => {
  assert.deepEqual(pickMessage({ kind: 'added', added: 0, skippedNonPhotoCount: 2 }), {
    severity: 'info',
    text: 'Only photos can be wallpapers. 2 videos were ignored.',
  });
  assert.deepEqual(pickMessage({ kind: 'added', added: 0, skippedNonPhotoCount: 1 }), {
    severity: 'info',
    text: 'Only photos can be wallpapers. 1 video was ignored.',
  });
});

test('headerTitle never mentions skipped videos', () => {
  assert.equal(headerTitle(draft(1, 5)), '1 photo');
});
