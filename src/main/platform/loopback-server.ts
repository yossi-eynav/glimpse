import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export type LoopbackErrorKind = 'StateMismatch' | 'AuthDenied' | 'Timeout';

export class LoopbackError extends Error {
  readonly kind: LoopbackErrorKind;

  constructor(kind: LoopbackErrorKind, message: string) {
    super(message);
    this.name = 'LoopbackError';
    this.kind = kind;
  }
}

export type Loopback = {
  redirectUri: string;
  /** Resolves with the authorization code from the single OAuth redirect. */
  waitForCode(state: string): Promise<string>;
};

const DONE_PAGE = `<!doctype html><meta charset="utf-8"><title>Google Photos Wallpaper</title>
<body style="font:16px -apple-system,sans-serif;padding:3em;text-align:center">
<p>You can close this tab and return to Google Photos Wallpaper.</p></body>`;

/** One-shot OAuth redirect listener on 127.0.0.1 with an ephemeral port (RFC 8252). */
export async function startLoopbackServer(opts: { timeoutMs: number }): Promise<Loopback> {
  let settle: ((query: URLSearchParams) => void) | undefined;
  const query = new Promise<URLSearchParams>((resolve) => (settle = resolve));

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', connection: 'close' }).end(DONE_PAGE);
    server.close();
    server.closeAllConnections();
    settle?.(url.searchParams);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  const timer = setTimeout(() => {
    server.close();
    settle?.(new URLSearchParams({ error: 'timeout' }));
  }, opts.timeoutMs);
  timer.unref();

  return {
    redirectUri: `http://127.0.0.1:${port}`,
    async waitForCode(state) {
      const params = await query;
      clearTimeout(timer);
      const error = params.get('error');
      if (error === 'timeout') throw new LoopbackError('Timeout', 'Sign-in timed out');
      if (error) throw new LoopbackError('AuthDenied', `Sign-in was not completed: ${error}`);
      if (params.get('state') !== state) throw new LoopbackError('StateMismatch', 'Sign-in response did not match the request');
      const code = params.get('code');
      if (!code) throw new LoopbackError('AuthDenied', 'Sign-in response had no code');
      return code;
    },
  };
}
