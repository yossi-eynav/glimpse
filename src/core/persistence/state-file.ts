import { join } from 'node:path';
import { defaultState, type AppState } from './app-state.ts';
import type { FileSystem } from './fs.ts';

const FILE = 'state.json';

export async function loadState(fs: FileSystem, dir: string): Promise<AppState> {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(await fs.read(join(dir, FILE)))) as Partial<AppState>;
    const d = defaultState();
    return {
      account: { ...d.account, ...parsed.account },
      selection: { ...d.selection, ...parsed.selection },
      settings: { ...d.settings, ...parsed.settings },
      // Known keys only, so a shownThisRound saved by feature 001 is dropped.
      rotation: {
        mode: parsed.rotation?.mode ?? d.rotation.mode,
        currentPhotoId: parsed.rotation?.currentPhotoId ?? d.rotation.currentPhotoId,
        nextChangeAt: parsed.rotation?.nextChangeAt ?? d.rotation.nextChangeAt,
      },
      // Files from before feature 004 have neither field.
      power: parsed.power === 'off' ? 'off' : 'on',
      original: parsed.original ?? null,
    };
  } catch {
    return defaultState();
  }
}

export async function saveState(fs: FileSystem, dir: string, state: AppState): Promise<void> {
  await fs.writeAtomic(join(dir, FILE), JSON.stringify(state, null, 2));
}
