import type { Selection } from '../persistence/app-state.ts';

/**
 * Picks the next photo uniformly at random from the saved photos, never the one on screen
 * when there are 2 or more. No rounds, no history (feature 002, FR-001 to FR-005).
 */
export function pickRandom(currentId: string | null, selection: Selection, random: () => number): string | null {
  const saved = selection.photos.filter((p) => p.status === 'saved').map((p) => p.id);
  const candidates = saved.length >= 2 ? saved.filter((id) => id !== currentId) : saved;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)];
}
