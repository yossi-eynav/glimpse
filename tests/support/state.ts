import { defaultState, type AppState, type SelectedPhoto } from '../../src/core/persistence/app-state.ts';

export const photo = (id: string, status: SelectedPhoto['status'] = 'saved'): SelectedPhoto => ({
  id,
  createdAt: null,
  width: 4000,
  height: 3000,
  status,
  addedAt: 0,
});

export function signedInState(ids: string[] = [], patch: (s: AppState) => void = () => {}): AppState {
  const s = defaultState();
  s.account = { status: 'signedIn', email: 'test@example.com' };
  s.selection.photos = ids.map((id) => photo(id));
  patch(s);
  return s;
}

/** Deterministic PRNG (mulberry32) returning values in [0, 1). */
export function seededRandom(seed = 42): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
