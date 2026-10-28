import { randomBytes } from 'node:crypto';
import { CodeChallengeMethod } from 'google-auth-library';
import type { GoogleClient } from './google-client.ts';
import type { TokenStore } from './token-store.ts';

export const SCOPES = ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly', 'openid', 'email'];

export type SignInDeps = {
  google: GoogleClient;
  tokenStore: TokenStore;
  openExternal(url: string): Promise<void>;
  startLoopback(): Promise<{ redirectUri: string; waitForCode(state: string): Promise<string> }>;
};

/** OAuth 2.0 authorization code flow with PKCE and a loopback redirect (research R4). */
export async function signIn(deps: SignInDeps): Promise<{ status: 'signedIn'; email: string | null }> {
  const { google, tokenStore } = deps;
  const loopback = await deps.startLoopback();
  const { codeVerifier, codeChallenge } = await google.oauth.generateCodeVerifierAsync();
  const state = randomBytes(24).toString('base64url');

  await deps.openExternal(
    google.oauth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
      state,
      redirect_uri: loopback.redirectUri,
    }),
  );
  const code = await loopback.waitForCode(state);

  const { tokens } = await google.oauth.getToken({ code, codeVerifier, redirect_uri: loopback.redirectUri });
  // Google's consent screen lets the user untick individual permissions.
  if (tokens.scope && !tokens.scope.split(' ').includes(SCOPES[0])) {
    throw new Error('Google Photos access was not granted. Sign in again and tick the Google Photos permission.');
  }
  google.oauth.setCredentials(tokens);
  await tokenStore.save(tokens);
  return { status: 'signedIn', email: tokens.id_token ? decodeIdTokenEmail(tokens.id_token) : null };
}

/** Saves tokens whenever google-auth-library refreshes them. Call once per client. */
export function persistRefreshedTokens(google: GoogleClient, tokenStore: TokenStore): void {
  google.oauth.on('tokens', (tokens) => void tokenStore.merge(tokens));
}

/**
 * Reads the email claim. The token comes straight from Google's token endpoint over TLS,
 * so OIDC allows using it without verifying the signature.
 */
export function decodeIdTokenEmail(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString()) as { email?: unknown };
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}
