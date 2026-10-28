import { createPhotoStore } from '../../src/core/library/photo-store.ts';
import type { AppState } from '../../src/core/persistence/app-state.ts';
import { MemoryFileSystem } from '../../src/core/persistence/fs.ts';
import { ManualClock } from '../../src/core/rotation/clock.ts';
import { createRotationEngine } from '../../src/core/rotation/engine.ts';
import { FakeDesktop } from '../../src/core/wallpaper/desktop.ts';
import { sampleJpeg } from './fixtures.ts';
import { seededRandom } from './state.ts';

export async function makeEngine(state: AppState, extra: Partial<Parameters<typeof createRotationEngine>[0]> = {}) {
  const fs = new MemoryFileSystem();
  const photos = createPhotoStore({ fs, dir: '/data' });
  for (const p of state.selection.photos) await fs.writeAtomic(photos.photoPath(p.id), sampleJpeg());
  const clock = new ManualClock(Date.UTC(2026, 9, 27, 10, 0));
  const desktop = new FakeDesktop();
  const saved: AppState[] = [];
  const engine = createRotationEngine({
    state,
    clock,
    desktop,
    photos,
    random: seededRandom(7),
    save: async (s) => void saved.push(structuredClone(s)),
    ...extra,
  });
  return { engine, fs, photos, clock, desktop, saved };
}

export const MIN = 60_000;
