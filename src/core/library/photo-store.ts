import { join } from 'node:path';
import type { FileSystem } from '../persistence/fs.ts';

export type PhotoStore = ReturnType<typeof createPhotoStore>;

/** Locations of saved wallpaper copies and thumbnails under the app's data folder. */
export function createPhotoStore(deps: { fs: FileSystem; dir: string }) {
  const photosDir = join(deps.dir, 'Photos');
  const thumbsDir = join(deps.dir, 'Thumbs');
  const photoPath = (id: string) => join(photosDir, `${id}.jpg`);
  const thumbPath = (id: string) => join(thumbsDir, `${id}.jpg`);

  return {
    photosDir,
    thumbsDir,
    photoPath,
    thumbPath,

    async deletePhotos(ids: Iterable<string>): Promise<void> {
      for (const id of ids) {
        await deps.fs.remove(photoPath(id));
        await deps.fs.remove(thumbPath(id));
      }
    },

    async deleteAll(): Promise<void> {
      await deps.fs.remove(photosDir);
      await deps.fs.remove(thumbsDir);
    },

    /** True when the saved copy exists and starts with the JPEG marker FF D8 FF. */
    async isValidJpeg(id: string): Promise<boolean> {
      try {
        const b = await deps.fs.read(photoPath(id));
        return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
      } catch {
        return false;
      }
    },
  };
}
