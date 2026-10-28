// Types and channel names shared by the main process, preloads and renderers (contracts/ipc.md).

export type DraftPhotoView = { id: string; status: 'pending' | 'saved' | 'unavailable' };

export type DraftView = {
  photos: DraftPhotoView[];
  skippedNonPhotoCount: number;
};

export type PickResult =
  | { kind: 'added'; added: number; skippedNonPhotoCount: number }
  | { kind: 'cancelled' }
  | { kind: 'timedOut' }
  | { kind: 'needsSignIn' }
  | { kind: 'error'; message: string };

export type IntervalUnit = 'minutes' | 'hours' | 'days';

export type IntervalSubmitResult = { ok: true } | { ok: false; hint: string };

export const Channels = {
  getDraft: 'selection:getDraft',
  pick: 'selection:pick',
  cancelPick: 'selection:cancelPick',
  remove: 'selection:remove',
  clear: 'selection:clear',
  commit: 'selection:commit',
  discard: 'selection:discard',
  draftChanged: 'selection:draftChanged',
  intervalGetCurrent: 'interval:getCurrent',
  intervalSubmit: 'interval:submit',
  intervalCancel: 'interval:cancel',
} as const;
