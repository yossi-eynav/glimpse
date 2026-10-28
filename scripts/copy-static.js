// Copies renderer HTML/CSS and the CommonJS preload scripts into dist/.
// Sandboxed preloads must be CommonJS, so they are plain .cjs files rather than TypeScript.
import { cp, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const copies = [
  { src: 'src/renderer', out: 'dist/renderer', match: /\.(html|css)$/ },
  { src: 'src/preload', out: 'dist/preload', match: /\.cjs$/ },
];

for (const { src, out, match } of copies) {
  for (const entry of await readdir(src, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !match.test(entry.name)) continue;
    const rel = join(entry.parentPath, entry.name).slice(src.length + 1);
    await cp(join(src, rel), join(out, rel));
  }
}
