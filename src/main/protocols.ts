import { net, protocol } from 'electron';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ID = /^[A-Za-z0-9_-]+$/;

/** Must run before app 'ready'. */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: 'photo', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/**
 * app://renderer/<path> serves the compiled renderer pages from rendererDir.
 * photo://thumb/<id> serves a thumbnail, only for IDs in the current selection or draft.
 */
export function handleProtocols(opts: { rendererDir: string; thumbPath(id: string): string; isKnownId(id: string): boolean }): void {
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    const file = normalize(join(opts.rendererDir, decodeURIComponent(url.pathname)));
    if (url.host !== 'renderer' || !file.startsWith(opts.rendererDir + sep)) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  protocol.handle('photo', (req) => {
    const url = new URL(req.url);
    const id = decodeURIComponent(url.pathname.slice(1));
    if (url.host !== 'thumb' || !ID.test(id) || !opts.isKnownId(id)) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(opts.thumbPath(id)).toString());
  });
}
