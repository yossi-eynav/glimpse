import { join } from 'node:path';
import type { FileSystem } from '../persistence/fs.ts';
import type { Clock } from '../rotation/clock.ts';

/** The screensaver runs inside Apple's sandboxed host and can read this folder (research R6). */
export function defaultHandoffDir(home: string): string {
  return join(
    home,
    'Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper',
  );
}

export type Handoff = {
  publish(photoPath: string, photoId: string): Promise<void>;
  disable(): Promise<void>;
};

/** Writes the app → screensaver handoff (contracts/screensaver-handoff.md). */
export function createHandoffWriter(deps: { fs: FileSystem; dir: string; clock: Clock }): Handoff {
  const writeManifest = (photoId: string | null, enabled: boolean) =>
    deps.fs.writeAtomic(
      join(deps.dir, 'manifest.json'),
      JSON.stringify({ version: 1, photoId, updatedAt: new Date(deps.clock.now()).toISOString(), enabled }),
    );

  return {
    async publish(photoPath, photoId) {
      // Image first, manifest second: the saver reloads only when photoId changes.
      await deps.fs.writeAtomic(join(deps.dir, 'current.jpg'), await deps.fs.read(photoPath));
      await writeManifest(photoId, true);
    },
    async disable() {
      // Manifest first so the screensaver stops reading the image, then delete our copy of it.
      await writeManifest(null, false);
      await deps.fs.remove(join(deps.dir, 'current.jpg'));
    },
  };
}
