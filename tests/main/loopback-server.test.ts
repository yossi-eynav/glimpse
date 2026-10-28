import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLoopbackServer } from '../../src/main/platform/loopback-server.ts';

test('listens on 127.0.0.1 and resolves the code for a matching state', async () => {
  const server = await startLoopbackServer({ timeoutMs: 5_000 });
  assert.match(server.redirectUri, /^http:\/\/127\.0\.0\.1:\d+$/);
  const code = server.waitForCode('s1');
  const res = await fetch(`${server.redirectUri}/?code=abc&state=s1`);
  assert.equal(await code, 'abc');
  assert.match(await res.text(), /You can close this tab/);
});

test('rejects a state mismatch', async () => {
  const server = await startLoopbackServer({ timeoutMs: 5_000 });
  const rejected = assert.rejects(server.waitForCode('expected'), { name: 'LoopbackError', kind: 'StateMismatch' });
  await fetch(`${server.redirectUri}/?code=abc&state=other`);
  await rejected;
});

test('rejects when the user denies access', async () => {
  const server = await startLoopbackServer({ timeoutMs: 5_000 });
  const rejected = assert.rejects(server.waitForCode('s1'), { kind: 'AuthDenied' });
  await fetch(`${server.redirectUri}/?error=access_denied&state=s1`);
  await rejected;
});

test('times out when no redirect arrives', async () => {
  const server = await startLoopbackServer({ timeoutMs: 30 });
  await assert.rejects(server.waitForCode('s1'), { kind: 'Timeout' });
});

test('closes after handling one redirect', async () => {
  const server = await startLoopbackServer({ timeoutMs: 5_000 });
  const code = server.waitForCode('s1');
  await fetch(`${server.redirectUri}/?code=abc&state=s1`);
  await code;
  await assert.rejects(fetch(`${server.redirectUri}/?code=again&state=s1`));
});
