import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleClient } from '../../../src/core/auth/google-client.ts';
import { signIn, decodeIdTokenEmail } from '../../../src/core/auth/sign-in.ts';
import { TokenStore } from '../../../src/core/auth/token-store.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { createFakeFetch, jsonResponse } from '../../support/fake-fetch.ts';
import { fakeSecretBox } from '../../support/fake-secret-box.ts';
import { fixture } from '../../support/fixtures.ts';

const setup = (waitForCode: (state: string) => Promise<string>) => {
  const fake = createFakeFetch([
    { method: 'POST', url: 'https://oauth2.googleapis.com/token', respond: () => jsonResponse(200, fixture('oauth_token.json')) },
  ]);
  const google = createGoogleClient({ clientId: 'cid', clientSecret: 'secret', fetch: fake.fetch, retryDelayMs: 1 });
  const tokenStore = new TokenStore({ fs: new MemoryFileSystem(), path: '/d/tokens.bin', box: fakeSecretBox });
  const opened: string[] = [];
  let state = '';
  const deps = {
    google,
    tokenStore,
    openExternal: async (url: string) => {
      opened.push(url);
    },
    startLoopback: async () => ({
      redirectUri: 'http://127.0.0.1:5555',
      waitForCode: (s: string) => {
        state = s;
        return waitForCode(s);
      },
    }),
  };
  return { deps, fake, tokenStore, opened, getState: () => state };
};

test('opens a PKCE authorize URL, exchanges the code, and stores tokens', async () => {
  const { deps, fake, tokenStore, opened, getState } = setup(async () => 'code-123');
  const result = await signIn(deps);

  assert.deepEqual(result, { status: 'signedIn', email: 'test@example.com' });
  const url = new URL(opened[0]);
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  const p = url.searchParams;
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.ok(p.get('code_challenge'));
  assert.equal(p.get('access_type'), 'offline');
  assert.equal(p.get('redirect_uri'), 'http://127.0.0.1:5555');
  assert.equal(p.get('scope'), 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly openid email');
  assert.equal(p.get('state'), getState());
  assert.ok(getState().length >= 16);

  const body = new URLSearchParams(fake.calls[0].body);
  assert.equal(body.get('code'), 'code-123');
  assert.ok(body.get('code_verifier'));
  assert.equal(body.get('redirect_uri'), 'http://127.0.0.1:5555');
  assert.equal((await tokenStore.load())?.refresh_token, '1//refresh-1');
  assert.equal(deps.google.oauth.credentials.access_token, 'ya29.access-1');
});

test('uses a fresh random state each time', async () => {
  const a = setup(async () => 'c');
  await signIn(a.deps);
  const b = setup(async () => 'c');
  await signIn(b.deps);
  assert.notEqual(a.getState(), b.getState());
});

test('a loopback failure rejects and stores nothing', async () => {
  const { deps, tokenStore } = setup(async () => {
    throw Object.assign(new Error('denied'), { name: 'LoopbackError', kind: 'AuthDenied' });
  });
  await assert.rejects(signIn(deps), { kind: 'AuthDenied' });
  assert.equal(await tokenStore.load(), null);
});

test('decodeIdTokenEmail reads the email claim', () => {
  assert.equal(decodeIdTokenEmail(fixture('oauth_token.json').id_token), 'test@example.com');
  assert.equal(decodeIdTokenEmail('not-a-jwt'), null);
});

test('sign-in fails clearly when the Google Photos permission was not granted', async () => {
  const withoutPhotos = { ...fixture('oauth_token.json'), scope: 'openid https://www.googleapis.com/auth/userinfo.email' };
  const fake = createFakeFetch([{ method: 'POST', url: 'https://oauth2.googleapis.com/token', respond: () => jsonResponse(200, withoutPhotos) }]);
  const google = createGoogleClient({ clientId: 'cid', clientSecret: 'secret', fetch: fake.fetch, retryDelayMs: 1 });
  const tokenStore = new TokenStore({ fs: new MemoryFileSystem(), path: '/d/tokens.bin', box: fakeSecretBox });
  await assert.rejects(
    signIn({
      google,
      tokenStore,
      openExternal: async () => {},
      startLoopback: async () => ({ redirectUri: 'http://127.0.0.1:1', waitForCode: async () => 'c' }),
    }),
    /tick the Google Photos permission/,
  );
  assert.equal(await tokenStore.load(), null);
});
