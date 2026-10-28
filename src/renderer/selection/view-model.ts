// Pure text and state for the selection window (specs/003-selection-dialog-redesign/data-model.md).
// No React here, so node:test can cover it directly.

import type { DraftPhotoView, DraftView, PickResult } from '../../shared/ipc-types.ts';

export type TileModel = {
  id: string;
  state: 'ready' | 'loading' | 'unavailable';
  thumbUrl: string | null;
  label: string;
};

export type PickMessage = { severity: 'success' | 'info' | 'warning' | 'error'; text: string };

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function headerTitle(view: DraftView): string {
  return view.photos.length === 0 ? 'No photos yet' : plural(view.photos.length, 'photo', 'photos');
}

const UNAVAILABLE = 'This photo is unavailable. Remove it, or pick it again.';

export function tileModel(photo: DraftPhotoView): TileModel {
  const thumbUrl = `photo://thumb/${encodeURIComponent(photo.id)}`;
  switch (photo.status) {
    case 'saved':
      return { id: photo.id, state: 'ready', thumbUrl, label: 'Photo' };
    case 'pending':
      return { id: photo.id, state: 'loading', thumbUrl: null, label: 'Downloading…' };
    case 'unavailable':
      return { id: photo.id, state: 'unavailable', thumbUrl, label: UNAVAILABLE };
  }
}

/** The one transient message shown after a pick, or null for none. */
export function pickMessage(result: PickResult): PickMessage | null {
  switch (result.kind) {
    case 'added': {
      // Videos are never added (feature 001 FR-009); say so once, here, and nowhere else.
      const skipped = result.skippedNonPhotoCount;
      if (result.added === 0) {
        if (skipped === 0) return null;
        const ignored = skipped === 1 ? '1 video was ignored' : `${skipped} videos were ignored`;
        return { severity: 'info', text: `Only photos can be wallpapers. ${ignored}.` };
      }
      const added = `Added ${plural(result.added, 'photo', 'photos')}`;
      if (skipped === 0) return { severity: 'success', text: added };
      return { severity: 'success', text: `${added} · ${plural(skipped, 'video', 'videos')} ignored (only photos can be wallpapers)` };
    }
    case 'cancelled':
      return null;
    case 'timedOut':
      return { severity: 'warning', text: 'The Google Photos picker timed out. Try again.' };
    case 'needsSignIn':
      return { severity: 'warning', text: 'Your Google sign-in expired. Choose "Sign in again" in the menu bar, then try again.' };
    case 'error':
      return { severity: 'error', text: result.message };
  }
}
