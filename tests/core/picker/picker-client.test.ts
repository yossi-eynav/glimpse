import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NeedsReauth } from '../../../src/core/auth/google-client.ts';
import { createPickerClient } from '../../../src/core/picker/picker-client.ts';
import { ManualClock } from '../../../src/core/rotation/clock.ts';
import { jsonResponse, type Route } from '../../support/fake-fetch.ts';
import { fixture } from '../../support/fixtures.ts';
import { signedInGoogle } from '../../support/google.ts';

const BASE = 'https://photospicker.googleapis.com/v1';

const make = (routes: Route[], credentials?: Parameters<typeof signedInGoogle>[1]) => {
  const g = signedInGoogle(routes, credentials);
  const clock = new ManualClock(0);
  const opened: string[] = [];
  const picker = createPickerClient({ google: g.google, clock, openExternal: async (u) => void opened.push(u) });
  return { ...g, clock, opened, picker };
};

test('createSession POSTs an empty body and parses the session', async () => {
  const { picker, calls } = make([{ method: 'POST', url: `${BASE}/sessions`, respond: () => jsonResponse(200, fixture('picker_create_session.json')) }]);
  const s = await picker.createSession();
  assert.equal(s.id, 'sess-1');
  assert.equal(calls[0].headers.authorization, 'Bearer a1');
  assert.deepEqual(JSON.parse(calls[0].body), {});
});

test('open adds /autoclose to the picker URI', async () => {
  const { picker, opened } = make([]);
  await picker.open(fixture('picker_create_session.json'));
  assert.deepEqual(opened, ['https://photos.google.com/picker/sess-1/autoclose']);
});

test('waitUntilPicked polls at pollInterval until mediaItemsSet', async () => {
  const { picker, clock, calls } = make([
    { method: 'GET', url: `${BASE}/sessions/sess-1`, once: true, respond: () => jsonResponse(200, fixture('picker_session_pending.json')) },
    { method: 'GET', url: `${BASE}/sessions/sess-1`, once: true, respond: () => jsonResponse(200, fixture('picker_session_pending.json')) },
    { method: 'GET', url: `${BASE}/sessions/sess-1`, respond: () => jsonResponse(200, fixture('picker_session_set.json')) },
  ]);
  const result = await picker.waitUntilPicked(fixture('picker_create_session.json'), new AbortController().signal);
  assert.equal(result, 'picked');
  assert.equal(calls.length, 3);
  assert.deepEqual(clock.sleeps, [5_000, 5_000]);
});

test('waitUntilPicked times out after timeoutIn', async () => {
  const session = { ...fixture('picker_create_session.json'), pollingConfig: { pollInterval: '5s', timeoutIn: '15s' } };
  const pending = { ...fixture('picker_session_pending.json'), pollingConfig: { pollInterval: '5s', timeoutIn: '15s' } };
  const { picker, clock } = make([{ method: 'GET', url: `${BASE}/sessions/sess-1`, respond: () => jsonResponse(200, pending) }]);
  assert.equal(await picker.waitUntilPicked(session, new AbortController().signal), 'timedOut');
  assert.equal(clock.now(), 15_000);
});

test('an aborted signal returns cancelled and deletes the session', async () => {
  const { picker, calls } = make([{ method: 'DELETE', url: `${BASE}/sessions/sess-1`, respond: () => jsonResponse(200, {}) }]);
  const ac = new AbortController();
  ac.abort();
  assert.equal(await picker.waitUntilPicked(fixture('picker_create_session.json'), ac.signal), 'cancelled');
  assert.deepEqual(calls.map((c) => c.method), ['DELETE']);
});

test('listMediaItems follows nextPageToken', async () => {
  const { picker, calls } = make([
    { method: 'GET', url: /\/mediaItems\?.*pageToken=p2/, respond: () => jsonResponse(200, fixture('picker_media_page2.json')) },
    { method: 'GET', url: /\/mediaItems\?/, respond: () => jsonResponse(200, fixture('picker_media_page1.json')) },
  ]);
  const items = await picker.listMediaItems('sess-1');
  assert.equal(items.length, 5);
  const first = new URL(calls[0].url);
  assert.equal(first.pathname, '/v1/mediaItems');
  assert.equal(first.searchParams.get('sessionId'), 'sess-1');
  assert.equal(first.searchParams.get('pageSize'), '100');
});

test('deleteSession sends DELETE', async () => {
  const { picker, calls } = make([{ method: 'DELETE', url: `${BASE}/sessions/sess-1`, respond: () => jsonResponse(200, {}) }]);
  await picker.deleteSession('sess-1');
  assert.equal(calls.length, 1);
});

test('invalid_grant on refresh rejects with NeedsReauth', async () => {
  const { picker } = make(
    [{ method: 'POST', url: 'https://oauth2.googleapis.com/token', respond: () => jsonResponse(400, fixture('oauth_invalid_grant.json')) }],
    { access_token: 'old', refresh_token: 'r1', expiry_date: Date.now() - 1_000 },
  );
  await assert.rejects(picker.createSession(), NeedsReauth);
});
