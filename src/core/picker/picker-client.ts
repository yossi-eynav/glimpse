import type { GoogleClient } from '../auth/google-client.ts';
import type { Clock } from '../rotation/clock.ts';
import { parseDuration, type PickedMediaItem, type PickerSession } from './models.ts';

const BASE = 'https://photospicker.googleapis.com/v1';
const DEFAULT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 30 * 60_000;

export type PickerClient = ReturnType<typeof createPickerClient>;

export function createPickerClient(deps: { google: GoogleClient; clock: Clock; openExternal(url: string): Promise<void> }) {
  const { google, clock } = deps;

  const deleteSession = async (id: string): Promise<void> => {
    await google.request({ url: `${BASE}/sessions/${encodeURIComponent(id)}`, method: 'DELETE' });
  };

  return {
    async createSession(): Promise<PickerSession> {
      return (await google.request<PickerSession>({ url: `${BASE}/sessions`, method: 'POST', data: {} })).data;
    },

    async open(session: PickerSession): Promise<void> {
      await deps.openExternal(`${session.pickerUri}/autoclose`);
    },

    /** Polls until the user finishes picking, the session times out, or `signal` aborts. */
    async waitUntilPicked(session: PickerSession, signal: AbortSignal): Promise<'picked' | 'timedOut' | 'cancelled'> {
      const started = clock.now();
      let config = session.pollingConfig;
      for (;;) {
        if (signal.aborted) {
          await deleteSession(session.id).catch(() => {});
          return 'cancelled';
        }
        if (clock.now() - started >= (parseDuration(config?.timeoutIn) ?? DEFAULT_TIMEOUT_MS)) return 'timedOut';
        const current = (await google.request<PickerSession>({ url: `${BASE}/sessions/${encodeURIComponent(session.id)}` })).data;
        if (current.mediaItemsSet) return 'picked';
        // Each poll's timeoutIn is relative to the original session, so keep the first one.
        config = { ...current.pollingConfig, timeoutIn: session.pollingConfig?.timeoutIn };
        await clock.sleep(parseDuration(config.pollInterval) ?? DEFAULT_POLL_MS);
      }
    },

    async listMediaItems(sessionId: string): Promise<PickedMediaItem[]> {
      const items: PickedMediaItem[] = [];
      let pageToken: string | undefined;
      do {
        const params: Record<string, string> = { sessionId, pageSize: '100' };
        if (pageToken) params.pageToken = pageToken;
        const { data } = await google.request<{ mediaItems?: PickedMediaItem[]; nextPageToken?: string }>({
          url: `${BASE}/mediaItems`,
          params,
        });
        items.push(...(data.mediaItems ?? []));
        pageToken = data.nextPageToken;
      } while (pageToken);
      return items;
    },

    deleteSession,
  };
}
