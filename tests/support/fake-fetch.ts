export type RecordedCall = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
};

export type Route = {
  method: string;
  url: string | RegExp;
  respond: (req: RecordedCall) => Response | Promise<Response>;
  /** Remove the route after it has answered once. */
  once?: boolean;
};

export function createFakeFetch(routes: Route[]) {
  const remaining = [...routes];
  const calls: RecordedCall[] = [];

  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const call: RecordedCall = {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers),
      body: req.body ? await req.text() : '',
    };
    calls.push(call);
    const index = remaining.findIndex(
      (r) =>
        r.method === call.method &&
        (typeof r.url === 'string' ? call.url === r.url : r.url.test(call.url)),
    );
    if (index === -1) throw new Error(`unexpected request ${call.method} ${call.url}`);
    const route = remaining[index];
    if (route.once) remaining.splice(index, 1);
    return route.respond(call);
  };

  return { fetch, calls };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function bytesResponse(status: number, bytes: Uint8Array<ArrayBuffer>): Response {
  return new Response(bytes, { status, headers: { 'content-type': 'image/jpeg' } });
}
