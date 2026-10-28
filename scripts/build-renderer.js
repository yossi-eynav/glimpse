// Bundles the selection window (React + MUI) into one ES module for the sandboxed renderer.
// Sandboxed renderers can't resolve bare imports like `react`, so tsc doesn't emit this code.
import { build } from 'esbuild';

const production = process.env.NODE_ENV === 'production';

await build({
  entryPoints: ['src/renderer/selection/main.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome140',
  outfile: 'dist/renderer/selection/selection.js',
  minify: true,
  sourcemap: production ? false : 'linked',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') },
  logLevel: 'warning',
});
