import { join } from 'node:path';
import type { FileSystem } from '../persistence/fs.ts';

export const SCREEN_SAVER_SETTINGS_URL = 'x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension';

/** Installs the bundled .saver for the current user and opens Screen Saver settings (FR-021). */
export async function installSaver(deps: {
  fs: FileSystem;
  bundledPath: string;
  home: string;
  openExternal(url: string): Promise<void>;
}): Promise<void> {
  if (!(await deps.fs.exists(deps.bundledPath))) throw new Error(`The bundled screensaver is missing: ${deps.bundledPath}`);
  const target = join(deps.home, 'Library', 'Screen Savers', 'PhotoWallpaperSaver.saver');
  await deps.fs.remove(target);
  await deps.fs.copy(deps.bundledPath, target);
  await deps.openExternal(SCREEN_SAVER_SETTINGS_URL);
}
