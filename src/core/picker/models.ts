// Google Photos Picker API shapes used by the app (contracts/google-photos-picker.md).

export type PollingConfig = {
  pollInterval?: string;
  timeoutIn?: string;
};

export type PickerSession = {
  id: string;
  pickerUri: string;
  pollingConfig?: PollingConfig;
  expireTime?: string;
  mediaItemsSet?: boolean;
};

export type MediaFile = {
  baseUrl: string;
  mimeType: string;
  filename?: string;
  mediaFileMetadata?: { width?: number; height?: number };
};

export type PickedMediaItem = {
  id: string;
  createTime?: string;
  type: 'PHOTO' | 'VIDEO' | 'TYPE_UNSPECIFIED';
  mediaFile: MediaFile;
};

/** Keeps still images only (FR-009). */
export function filterStillPhotos(items: PickedMediaItem[]): { photos: PickedMediaItem[]; skipped: number } {
  const photos = items.filter((i) => i.type === 'PHOTO' && i.mediaFile?.mimeType?.startsWith('image/'));
  return { photos, skipped: items.length - photos.length };
}

/** Converts a protobuf Duration string such as "5s" or "0.5s" to milliseconds. */
export function parseDuration(d: string | undefined): number | null {
  const m = d?.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(Number(m[1]) * 1000) : null;
}
