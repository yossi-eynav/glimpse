import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signOut } from '../../../src/core/auth/sign-out.ts';
import { TokenStore } from '../../../src/core/auth/token-store.ts';
import { jsonResponse } from '../../support/fake-fetch.ts';
import { fakeSecretBox } from '../../support/fake-secret-box.ts';
import { sampleJpeg } from '../../support/fixtures.ts';
import { signedInGoogle } from '../../support/google.ts';
import { makeEngine } from '../../support/engine.ts';
import { signedInState } from '../../support/state.ts';

const setup = async (revoke: () => Response) => {
  const g = signedInGoogle([{ method: 'POST', url: /oauth2\.googleapis\.com\/revoke/, respond: revoke }]);
  const ctx = await makeEngine(signedInState(['a', 'b']));
  for (const id of ['a', 'b']) await ctx.fs.writeAtomic(ctx.photos.thumbPath(id), sampleJpeg());
  const tokenStore = new TokenStore({ fs: ctx.fs, path: '/data/tokens.bin', box: fakeSecretBox });
  await tokenStore.save({ access_token: 'a1', refresh_token: 'r1' });
  await ctx.engine.start();
  return { ...ctx, ...g, tokenStore };
};

test('sign-out stops rotation, deletes photos and tokens, revokes, and resets the account', async () => {
  const { engine, fs, google, tokenStore, photos, calls } = await setup(() => jsonResponse(200, {}));
  await signOut({ engine, google, tokenStore, photos });

  const s = engine.getState();
  assert.deepEqual(s.account, { status: 'signedOut', email: null });
  assert.equal(s.rotation.mode, 'stopped');
  assert.deepEqual(s.selection.photos, []);
  assert.deepEqual(await fs.list('/data/Photos'), []);
  assert.deepEqual(await fs.list('/data/Thumbs'), []);
  assert.equal(await tokenStore.load(), null);
  assert.equal(google.oauth.credentials.access_token, undefined);
  const revoke = calls.find((c) => c.url.includes('/revoke'));
  assert.ok(revoke);
  assert.ok(revoke.url.includes('token=r1') || revoke.body.includes('token=r1'));
});

test('local cleanup still finishes when revoke fails', async () => {
  const { engine, google, tokenStore, photos } = await setup(() => jsonResponse(500, {}));
  await signOut({ engine, google, tokenStore, photos });
  assert.equal(engine.getState().account.status, 'signedOut');
  assert.equal(await tokenStore.load(), null);
});

test('sign-out turns off the screensaver handoff', async () => {
  const { engine, google, tokenStore, photos } = await setup(() => jsonResponse(200, {}));
  const calls: string[] = [];
  const handoff = { publish: async () => void calls.push('publish'), disable: async () => void calls.push('disable') };
  await signOut({ engine, google, tokenStore, photos, handoff });
  assert.deepEqual(calls, ['disable']);
});
