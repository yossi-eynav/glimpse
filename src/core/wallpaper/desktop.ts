import { join } from 'node:path';

/** Sets and reads the desktop wallpaper on every screen. */
export type Desktop = {
  set(path: string): Promise<void>;
  /** Current wallpaper path for each screen. */
  get(): Promise<string[]>;
  /** Stop re-applying the current photo (pw-helper re-applies it on Space changes). */
  clear?(): Promise<void>;
  /**
   * Puts each display's original wallpaper back where it still shows one of the app's photos,
   * and keeps doing so on Space changes. Resolves to the number of displays changed (feature 004).
   */
  restore?(paths: (string | null)[]): Promise<number>;
  /** Called when the user changes the wallpaper outside the app (FR-018). */
  onExternalChange?(listener: (paths: string[]) => void): () => void;
};

export async function applyPhoto(desktop: Desktop, photosDir: string, id: string): Promise<string> {
  const path = join(photosDir, `${id}.jpg`);
  await desktop.set(path);
  return path;
}

export class FakeDesktop implements Desktop {
  readonly calls: string[] = [];
  current: string[];
  cleared = 0;
  /** When true, the next set() rejects (simulates a helper failure). */
  failNextSet = false;

  constructor(screens = 1) {
    this.current = Array.from({ length: screens }, () => '/System/Library/Desktop Pictures/Default.heic');
  }

  async set(path: string): Promise<void> {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('helper unavailable');
    }
    this.calls.push(path);
    this.current = this.current.map(() => path);
  }

  async get(): Promise<string[]> {
    return [...this.current];
  }

  async clear(): Promise<void> {
    this.cleared++;
  }

  readonly restoreCalls: (string | null)[][] = [];

  /** Puts originals back only on screens showing one of the app's photos (contracts/wallpaper-helper-restore.md). */
  async restore(paths: (string | null)[]): Promise<number> {
    this.restoreCalls.push([...paths]);
    let restored = 0;
    this.current = this.current.map((path, i) => {
      if (!path.startsWith('/data/Photos/')) return path;
      restored++;
      return paths[i] ?? '/System/Library/CoreServices/DefaultDesktop.heic';
    });
    return restored;
  }
}
