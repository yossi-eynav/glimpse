import type { DraftView, PickResult } from '../../shared/ipc-types.ts';
import { NeedsReauth } from '../auth/google-client.ts';
import { consoleLog, type Log } from '../log.ts';
import { describePickerError } from '../picker/errors.ts';
import { filterStillPhotos } from '../picker/models.ts';
import type { PickerClient } from '../picker/picker-client.ts';
import type { RotationEngine } from '../rotation/engine.ts';
import type { Clock } from '../rotation/clock.ts';
import type { DownloadItem, Downloader, DownloadUpdate } from './downloader.ts';
import type { PhotoStore } from './photo-store.ts';
import { SelectionDraft } from './selection-draft.ts';

export type PickerLike = Pick<PickerClient, 'createSession' | 'open' | 'waitUntilPicked' | 'listMediaItems' | 'deleteSession'>;

/** Picker baseUrls last 60 minutes; stop retrying a little before that. */
const URL_LIFETIME_MS = 55 * 60_000;

/** Backs the selection dialog: one draft at a time, edited through IPC (contracts/ipc.md). */
export function createSelectionSession(deps: {
  engine: Pick<RotationEngine, 'getState' | 'update' | 'photoStatusChanged'>;
  picker: PickerLike;
  downloader: Pick<Downloader, 'downloadAll'>;
  photos: PhotoStore;
  clock: Clock;
  displaySize(): { width: number; height: number };
  onDraftChanged(view: DraftView): void;
  onLowDisk(): void;
  onSelectionCommitted?(info: { addedIds: string[] }): Promise<void>;
  log?: Log;
}) {
  const log = deps.log ?? consoleLog;
  let draft: SelectionDraft | null = null;
  let picking: AbortController | null = null;
  /** Photos still waiting to download, with the time their 60-minute baseUrl was issued. */
  const pending = new Map<string, { baseUrl: string; pickedAt: number }>();

  const requireDraft = (): SelectionDraft => {
    if (!draft) throw new Error('The selection dialog is not open');
    return draft;
  };

  let activeBatches = 0;

  const startDownloads = (items: DownloadItem[]) => {
    if (items.length === 0) return;
    activeBatches++;
    void deps.downloader
      .downloadAll(items, deps.displaySize(), { onUpdate: (u) => void applyUpdate(u), onLowDisk: deps.onLowDisk })
      .finally(() => activeBatches--);
  };

  /** Applies a finished download to the open draft and to the saved selection. */
  const applyUpdate = (u: DownloadUpdate): Promise<void> => {
    if (u.status !== 'pending') pending.delete(u.id);
    if (draft?.has(u.id)) {
      draft.setStatus(u.id, u.status);
      deps.onDraftChanged(draft.view());
    }
    return deps.engine.photoStatusChanged(u.id, u.status);
  };

  return {
    open(): DraftView {
      draft = SelectionDraft.from(deps.engine.getState().selection, deps.clock);
      return draft.view();
    },

    view: (): DraftView | null => draft?.view() ?? null,

    async pick(): Promise<PickResult> {
      const current = requireDraft();
      picking = new AbortController();
      let sessionId: string | null = null;
      try {
        const session = await deps.picker.createSession();
        sessionId = session.id;
        await deps.picker.open(session);
        const outcome = await deps.picker.waitUntilPicked(session, picking.signal);
        if (outcome === 'cancelled') {
          sessionId = null; // waitUntilPicked already deleted it
          return { kind: 'cancelled' };
        }
        if (outcome === 'timedOut') return { kind: 'timedOut' };

        const { photos, skipped } = filterStillPhotos(await deps.picker.listMediaItems(session.id));
        const addedIds = new Set(
          current.addPicked(
            photos.map((p) => ({
              id: p.id,
              createdAt: p.createTime ? Date.parse(p.createTime) : null,
              width: p.mediaFile.mediaFileMetadata?.width ?? 0,
              height: p.mediaFile.mediaFileMetadata?.height ?? 0,
            })),
            skipped,
          ),
        );
        // baseUrls expire after 60 minutes, so download right away (research R1).
        const items = photos.filter((p) => addedIds.has(p.id)).map((p) => ({ id: p.id, baseUrl: p.mediaFile.baseUrl }));
        for (const item of items) pending.set(item.id, { baseUrl: item.baseUrl, pickedAt: deps.clock.now() });
        startDownloads(items);
        return { kind: 'added', added: addedIds.size, skippedNonPhotoCount: skipped };
      } catch (e) {
        if (e instanceof NeedsReauth) {
          await deps.engine.update((s) => (s.account.status = 'needsReauth'));
          return { kind: 'needsSignIn' };
        }
        const described = describePickerError(e);
        log('error', 'Google Photos picker request failed', {
          kind: described.kind,
          status: described.status,
          detail: described.detail,
        });
        if (described.kind === 'scopeMissing') await deps.engine.update((s) => (s.account.status = 'needsReauth'));
        return { kind: 'error', message: described.message };
      } finally {
        picking = null;
        if (sessionId) await deps.picker.deleteSession(sessionId).catch(() => {});
      }
    },

    cancelPick(): void {
      picking?.abort();
    },

    /**
     * Retries downloads left pending (e.g. while offline). Once a baseUrl has expired the photo
     * can only come back by picking it again, so it becomes unavailable.
     */
    async retryPending(): Promise<void> {
      // Photos in a running batch are still pending; retrying now would download them twice.
      if (activeBatches > 0) return;
      const retry: DownloadItem[] = [];
      const expired: Promise<void>[] = [];
      for (const [id, { baseUrl, pickedAt }] of pending) {
        if (deps.clock.now() - pickedAt < URL_LIFETIME_MS) retry.push({ id, baseUrl });
        else expired.push(applyUpdate({ id, status: 'unavailable' }));
      }
      await Promise.all(expired);
      startDownloads(retry);
    },

    remove(id: string): DraftView {
      const current = requireDraft();
      if (!current.has(id)) throw new Error(`Photo ${id} is not in the selection`);
      current.remove(id);
      return current.view();
    },

    clear(): DraftView {
      const current = requireDraft();
      current.clear();
      return current.view();
    },

    async commit(): Promise<void> {
      const { selection, removedIds, addedIds } = requireDraft().commit();
      draft = null;
      await deps.engine.update((s) => {
        s.selection = selection;
      });
      await deps.photos.deletePhotos(removedIds);
      await deps.onSelectionCommitted?.({ addedIds });
    },

    async discard(): Promise<void> {
      const orphans = draft?.discard() ?? [];
      draft = null;
      for (const id of orphans) pending.delete(id);
      picking?.abort();
      await deps.photos.deletePhotos(orphans);
    },
  };
}
