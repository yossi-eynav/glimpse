import { gaxios, OAuth2Client } from 'google-auth-library';

// Use the gaxios build google-auth-library itself loads (CJS), not a second ESM copy.
type GaxiosOptions = gaxios.GaxiosOptions;
type GaxiosResponse<T> = gaxios.GaxiosResponse<T>;

export type GoogleClient = {
  oauth: OAuth2Client;
  /** An authorized request with the app's retry policy (research R11). */
  request<T>(opts: GaxiosOptions): Promise<GaxiosResponse<T>>;
};

export function googleRetryConfig(retryDelayMs: number): gaxios.RetryConfig {
  return {
    retry: 4,
    retryDelay: retryDelayMs,
    retryDelayMultiplier: 2,
    statusCodesToRetry: [[429, 429], [500, 599]],
    httpMethodsToRetry: ['GET', 'POST', 'DELETE'],
  };
}

export function createGoogleClient(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  fetch: typeof fetch;
  retryDelayMs?: number;
}): GoogleClient {
  const oauth = new OAuth2Client({
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    redirectUri: opts.redirectUri,
    eagerRefreshThresholdMillis: 60_000,
    // Stored tokens always carry expiry_date; without this, a 401 is never retried after refresh.
    forceRefreshOnFailure: true,
    transporter: new gaxios.Gaxios({ fetchImplementation: opts.fetch }),
  });
  const retryConfig = googleRetryConfig(opts.retryDelayMs ?? 1000);
  return {
    oauth,
    request: async <T>(o: GaxiosOptions) => {
      try {
        return await oauth.request<T>({ ...o, retryConfig: { ...retryConfig, ...o.retryConfig } });
      } catch (e) {
        throw isInvalidGrant(e) ? new NeedsReauth(e) : e;
      }
    },
  };
}

/** The stored refresh token no longer works; the user must sign in again. */
export class NeedsReauth extends Error {
  constructor(cause?: unknown) {
    super('Google sign-in has expired or was revoked', { cause });
    this.name = 'NeedsReauth';
  }
}

export function isInvalidGrant(e: unknown): boolean {
  const data = (e as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  return data?.error === 'invalid_grant';
}
