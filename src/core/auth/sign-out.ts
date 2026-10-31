import type { PhotoStore } from '../library/photo-store.ts';
import type { RotationEngine } from '../rotation/engine.ts';
import type { GoogleClient } from './google-client.ts';
import type { TokenStore } from './token-store.ts';

/**
 * Stops rotation, deletes every local copy and the tokens, and revokes access (best effort).
 */
export async function signOut(deps: {
  engine: Pick<RotationEngine, 'update' | 'stop'>;
  google: GoogleClient;
  tokenStore: TokenStore;
  photos: PhotoStore;
}): Promise<void> {
  const { engine, google, tokenStore, photos } = deps;
  const tokens = (await tokenStore.load()) ?? google.oauth.credentials;

  await engine.stop();
  await engine.update((s) => {
    s.account = { status: 'signedOut', email: null };
    s.selection = { photos: [], skippedNonPhotoCount: 0 };
  });
  await photos.deleteAll();
  await tokenStore.clear();
  google.oauth.setCredentials({});

  const token = tokens.refresh_token ?? tokens.access_token;
  if (token) await google.oauth.revokeToken(token).catch(() => {});
}
