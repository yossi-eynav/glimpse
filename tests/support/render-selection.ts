import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DraftView } from '../../src/shared/ipc-types.ts';

export type RenderProps = {
  draft: DraftView;
  picking?: boolean;
  message?: { severity: 'success' | 'info' | 'warning' | 'error'; text: string } | null;
  dark?: boolean;
};

let entry: Promise<{ render(props: RenderProps): string }> | null = null;

/** Bundles tests/support/render-entry.tsx once with esbuild, then renders SelectionView to HTML. */
export async function renderSelection(props: RenderProps): Promise<string> {
  entry ??= (async () => {
    const outfile = join(tmpdir(), `pw-render-${process.pid}.mjs`);
    await build({
      entryPoints: ['tests/support/render-entry.tsx'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      jsx: 'automatic',
      outfile,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"production"' },
      // react-dom/server's CommonJS build requires Node built-ins; give the ESM bundle a require().
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    });
    return import(pathToFileURL(outfile).href);
  })();
  return (await entry).render(props);
}
