import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SelectionDraft } from '../../../src/core/library/selection-draft.ts';
import type { Selection, SelectedPhoto } from '../../../src/core/persistence/app-state.ts';
import { ManualClock } from '../../../src/core/rotation/clock.ts';

const photo = (id: string, status: SelectedPhoto['status'] = 'saved'): SelectedPhoto => ({ id, createdAt: null, width: 4, height: 3, status, addedAt: 1 });
const picked = (id: string) => ({ id, createdAt: null, width: 4000, height: 3000 });
const base = (): Selection => ({ photos: [photo('a'), photo('b')], skippedNonPhotoCount: 0 });

test('addPicked adds new photos as pending and skips duplicates', () => {
  const draft = SelectionDraft.from(base(), new ManualClock(77));
  const added = draft.addPicked([picked('b'), picked('c')], 2);
  assert.deepEqual(added, ['c']);
  const c = draft.photos.find((p) => p.id === 'c');
  assert.deepEqual(c, { id: 'c', createdAt: null, width: 4000, height: 3000, status: 'pending', addedAt: 77 });
  assert.equal(draft.photos.length, 3);
  assert.equal(draft.view().skippedNonPhotoCount, 2);
});

test('remove and clear change only the draft', () => {
  const original = base();
  const draft = SelectionDraft.from(original, new ManualClock());
  draft.remove('a');
  assert.deepEqual(draft.photos.map((p) => p.id), ['b']);
  draft.clear();
  assert.equal(draft.photos.length, 0);
  assert.deepEqual(original.photos.map((p) => p.id), ['a', 'b']);
});

test('commit returns the new selection and every ID whose files should be deleted', () => {
  const draft = SelectionDraft.from(base(), new ManualClock());
  draft.addPicked([picked('c'), picked('d')], 0);
  draft.remove('a');
  draft.remove('d');
  const { selection, removedIds } = draft.commit();
  assert.deepEqual(selection.photos.map((p) => p.id), ['b', 'c']);
  assert.deepEqual(removedIds.sort(), ['a', 'd']);
});

test('discard keeps the saved selection and returns photos added in this draft', () => {
  const original = base();
  const draft = SelectionDraft.from(original, new ManualClock());
  draft.addPicked([picked('c')], 0);
  draft.remove('a');
  assert.deepEqual(draft.discard(), ['c']);
  assert.deepEqual(original.photos.map((p) => p.id), ['a', 'b']);
});

test('setStatus updates a draft photo, and view() matches the IPC DraftView', () => {
  const draft = SelectionDraft.from({ photos: [photo('a', 'pending')], skippedNonPhotoCount: 1 }, new ManualClock());
  draft.setStatus('a', 'saved');
  assert.deepEqual(draft.view(), { photos: [{ id: 'a', status: 'saved' }], skippedNonPhotoCount: 1 });
  assert.equal(draft.has('a'), true);
  assert.equal(draft.has('zzz'), false);
});

test('commit reports the photos added in this draft that are still selected', () => {
  const draft = SelectionDraft.from(base(), new ManualClock());
  draft.addPicked([picked('c'), picked('d')], 0);
  draft.remove('d');
  const { addedIds, removedIds } = draft.commit();
  assert.deepEqual(addedIds, ['c']);
  assert.deepEqual(removedIds, ['d']);
});

test('commit reports no added photos when nothing was added', () => {
  const draft = SelectionDraft.from(base(), new ManualClock());
  draft.remove('a');
  assert.deepEqual(draft.commit().addedIds, []);
});
