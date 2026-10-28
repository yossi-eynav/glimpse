import { join } from 'node:path';
import type { FileSystem } from '../persistence/fs.ts';

/** Removes the app's screensaver from the user's screensavers (feature 004, FR-009). */
export async function uninstallSaver(deps: { fs: FileSystem; home: string }): Promise<void> {
  await deps.fs.remove(join(deps.home, 'Library', 'Screen Savers', 'PhotoWallpaperSaver.saver'));
}
