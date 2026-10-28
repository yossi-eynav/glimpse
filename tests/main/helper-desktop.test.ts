import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createHelperDesktop,
  HelperError,
  HelperIncompatible,
  HelperTimeout,
  HelperUnavailable,
} from '../../src/main/platform/helper-desktop.ts';

type Logged = { level: string; message: string };

// Stop every helper even when a test fails, so no child process keeps the test run alive.
const started: { stop(): Promise<void> }[] = [];
after(() => Promise.all(started.map((d) => d.stop())));

const make = async (env: Record<string, string> = {}, opts: Partial<Parameters<typeof createHelperDesktop>[0]> = {}) => {
  const dir = await mkdtemp(join(tmpdir(), 'pw-helper-'));
  const logFile = join(dir, 'requests.log');
  const logged: Logged[] = [];
  const desktop = createHelperDesktop({
    command: process.execPath,
    args: ['tests/support/fake-helper.mjs'],
    env: { ...process.env, FAKE_HELPER_LOG: logFile, ...env },
    log: (level, message) => void logged.push({ level, message }),
    readyTimeoutMs: 2_000,
    requestTimeoutMs: 1_000,
    restartDelaysMs: [20, 20, 20],
    maxRestarts: 3,
    restartWindowMs: 60_000,
    ...opts,
  });
  started.push(desktop);
  const requests = async () =>
    (await readFile(logFile, 'utf8').catch(() => ''))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { id: number; cmd: string; path?: string });
  return { desktop, logged, requests };
};

const waitFor = async (check: () => boolean | Promise<boolean>, ms = 2_000) => {
  const end = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
};

test('start waits for ready; set, get and clear round-trip', async () => {
  const { desktop, requests } = await make();
  await desktop.start();
  await desktop.set('/p/a.jpg');
  assert.deepEqual(await desktop.get(), ['/p/a.jpg']);
  await desktop.clear();
  assert.deepEqual(await desktop.get(), ['/System/Library/CoreServices/DefaultDesktop.heic']);
  assert.deepEqual((await requests()).map((r) => r.cmd), ['show', 'get', 'clear', 'get']);
  await desktop.stop();
});

test('concurrent requests are matched to their responses by id', async () => {
  const { desktop, requests } = await make();
  await desktop.start();
  await Promise.all([desktop.set('/p/a.jpg'), desktop.set('/p/b.jpg')]);
  const ids = (await requests()).map((r) => r.id);
  assert.equal(new Set(ids).size, 2);
  await desktop.stop();
});

test('requests made before ready are queued', async () => {
  const { desktop } = await make();
  const started = desktop.start();
  const shown = desktop.set('/p/a.jpg');
  await started;
  await shown;
  assert.deepEqual(await desktop.get(), ['/p/a.jpg']);
  await desktop.stop();
});

test('a failed show rejects with HelperError', async () => {
  const { desktop } = await make({ FAKE_HELPER_FAIL_ON: 'show' });
  await desktop.start();
  await assert.rejects(desktop.set('/p/a.jpg'), (e) => e instanceof HelperError && e.message === 'boom');
  await desktop.stop();
});

test('an unanswered request times out and the helper is restarted', async () => {
  const { desktop, logged } = await make({ FAKE_HELPER_SILENT_ON: 'get' }, { requestTimeoutMs: 200 });
  await desktop.start();
  await assert.rejects(desktop.get(), HelperTimeout);
  await waitFor(() => logged.some((l) => l.message.includes('restart')));
  await desktop.set('/p/a.jpg');
  await desktop.stop();
});

test('an unsupported helper version is refused and the process killed', async () => {
  const { desktop } = await make({ FAKE_HELPER_VERSION: '2' });
  await assert.rejects(desktop.start(), HelperIncompatible);
  await assert.rejects(desktop.get(), HelperUnavailable);
});

test('after a crash the helper is restarted and the last photo is shown again', async () => {
  const { desktop, requests } = await make({ FAKE_HELPER_CRASH_ON: 'get' });
  await desktop.start();
  await desktop.set('/p/a.jpg');
  await assert.rejects(desktop.get(), HelperUnavailable);
  await waitFor(async () => (await requests()).filter((r) => r.cmd === 'show').length === 2);
  const shows = (await requests()).filter((r) => r.cmd === 'show');
  assert.deepEqual(shows.map((r) => r.path), ['/p/a.jpg', '/p/a.jpg']);
  await desktop.stop();
});

test('gives up after maxRestarts crashes within the window', async () => {
  const { desktop, logged } = await make({ FAKE_HELPER_CRASH_ON: 'get' }, { maxRestarts: 2 });
  await desktop.start();
  for (let i = 0; i < 3; i++) {
    await assert.rejects(desktop.get());
    await new Promise((r) => setTimeout(r, 150));
  }
  await waitFor(() => logged.some((l) => l.level === 'error' && l.message.includes('giving up')));
  await assert.rejects(desktop.get(), HelperUnavailable);
});

test('externalChange events are delivered to subscribers', async () => {
  const { desktop } = await make({ FAKE_HELPER_EMIT_EXTERNAL: '1' });
  const seen: string[][] = [];
  desktop.onExternalChange((paths) => seen.push(paths));
  await desktop.start();
  await desktop.set('/p/a.jpg');
  await waitFor(() => seen.length === 1);
  assert.deepEqual(seen, [['/Users/x/Pictures/cat.jpg']]);
  await desktop.stop();
});

test('stop closes the helper; later requests are unavailable', async () => {
  const { desktop } = await make();
  await desktop.start();
  await desktop.stop();
  await assert.rejects(desktop.set('/p/a.jpg'), HelperUnavailable);
});

// --- Feature 004: restore ---

test('restore sends the original paths and resolves to the restored count', async () => {
  const { desktop, requests } = await make();
  await desktop.start();
  assert.equal(await desktop.restore(['/a.heic', null]), 2);
  const sent = (await requests()).find((r) => r.cmd === 'restore') as { paths?: unknown } | undefined;
  assert.deepEqual(sent?.paths, ['/a.heic', null]);
  await desktop.stop();
});

test('after a restart, the last restore is re-sent instead of the last photo', async () => {
  const { desktop, requests } = await make({ FAKE_HELPER_CRASH_ON: 'get' });
  await desktop.start();
  await desktop.set('/p/a.jpg');
  await desktop.restore(['/a.heic']);
  await assert.rejects(desktop.get());
  await waitFor(async () => (await requests()).filter((r) => r.cmd === 'restore').length === 2);
  const cmds = (await requests()).map((r) => r.cmd);
  assert.deepEqual(cmds, ['show', 'restore', 'get', 'restore']);
  await desktop.stop();
});
