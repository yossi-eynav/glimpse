import type { AppState } from '../persistence/app-state.ts';
import type { Notice } from './menu-model.ts';

/** The single highest-priority notice for the top of the menu (contracts/menu-ui.md, FR-004). */
export function currentNotice(input: { state: AppState; isOnline: boolean; lowDisk: boolean }): Notice | null {
  const { state } = input;
  const count = (status: 'pending' | 'unavailable') => state.selection.photos.filter((p) => p.status === status).length;

  if (state.account.status === 'needsReauth') return { text: 'Sign in again to change your photos', action: 'signIn' };
  if (input.lowDisk) return { text: "Low disk space — new photos aren't being saved", action: null };
  const pending = count('pending');
  if (!input.isOnline && pending > 0) return { text: `Offline — ${pending} photos waiting to download`, action: null };
  const unavailable = count('unavailable');
  if (unavailable > 0) return { text: `${unavailable} photos unavailable`, action: 'chooseImages' };
  return null;
}
