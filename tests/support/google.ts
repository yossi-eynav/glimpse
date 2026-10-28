import { createGoogleClient } from '../../src/core/auth/google-client.ts';
import { createFakeFetch, type Route } from './fake-fetch.ts';

/** A real google-auth-library client wired to a fake fetch, already signed in. */
export function signedInGoogle(routes: Route[], credentials = { access_token: 'a1', refresh_token: 'r1', expiry_date: Date.now() + 3_600_000 }) {
  const fake = createFakeFetch(routes);
  const google = createGoogleClient({ clientId: 'cid', clientSecret: 'secret', fetch: fake.fetch, retryDelayMs: 1 });
  google.oauth.setCredentials(credentials);
  return { ...fake, google };
}
