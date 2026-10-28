import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleClient } from '../../../src/core/auth/google-client.ts';
import { signIn } from '../../../src/core/auth/sign-in.ts';
import { TokenStore } from '../../../src/core/auth/token-store.ts';
import { redact } from '../../../src/core/log.ts';
import { createPickerClient } from '../../../src/core/picker/picker-client.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { defaultState } from '../../../src/core/persistence/app-state.ts';
import { saveState } from '../../../src/core/persistence/state-file.ts';
import { ManualClock } from '../../../src/core/rotation/clock.ts';
import { createFakeFetch, jsonResponse } from '../../support/fake-fetch.ts';
import { fakeSecretBox } from '../../support/fake-secret-box.ts';
import { fixture } from '../../support/fixtures.ts';

const SECRETS = ['ya29.access-1', 'ya29.access-2', '1//refresh-1', 'code-123', 'secret'];

test('redact drops token, code and secret fields, including nested and header values', () => {
  const out = redact({
    access_token: 'ya29.x',
    refresh_token: 'r',
    id_token: 'i',
    code: 'c',
    client_secret: 's',
    headers: { Authorization: 'Bearer ya29.x', accept: 'json' },
    photoId: 'p1',
  });
  assert.deepEqual(out, {
    access_token: '[redacted]',
    refresh_token: '[redacted]',
    id_token: '[redacted]',
    code: '[redacted]',
    client_secret: '[redacted]',
    headers: { Authorization: '[redacted]', accept: 'json' },
    photoId: 'p1',
  });
});

test('sign-in, refresh and a picker session leave no secrets in state.json or IPC results', async () => {
  const fake = createFakeFetch([
    { method: 'POST', url: 'https://oauth2.googleapis.com/token', once: true, respond: () => jsonResponse(200, fixture('oauth_token.json')) },
    { method: 'POST', url: 'https://oauth2.googleapis.com/token', respond: () => jsonResponse(200, fixture('oauth_refresh.json')) },
    { method: 'POST', url: /\/v1\/sessions$/, respond: () => jsonResponse(200, fixture('picker_create_session.json')) },
  ]);
  const google = createGoogleClient({ clientId: 'cid', clientSecret: 'secret', fetch: fake.fetch, retryDelayMs: 1 });
  const fs = new MemoryFileSystem();
  const tokenStore = new TokenStore({ fs, path: '/d/tokens.bin', box: fakeSecretBox });
  const result = await signIn({
    google,
    tokenStore,
    openExternal: async () => {},
    startLoopback: async () => ({ redirectUri: 'http://127.0.0.1:1', waitForCode: async () => 'code-123' }),
  });
  await google.oauth.refreshAccessToken();
  const session = await createPickerClient({ google, clock: new ManualClock(), openExternal: async () => {} }).createSession();

  const state = defaultState();
  state.account = { status: result.status, email: result.email };
  await saveState(fs, '/d', state);
  const exposed = [new TextDecoder().decode(await fs.read('/d/state.json')), JSON.stringify(result), JSON.stringify(session)].join('\n');
  for (const secret of SECRETS) assert.equal(exposed.includes(secret), false, secret);
});
