import type { DraftView } from '../../shared/ipc-types.ts';
import type { PhotoStatus, SelectedPhoto, Selection } from '../persistence/app-state.ts';
import type { Clock } from '../rotation/clock.ts';

export type PickedPhoto = Pick<SelectedPhoto, 'id' | 'createdAt' | 'width' | 'height'>;

/** An editable copy of the selection for the selection dialog (FR-008). */
export class SelectionDraft {
  photos: SelectedPhoto[];
  skippedNonPhotoCount: number;
  readonly #originalIds: Set<string>;
  readonly #addedIds = new Set<string>();
  readonly #clock: Clock;

  private constructor(selection: Selection, clock: Clock) {
    this.photos = selection.photos.map((p) => ({ ...p }));
    this.skippedNonPhotoCount = selection.skippedNonPhotoCount;
    this.#originalIds = new Set(selection.photos.map((p) => p.id));
    this.#clock = clock;
  }

  static from(selection: Selection, clock: Clock): SelectionDraft {
    return new SelectionDraft(selection, clock);
  }

  has(id: string): boolean {
    return this.photos.some((p) => p.id === id);
  }

  /** Adds new photos as pending; returns the IDs that were actually added. */
  addPicked(picked: PickedPhoto[], skippedNonPhotoCount: number): string[] {
    this.skippedNonPhotoCount = skippedNonPhotoCount;
    const added: string[] = [];
    for (const p of picked) {
      if (this.has(p.id)) continue;
      this.photos.push({ ...p, status: 'pending', addedAt: this.#clock.now() });
      this.#addedIds.add(p.id);
      added.push(p.id);
    }
    return added;
  }

  setStatus(id: string, status: PhotoStatus): void {
    const photo = this.photos.find((p) => p.id === id);
    if (photo) photo.status = status;
  }

  remove(id: string): void {
    this.photos = this.photos.filter((p) => p.id !== id);
  }

  clear(): void {
    this.photos = [];
  }

  view(): DraftView {
    return {
      photos: this.photos.map((p) => ({ id: p.id, status: p.status })),
      skippedNonPhotoCount: this.skippedNonPhotoCount,
    };
  }

  /**
   * The new selection, every ID (original or added here) whose files must be deleted, and the
   * photos added in this draft that are still selected (shown at once on Done, feature 004).
   */
  commit(): { selection: Selection; removedIds: string[]; addedIds: string[] } {
    const kept = new Set(this.photos.map((p) => p.id));
    const removedIds = [...this.#originalIds, ...this.#addedIds].filter((id) => !kept.has(id));
    const addedIds = [...this.#addedIds].filter((id) => kept.has(id));
    return { selection: { photos: this.photos, skippedNonPhotoCount: this.skippedNonPhotoCount }, removedIds, addedIds };
  }

  /** Abandons the draft; returns the IDs added in it, whose downloaded files must be deleted. */
  discard(): string[] {
    return [...this.#addedIds];
  }
}
