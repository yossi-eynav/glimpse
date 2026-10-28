import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';
import { TokenStore } from '../../../src/core/auth/token-store.ts';
import { fakeSecretBox } from '../../support/fake-secret-box.ts';

const make = () => {
  const fs = new MemoryFileSystem();
  return { fs, store: new TokenStore({ fs, path: '/data/tokens.bin', box: fakeSecretBox }) };
};

test('save writes encrypted tokens and load reads them back', async () => {
  const { fs, store } = make();
  await store.save({ access_token: 'a1', refresh_token: 'r1', expiry_date: 123 });
  const raw = new TextDecoder().decode(await fs.read('/data/tokens.bin'));
  assert.equal(raw.includes('a1'), false);
  assert.deepEqual(await store.load(), { access_token: 'a1', refresh_token: 'r1', expiry_date: 123 });
});

test('load returns null when missing or undecryptable', async () => {
  const { fs, store } = make();
  assert.equal(await store.load(), null);
  await fs.writeAtomic('/data/tokens.bin', 'garbage');
  assert.equal(await store.load(), null);
});

test('clear removes the file', async () => {
  const { fs, store } = make();
  await store.save({ access_token: 'a1' });
  await store.clear();
  assert.equal(await fs.exists('/data/tokens.bin'), false);
});

test('merge keeps the existing refresh_token when the new tokens have none', async () => {
  const { store } = make();
  await store.save({ access_token: 'a1', refresh_token: 'r1', expiry_date: 1 });
  await store.merge({ access_token: 'a2', expiry_date: 2 });
  assert.deepEqual(await store.load(), { access_token: 'a2', refresh_token: 'r1', expiry_date: 2 });
});
