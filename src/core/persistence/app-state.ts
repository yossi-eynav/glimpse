export type AccountStatus = 'signedOut' | 'signedIn' | 'needsReauth';

export type AccountConnection = {
  status: AccountStatus;
  email: string | null;
};

export type PhotoStatus = 'pending' | 'saved' | 'unavailable';

export type SelectedPhoto = {
  /** Google Photos Picker media item ID; unique within the selection. */
  id: string;
  createdAt: number | null;
  width: number;
  height: number;
  status: PhotoStatus;
  addedAt: number;
};

export type Selection = {
  photos: SelectedPhoto[];
  skippedNonPhotoCount: number;
};

export type RotationSettings = {
  /** Integer, 1 ≤ value ≤ 10080 (7 days). */
  intervalMinutes: number;
  useForScreensaver: boolean;
  startAtLogin: boolean;
};

export type RotationMode = 'stopped' | 'running' | 'paused' | 'pausedExternalChange' | 'blockedNoPhotos';

export type RotationState = {
  mode: RotationMode;
  currentPhotoId: string | null;
  /** Epoch ms; non-null only while running. */
  nextChangeAt: number | null;
};

/** Turned off, the app leaves the wallpaper and screensaver alone (feature 004). */
export type Power = 'on' | 'off';

/** Each display's wallpaper before the app changed it; null when it was already one of ours. */
export type OriginalWallpapers = { wallpapers: (string | null)[]; recordedAt: number };

export type AppState = {
  account: AccountConnection;
  selection: Selection;
  settings: RotationSettings;
  rotation: RotationState;
  power: Power;
  original: OriginalWallpapers | null;
};

export const MIN_INTERVAL_MINUTES = 1;
export const MAX_INTERVAL_MINUTES = 10_080;

export function defaultState(): AppState {
  return {
    account: { status: 'signedOut', email: null },
    selection: { photos: [], skippedNonPhotoCount: 0 },
    settings: { intervalMinutes: 30, useForScreensaver: false, startAtLogin: false },
    rotation: { mode: 'stopped', currentPhotoId: null, nextChangeAt: null },
    power: 'on',
    original: null,
  };
}

export function availableCount(selection: Selection): number {
  return selection.photos.filter((p) => p.status === 'saved').length;
}
