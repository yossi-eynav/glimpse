import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uninstallSaver } from '../../../src/core/screensaver/uninstall.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';

const SAVER = '/Users/me/Library/Screen Savers/PhotoWallpaperSaver.saver';

test('removes the installed screensaver bundle', async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic(`${SAVER}/Contents/Info.plist`, 'x');
  await fs.writeAtomic(`${SAVER}/Contents/MacOS/PhotoWallpaperSaver`, 'bin');
  await fs.writeAtomic('/Users/me/Library/Screen Savers/Other.saver/Contents/Info.plist', 'keep');
  await uninstallSaver({ fs, home: '/Users/me' });
  assert.equal(await fs.exists(SAVER), false);
  assert.equal(await fs.exists('/Users/me/Library/Screen Savers/Other.saver/Contents/Info.plist'), true);
});

test('does nothing when it is not installed', async () => {
  await uninstallSaver({ fs: new MemoryFileSystem(), home: '/Users/me' });
});
