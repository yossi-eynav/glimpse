import type { DraftView, PickResult } from '../../shared/ipc-types.ts';

/** The bridge exposed by src/preload/selection.cjs (feature 001 contracts/ipc.md). */
export type SelectionApi = {
  getDraft(): Promise<DraftView>;
  pick(): Promise<PickResult>;
  cancelPick(): Promise<void>;
  remove(id: string): Promise<DraftView>;
  clearDraft(): Promise<DraftView>;
  commit(): Promise<void>;
  discard(): Promise<void>;
  onDraftChanged(cb: (view: DraftView) => void): () => void;
};

declare global {
  interface Window {
    selection: SelectionApi;
  }
}
