import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentNotice } from '../../../src/core/menu/notice.ts';
import { menuModel } from '../../../src/core/menu/menu-model.ts';
import { photo, signedInState } from '../../support/state.ts';

const state = (statuses: ('saved' | 'pending' | 'unavailable')[], reauth = false) =>
  signedInState([], (s) => {
    s.selection.photos = statuses.map((st, i) => photo(`p${i}`, st));
    if (reauth) s.account.status = 'needsReauth';
  });

test('needsReauth wins over everything else', () => {
  assert.deepEqual(currentNotice({ state: state(['pending', 'unavailable'], true), isOnline: false, lowDisk: true }), {
    text: 'Sign in again to change your photos',
    action: 'signIn',
  });
});

test('then low disk space', () => {
  assert.deepEqual(currentNotice({ state: state(['pending', 'unavailable']), isOnline: false, lowDisk: true }), {
    text: "Low disk space — new photos aren't being saved",
    action: null,
  });
});

test('then offline with pending photos', () => {
  assert.deepEqual(currentNotice({ state: state(['pending', 'pending', 'unavailable']), isOnline: false, lowDisk: false }), {
    text: 'Offline — 2 photos waiting to download',
    action: null,
  });
});

test('offline alone is not a notice', () => {
  assert.equal(currentNotice({ state: state(['saved']), isOnline: false, lowDisk: false }), null);
});

test('then unavailable photos, which open the dialog', () => {
  assert.deepEqual(currentNotice({ state: state(['saved', 'unavailable']), isOnline: true, lowDisk: false }), {
    text: '1 photos unavailable',
    action: 'chooseImages',
  });
});

test('null when nothing applies', () => {
  assert.equal(currentNotice({ state: state(['saved']), isOnline: true, lowDisk: false }), null);
});

test('menuModel puts the notice first; an actionable notice is clickable', () => {
  const items = menuModel({ state: state(['saved'], true), notice: { text: 'Sign in again to change your photos', action: 'signIn' }, now: 0 });
  assert.deepEqual(items[0], { kind: 'action', id: 'signIn', label: '⚠ Sign in again to change your photos', enabled: true });
  const info = menuModel({ state: state(['saved']), notice: { text: "Low disk space — new photos aren't being saved", action: null }, now: 0 });
  assert.deepEqual(info[0], { kind: 'label', label: "⚠ Low disk space — new photos aren't being saved" });
});

test('a needsReauth account still gets the signed-in menu', () => {
  const items = menuModel({ state: state(['saved'], true), notice: null, now: 0 });
  assert.ok(items.some((i) => i.kind === 'action' && i.id === 'chooseImages'));
});
