import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NeedsReauth } from '../../../src/core/auth/google-client.ts';
import type { DownloadItem, DownloadUpdate } from '../../../src/core/library/downloader.ts';
import { createSelectionSession, type PickerLike } from '../../../src/core/library/selection-session.ts';
import type { PickedMediaItem } from '../../../src/core/picker/models.ts';
import { sampleJpeg, fixture } from '../../support/fixtures.ts';
import { makeEngine } from '../../support/engine.ts';
import { signedInState } from '../../support/state.ts';

const items = (): PickedMediaItem[] => [...fixture('picker_media_page1.json').mediaItems, ...fixture('picker_media_page2.json').mediaItems];

const setup = async (opts: { wait?: PickerLike['waitUntilPicked']; list?: () => Promise<PickedMediaItem[]>; createSession?: PickerLike['createSession'] } = {}) => {
  const ctx = await makeEngine(signedInState(['a', 'b']));
  const statusCalls: [string, string][] = [];
  const committed: { addedIds: string[] }[] = [];
  const engine = {
    ...ctx.engine,
    photoStatusChanged: (id: string, status: Parameters<typeof ctx.engine.photoStatusChanged>[1]) => {
      statusCalls.push([id, status]);
      return ctx.engine.photoStatusChanged(id, status);
    },
  };
  const log: string[] = [];
  const downloads: DownloadItem[][] = [];
  const pendingUpdates: ((u: DownloadUpdate) => void)[] = [];
  const picker: PickerLike = {
    createSession: opts.createSession ?? (async () => fixture('picker_create_session.json')),
    open: async () => void log.push('open'),
    waitUntilPicked: opts.wait ?? (async () => 'picked'),
    listMediaItems: opts.list ?? (async () => items()),
    deleteSession: async (id) => void log.push(`delete:${id}`),
  };
  const views: unknown[] = [];
  const session = createSelectionSession({
    engine,
    picker,
    downloader: {
      downloadAll: async (list, _size, events) => {
        downloads.push(list);
        pendingUpdates.push(events.onUpdate);
      },
    },
    photos: ctx.photos,
    clock: ctx.clock,
    displaySize: () => ({ width: 3024, height: 1964 }),
    onDraftChanged: (v) => views.push(v),
    onLowDisk: () => log.push('lowDisk'),
    onSelectionCommitted: async (info) => void committed.push(info),
  });
  return { ...ctx, session, log, downloads, views, statusCalls, committed, update: (u: DownloadUpdate) => pendingUpdates.forEach((f) => f(u)) };
};

test('open starts a draft from the saved selection', async () => {
  const { session } = await setup();
  assert.deepEqual(session.open(), {
    photos: [{ id: 'a', status: 'saved' }, { id: 'b', status: 'saved' }],
    skippedNonPhotoCount: 0,
  });
});

test('pick adds still photos as pending, starts downloads, and cleans up the session', async () => {
  const { session, log, downloads } = await setup();
  session.open();
  assert.deepEqual(await session.pick(), { kind: 'added', added: 4, skippedNonPhotoCount: 1 });
  assert.deepEqual(log, ['open', 'delete:sess-1']);
  assert.deepEqual(downloads[0].map((d) => d.id), ['item-1', 'item-2', 'item-4', 'item-5']);
  assert.equal(downloads[0][0].baseUrl, 'https://lh3.googleusercontent.com/pk/item-1');
  assert.equal(session.view()?.photos.filter((p) => p.status === 'pending').length, 4);
});

test('download updates reach the draft and are pushed to the window', async () => {
  const { session, views, update } = await setup();
  session.open();
  await session.pick();
  update({ id: 'item-1', status: 'saved' });
  assert.equal(session.view()?.photos.find((p) => p.id === 'item-1')?.status, 'saved');
  assert.equal(views.length, 1);
});

test('pick reports a timeout and deletes the session', async () => {
  const { session, log } = await setup({ wait: async () => 'timedOut' });
  session.open();
  assert.deepEqual(await session.pick(), { kind: 'timedOut' });
  assert.ok(log.includes('delete:sess-1'));
});

test('cancelPick aborts the wait', async () => {
  const { session } = await setup({
    wait: (_s, signal) =>
      new Promise((resolve) => {
        if (signal.aborted) resolve('cancelled');
        signal.addEventListener('abort', () => resolve('cancelled'));
      }),
  });
  session.open();
  const result = session.pick();
  session.cancelPick();
  assert.deepEqual(await result, { kind: 'cancelled' });
});

test('NeedsReauth marks the account and asks the window to sign in', async () => {
  const { session, engine } = await setup({ createSession: async () => { throw new NeedsReauth(); } });
  session.open();
  assert.deepEqual(await session.pick(), { kind: 'needsSignIn' });
  assert.equal(engine.getState().account.status, 'needsReauth');
});

test('other failures return a user-facing error message', async () => {
  const { session } = await setup({ list: async () => { throw new Error('socket hang up'); } });
  session.open();
  assert.deepEqual(await session.pick(), {
    kind: 'error',
    message: "Couldn't reach Google Photos. Check your connection and try again.",
  });
});

test('remove only accepts IDs in the draft', async () => {
  const { session } = await setup();
  session.open();
  assert.deepEqual(session.remove('a').photos.map((p) => p.id), ['b']);
  assert.throws(() => session.remove('zzz'), /not in the selection/);
});

test('commit saves the selection and deletes removed photos', async () => {
  const { session, engine, fs, photos } = await setup();
  session.open();
  session.remove('a');
  await session.commit();
  assert.deepEqual(engine.getState().selection.photos.map((p) => p.id), ['b']);
  assert.equal(await fs.exists(photos.photoPath('a')), false);
  assert.equal(await fs.exists(photos.photoPath('b')), true);
  assert.equal(session.view(), null);
});

test('downloads that finish after commit update the saved selection', async () => {
  const { session, engine, update } = await setup();
  session.open();
  await session.pick();
  await session.commit();
  update({ id: 'item-2', status: 'saved' });
  await engine.update(() => {});
  assert.equal(engine.getState().selection.photos.find((p) => p.id === 'item-2')?.status, 'saved');
});

test('discard keeps the saved selection and deletes files downloaded for the draft', async () => {
  const { session, engine, fs, photos } = await setup();
  session.open();
  await session.pick();
  await fs.writeAtomic(photos.photoPath('item-1'), sampleJpeg());
  await session.discard();
  assert.deepEqual(engine.getState().selection.photos.map((p) => p.id), ['a', 'b']);
  assert.equal(await fs.exists(photos.photoPath('item-1')), false);
});

test('clearDraft empties the draft only', async () => {
  const { session, engine } = await setup();
  session.open();
  assert.deepEqual(session.clear().photos, []);
  assert.equal(engine.getState().selection.photos.length, 2);
});

test('retryPending re-downloads photos left pending while offline, while their URLs are still valid', async () => {
  const { session, downloads, clock } = await setup();
  session.open();
  await session.pick();
  await session.commit();
  clock.advance(10 * 60_000);
  await session.retryPending();
  assert.equal(downloads.length, 2);
  assert.deepEqual(downloads[1].map((d) => d.id), ['item-1', 'item-2', 'item-4', 'item-5']);
});

test('retryPending marks photos unavailable once their 60-minute URLs have expired', async () => {
  const { session, engine, downloads, clock } = await setup();
  session.open();
  await session.pick();
  await session.commit();
  clock.advance(61 * 60_000);
  await session.retryPending();
  assert.equal(downloads.length, 1);
  assert.ok(engine.getState().selection.photos.filter((p) => p.id.startsWith('item-')).every((p) => p.status === 'unavailable'));
});

test('retryPending skips photos that already finished', async () => {
  const { session, downloads, update } = await setup();
  session.open();
  await session.pick();
  for (const id of ['item-1', 'item-2', 'item-4', 'item-5']) update({ id, status: 'saved' });
  await session.retryPending();
  assert.equal(downloads.length, 1);
});

test('retryPending does nothing while a download batch is still running', async () => {
  const ctx = await makeEngine(signedInState([]));
  let release: () => void = () => {};
  let batches = 0;
  const session = createSelectionSession({
    engine: ctx.engine,
    picker: {
      createSession: async () => fixture('picker_create_session.json'),
      open: async () => {},
      waitUntilPicked: async () => 'picked',
      listMediaItems: async () => items(),
      deleteSession: async () => {},
    },
    downloader: {
      downloadAll: () => {
        batches++;
        return new Promise<void>((r) => (release = r));
      },
    },
    photos: ctx.photos,
    clock: ctx.clock,
    displaySize: () => ({ width: 1, height: 1 }),
    onDraftChanged: () => {},
    onLowDisk: () => {},
  });
  session.open();
  await session.pick();
  await session.retryPending();
  assert.equal(batches, 1);
  release();
  await new Promise((r) => setImmediate(r));
  await session.retryPending();
  assert.equal(batches, 2);
});

// --- Specific, logged picker errors (FR-025) ---

const httpError = (status: number, reason: string, message: string) =>
  Object.assign(new Error(message), { response: { status, data: { error: { code: status, message, details: [{ reason }] } } } });

test('a disabled Picker API returns a specific message and is logged with the details', async () => {
  const logged: { level: string; message: string; fields?: Record<string, unknown> }[] = [];
  const ctx = await makeEngine(signedInState([]));
  const session = createSelectionSession({
    engine: ctx.engine,
    picker: {
      createSession: async () => { throw httpError(403, 'SERVICE_DISABLED', 'Photos Picker API has not been used in project 123'); },
      open: async () => {},
      waitUntilPicked: async () => 'picked',
      listMediaItems: async () => [],
      deleteSession: async () => {},
    },
    downloader: { downloadAll: async () => {} },
    photos: ctx.photos,
    clock: ctx.clock,
    displaySize: () => ({ width: 1, height: 1 }),
    onDraftChanged: () => {},
    onLowDisk: () => {},
    log: (level, message, fields) => void logged.push({ level, message, fields }),
  });
  session.open();
  const result = await session.pick();
  assert.equal(result.kind, 'error');
  assert.match(result.kind === 'error' ? result.message : '', /Picker API isn't enabled/);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].level, 'error');
  assert.equal(logged[0].fields?.status, 403);
  assert.match(String(logged[0].fields?.detail), /has not been used in project 123/);
});

test('missing Photos access marks the account for sign-in', async () => {
  const ctx = await makeEngine(signedInState([]));
  const session = createSelectionSession({
    engine: ctx.engine,
    picker: {
      createSession: async () => { throw httpError(403, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'Request had insufficient authentication scopes.'); },
      open: async () => {},
      waitUntilPicked: async () => 'picked',
      listMediaItems: async () => [],
      deleteSession: async () => {},
    },
    downloader: { downloadAll: async () => {} },
    photos: ctx.photos,
    clock: ctx.clock,
    displaySize: () => ({ width: 1, height: 1 }),
    onDraftChanged: () => {},
    onLowDisk: () => {},
    log: () => {},
  });
  session.open();
  const result = await session.pick();
  assert.match(result.kind === 'error' ? result.message : '', /access was not granted/);
  assert.equal(ctx.engine.getState().account.status, 'needsReauth');
});

// --- Feature 004: Done applies new photos ---

test('commit tells the app which photos were added', async () => {
  const { session, committed } = await setup();
  session.open();
  await session.pick();
  await session.commit();
  assert.deepEqual(committed, [{ addedIds: ['item-1', 'item-2', 'item-4', 'item-5'] }]);
});

test('download updates are passed to the engine', async () => {
  const { session, statusCalls, update } = await setup();
  session.open();
  await session.pick();
  update({ id: 'item-1', status: 'saved' });
  assert.deepEqual(statusCalls, [['item-1', 'saved']]);
});
