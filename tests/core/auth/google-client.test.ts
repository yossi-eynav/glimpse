import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleClient, googleRetryConfig } from '../../../src/core/auth/google-client.ts';
import { createFakeFetch, jsonResponse } from '../../support/fake-fetch.ts';

const API = 'https://photospicker.googleapis.com/v1/sessions/s1';
const TOKEN = 'https://oauth2.googleapis.com/token';

const make = (routes: Parameters<typeof createFakeFetch>[0]) => {
  const fake = createFakeFetch(routes);
  const google = createGoogleClient({
    clientId: 'cid',
    clientSecret: 'secret',
    redirectUri: 'http://127.0.0.1:5555',
    fetch: fake.fetch,
    retryDelayMs: 1,
  });
  google.oauth.setCredentials({ access_token: 'a1', refresh_token: 'r1', expiry_date: Date.now() + 3_600_000 });
  return { ...fake, google };
};

test('requests go through the injected fetch with a Bearer token', async () => {
  const { google, calls } = make([{ method: 'GET', url: API, respond: () => jsonResponse(200, { id: 's1' }) }]);
  const res = await google.request<{ id: string }>({ url: API });
  assert.equal(res.data.id, 's1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.authorization, 'Bearer a1');
});

test('retries 5xx with the configured backoff policy', async () => {
  const { google, calls } = make([
    { method: 'GET', url: API, once: true, respond: () => jsonResponse(503, {}) },
    { method: 'GET', url: API, once: true, respond: () => jsonResponse(503, {}) },
    { method: 'GET', url: API, respond: () => jsonResponse(200, { id: 's1' }) },
  ]);
  const res = await google.request<{ id: string }>({ url: API });
  assert.equal(res.data.id, 's1');
  assert.equal(calls.length, 3);
});

test('retry policy matches research R11', () => {
  assert.deepEqual(googleRetryConfig(1000), {
    retry: 4,
    retryDelay: 1000,
    retryDelayMultiplier: 2,
    statusCodesToRetry: [[429, 429], [500, 599]],
    httpMethodsToRetry: ['GET', 'POST', 'DELETE'],
  });
});

test('a 401 triggers exactly one refresh, retries with the new token, and emits tokens', async () => {
  const { google, calls } = make([
    { method: 'GET', url: API, once: true, respond: () => jsonResponse(401, { error: { code: 401 } }) },
    { method: 'POST', url: TOKEN, respond: () => jsonResponse(200, { access_token: 'a2', expires_in: 3599, token_type: 'Bearer' }) },
    { method: 'GET', url: API, respond: () => jsonResponse(200, { id: 's1' }) },
  ]);
  const emitted: unknown[] = [];
  google.oauth.on('tokens', (t) => emitted.push(t));
  await google.request({ url: API });
  assert.equal(calls.filter((c) => c.url === TOKEN).length, 1);
  assert.equal(calls.at(-1)?.headers.authorization, 'Bearer a2');
  assert.equal(emitted.length, 1);
});
