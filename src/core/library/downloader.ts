import type { GoogleClient } from '../auth/google-client.ts';
import type { PhotoStatus } from '../persistence/app-state.ts';
import type { FileSystem } from '../persistence/fs.ts';
import { createPhotoStore } from './photo-store.ts';

export type DownloadItem = { id: string; baseUrl: string };
export type DownloadUpdate = { id: string; status: PhotoStatus };

export type Downloader = ReturnType<typeof createDownloader>;

/** Saves each picked photo at wallpaper size plus a 256 px square thumbnail (research R1). */
export function createDownloader(deps: {
  google: GoogleClient;
  fs: FileSystem;
  dir: string;
  concurrency?: number;
  minFreeBytes?: number;
}) {
  const store = createPhotoStore({ fs: deps.fs, dir: deps.dir });
  const concurrency = deps.concurrency ?? 4;
  const minFreeBytes = deps.minFreeBytes ?? 1_000_000_000;

  const fetchBytes = async (url: string): Promise<Uint8Array> =>
    new Uint8Array((await deps.google.request<ArrayBuffer>({ url, responseType: 'arraybuffer' })).data);

  const downloadOne = async (item: DownloadItem, size: { width: number; height: number }): Promise<PhotoStatus> => {
    try {
      const photo = await fetchBytes(`${item.baseUrl}=w${size.width}-h${size.height}`);
      const thumb = await fetchBytes(`${item.baseUrl}=w256-h256-c`);
      await deps.fs.writeAtomic(store.photoPath(item.id), photo);
      await deps.fs.writeAtomic(store.thumbPath(item.id), thumb);
      return 'saved';
    } catch (e) {
      // No HTTP response means the network is down: keep it pending and retry later.
      return (e as { response?: unknown }).response ? 'unavailable' : 'pending';
    }
  };

  return {
    async downloadAll(
      items: DownloadItem[],
      size: { width: number; height: number },
      events: { onUpdate(u: DownloadUpdate): void; onLowDisk(): void },
    ): Promise<void> {
      const queue = [...items];
      let lowDisk = false;
      const worker = async () => {
        while (queue.length > 0 && !lowDisk) {
          if ((await deps.fs.freeBytes(deps.dir)) < minFreeBytes) {
            if (!lowDisk) {
              lowDisk = true;
              events.onLowDisk();
            }
            return;
          }
          const item = queue.shift();
          if (!item) return;
          events.onUpdate({ id: item.id, status: await downloadOne(item, size) });
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    },
  };
}
