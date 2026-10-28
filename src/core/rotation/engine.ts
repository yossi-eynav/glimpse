import { sep } from 'node:path';
import type { PhotoStore } from '../library/photo-store.ts';
import { consoleLog, type Log } from '../log.ts';
import type { AppState, PhotoStatus } from '../persistence/app-state.ts';
import type { Handoff } from '../screensaver/handoff.ts';
import { applyPhoto, type Desktop } from '../wallpaper/desktop.ts';
import type { Clock } from './clock.ts';
import { isValidIntervalMinutes } from './custom-interval.ts';
import { pickRandom } from './random-pick.ts';

export type RotationEngine = ReturnType<typeof createRotationEngine>;

/**
 * Owns AppState. Has no timer of its own: the app calls tick() when nextChangeAt is due,
 * and on launch and wake (research R8).
 */
export function createRotationEngine(deps: {
  state: AppState;
  clock: Clock;
  desktop: Desktop;
  photos: PhotoStore;
  random: () => number;
  save(state: AppState): Promise<void>;
  handoff?: Handoff;
  log?: Log;
}) {
  const state = deps.state;
  const log = deps.log ?? consoleLog;
  const listeners = new Set<(s: AppState) => void>();
  let queue: Promise<unknown> = Promise.resolve();
  /** Photos added at Done that were still downloading; the first one saved is shown (feature 004). */
  let pendingShow: Set<string> | null = null;

  /** Runs operations one at a time, then saves and notifies. */
  const serial = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const result = await op();
      await deps.save(state);
      for (const l of listeners) l(state);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  };

  const intervalMs = () => state.settings.intervalMinutes * 60_000;

  const schedule = () => {
    state.rotation.nextChangeAt = state.rotation.mode === 'running' ? deps.clock.now() + intervalMs() : null;
  };

  /**
   * Shows a random saved photo, from `onlyIds` when given. A photo whose saved copy is missing
   * or not a JPEG is marked unavailable and skipped in the same pass (FR-024).
   */
  const showOne = async (onlyIds: Set<string> | null): Promise<'shown' | 'none' | 'failed'> => {
    for (;;) {
      const candidates = onlyIds
        ? { photos: state.selection.photos.filter((p) => onlyIds.has(p.id)), skippedNonPhotoCount: 0 }
        : state.selection;
      const id = pickRandom(state.rotation.currentPhotoId, candidates, deps.random);
      if (!id) return 'none';
      if (!(await deps.photos.isValidJpeg(id))) {
        const photo = state.selection.photos.find((p) => p.id === id);
        if (photo) photo.status = 'unavailable';
        log('warn', 'Skipping unavailable photo', { photoId: id });
        continue;
      }
      if (state.original === null) await recordOriginals();
      let path: string;
      try {
        path = await applyPhoto(deps.desktop, deps.photos.photosDir, id);
      } catch (e) {
        // Keep the current photo; the next scheduled tick tries again.
        log('warn', 'Could not set the wallpaper', { photoId: id, error: String(e) });
        schedule();
        return 'failed';
      }
      state.rotation.currentPhotoId = id;
      schedule();
      await publishToScreensaver(path, id);
      return 'shown';
    }
  };

  /** Shows the next photo, or blocks when none is available. */
  const changePhoto = async () => {
    if ((await showOne(null)) === 'none') {
      state.rotation.mode = 'blockedNoPhotos';
      state.rotation.nextChangeAt = null;
    }
  };

  const isPending = (id: string) => state.selection.photos.some((p) => p.id === id && p.status === 'pending');

  /** Turned off, nothing may change the wallpaper or screensaver (feature 004, FR-011). */
  const isOff = () => state.power === 'off';

  /** Remembers each display's wallpaper so Turn off can put it back (feature 004, FR-006). */
  const recordOriginals = async () => {
    const ours = deps.photos.photosDir + sep;
    let wallpapers: (string | null)[] = [];
    try {
      wallpapers = (await deps.desktop.get()).map((path) => (path && !path.startsWith(ours) ? path : null));
    } catch (e) {
      log('warn', 'Could not read the current wallpaper to remember it', { error: String(e) });
    }
    state.original = { wallpapers, recordedAt: deps.clock.now() };
  };

  /** True when some screen shows a wallpaper the app didn't set (FR-018, research R5). */
  const changedOutsideApp = async (): Promise<boolean> => {
    if (!state.rotation.currentPhotoId) return false;
    const ours = deps.photos.photosDir + sep;
    try {
      return (await deps.desktop.get()).some((path) => !path.startsWith(ours));
    } catch (e) {
      log('warn', 'Could not read the current wallpaper', { error: String(e) });
      return false;
    }
  };

  const publishToScreensaver = async (path: string, id: string) => {
    if (!state.settings.useForScreensaver || !deps.handoff) return;
    try {
      await deps.handoff.publish(path, id);
    } catch (e) {
      // The wallpaper already changed; a screensaver failure must not stop rotation.
      log('warn', 'Could not update the screensaver photo', { error: String(e) });
    }
  };

  return {
    getState: (): AppState => state,

    onChange(listener: (s: AppState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Applies an arbitrary edit (sign-in, selection changes, …), then saves and notifies. */
    update: (mutate: (s: AppState) => void): Promise<void> => serial(async () => mutate(state)),

    start: () =>
      serial(async () => {
        if (isOff() || !state.selection.photos.some((p) => p.status === 'saved')) return;
        state.rotation.mode = 'running';
        await changePhoto();
      }),

    tick: () =>
      serial(async () => {
        if (isOff()) return;
        const { mode, nextChangeAt } = state.rotation;
        if (mode === 'blockedNoPhotos' && state.selection.photos.some((p) => p.status === 'saved')) {
          state.rotation.mode = 'running';
          await changePhoto();
          return;
        }
        if (mode !== 'running' || nextChangeAt === null || deps.clock.now() < nextChangeAt) return;
        if (await changedOutsideApp()) {
          state.rotation.mode = 'pausedExternalChange';
          state.rotation.nextChangeAt = null;
          return;
        }
        await changePhoto();
      }),

    setInterval: (minutes: number) =>
      serial(async () => {
        if (!isValidIntervalMinutes(minutes)) throw new RangeError(`interval must be 1..10080 minutes, got ${minutes}`);
        state.settings.intervalMinutes = minutes;
        schedule();
      }),

    pause: () =>
      serial(async () => {
        if (state.rotation.mode !== 'running') return;
        state.rotation.mode = 'paused';
        schedule();
      }),

    resume: () =>
      serial(async () => {
        if (isOff()) return;
        const { mode } = state.rotation;
        if (mode !== 'paused' && mode !== 'pausedExternalChange') return;
        state.rotation.mode = 'running';
        schedule();
      }),

    /** Shows another photo now, keeps the current mode, and restarts the interval (FR-016). */
    next: () =>
      serial(async () => {
        if (isOff()) return;
        const mode = state.rotation.mode;
        await changePhoto();
        if (state.rotation.mode === 'blockedNoPhotos') return;
        state.rotation.mode = mode;
        schedule();
      }),

    /** The user set a wallpaper outside the app (FR-018): pause without touching it. */
    externalChange: () =>
      serial(async () => {
        if (state.rotation.mode !== 'running') return;
        state.rotation.mode = 'pausedExternalChange';
        state.rotation.nextChangeAt = null;
      }),

    stop: () =>
      serial(async () => {
        state.rotation = { mode: 'stopped', currentPhotoId: null, nextChangeAt: null };
        await deps.desktop.clear?.();
      }),

    /**
     * Call after the selection was replaced. Forgets the current photo if it was removed, and
     * shows one of `addedIds` at once, running the rotation (feature 004, FR-001 to FR-005).
     */
    selectionChanged: (opts: { addedIds?: string[] } = {}) =>
      serial(async () => {
        const ids = new Set(state.selection.photos.map((p) => p.id));
        if (state.rotation.currentPhotoId && !ids.has(state.rotation.currentPhotoId)) state.rotation.currentPhotoId = null;

        const added = (opts.addedIds ?? []).filter((id) => ids.has(id));
        if (added.length === 0 || isOff()) return;
        pendingShow = null;
        state.rotation.mode = 'running';
        if ((await showOne(new Set(added))) !== 'none') return;
        if (added.some(isPending)) {
          pendingShow = new Set(added);
          if (state.rotation.nextChangeAt === null) schedule();
        } else if (state.rotation.currentPhotoId === null) {
          await changePhoto();
        } else if (state.rotation.nextChangeAt === null) {
          schedule();
        }
      }),

    /** A download finished (or failed): record it, and show it if Done was waiting for it. */
    photoStatusChanged: (id: string, status: PhotoStatus) =>
      serial(async () => {
        const photo = state.selection.photos.find((p) => p.id === id);
        if (photo) photo.status = status;
        if (!pendingShow || isOff()) return;
        if (pendingShow.has(id) && status === 'saved' && (await showOne(new Set([id]))) === 'shown') {
          pendingShow = null;
          return;
        }
        if ([...pendingShow].some(isPending)) return;
        // None of the added photos made it: carry on as a normal rotation.
        pendingShow = null;
        if (state.rotation.currentPhotoId === null && state.rotation.mode === 'running') await changePhoto();
      }),

    /** On launch: one catch-up change if overdue, otherwise re-apply the current photo. */
    restore: () =>
      serial(async () => {
        if (isOff()) return;
        const { mode, nextChangeAt, currentPhotoId } = state.rotation;
        if (mode !== 'running') return;
        if (nextChangeAt === null || deps.clock.now() >= nextChangeAt || !currentPhotoId) await changePhoto();
        else await applyPhoto(deps.desktop, deps.photos.photosDir, currentPhotoId);
      }),

    /**
     * Stops the app affecting the Mac: rotation stops, original wallpapers go back on displays
     * still showing our photos, and the screensaver stops showing them. Setup is kept (FR-008–FR-010).
     */
    turnOff: () =>
      serial(async () => {
        pendingShow = null;
        state.rotation = { mode: 'stopped', currentPhotoId: null, nextChangeAt: null };
        try {
          await deps.desktop.restore?.(state.original?.wallpapers ?? []);
        } catch (e) {
          log('warn', 'Could not restore the original wallpaper', { error: String(e) });
        }
        if (state.settings.useForScreensaver) {
          try {
            await deps.handoff?.disable();
          } catch (e) {
            log('warn', 'Could not turn off the screensaver photo', { error: String(e) });
          }
        }
        state.power = 'off';
      }),

    /** Records the current wallpaper as the new original, then shows a photo and runs (FR-014). */
    turnOn: () =>
      serial(async () => {
        state.power = 'on';
        await recordOriginals();
        if (!state.selection.photos.some((p) => p.status === 'saved')) return;
        state.rotation.mode = 'running';
        await changePhoto();
      }),

    setUseForScreensaver: (on: boolean) =>
      serial(async () => {
        state.settings.useForScreensaver = on;
        const id = state.rotation.currentPhotoId;
        if (on && id) await publishToScreensaver(deps.photos.photoPath(id), id);
        if (!on) await deps.handoff?.disable();
      }),

    displaysChanged: () =>
      serial(async () => {
        if (isOff()) return;
        if (state.rotation.currentPhotoId) await applyPhoto(deps.desktop, deps.photos.photosDir, state.rotation.currentPhotoId);
      }),
  };
}
