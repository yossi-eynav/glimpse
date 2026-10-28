import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installSaver, SCREEN_SAVER_SETTINGS_URL } from '../../../src/core/screensaver/installer.ts';
import { MemoryFileSystem } from '../../../src/core/persistence/fs.ts';

test('replaces any installed copy with the bundled saver and opens Screen Saver settings', async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic('/app/Resources/PhotoWallpaperSaver.saver/Contents/Info.plist', 'new');
  await fs.writeAtomic('/app/Resources/PhotoWallpaperSaver.saver/Contents/MacOS/PhotoWallpaperSaver', 'bin');
  const installed = '/Users/me/Library/Screen Savers/PhotoWallpaperSaver.saver';
  await fs.writeAtomic(`${installed}/Contents/Info.plist`, 'old');
  await fs.writeAtomic(`${installed}/Contents/Stale.txt`, 'stale');
  const opened: string[] = [];

  await installSaver({ fs, bundledPath: '/app/Resources/PhotoWallpaperSaver.saver', home: '/Users/me', openExternal: async (u) => void opened.push(u) });

  assert.equal(new TextDecoder().decode(await fs.read(`${installed}/Contents/Info.plist`)), 'new');
  assert.equal(await fs.exists(`${installed}/Contents/MacOS/PhotoWallpaperSaver`), true);
  assert.equal(await fs.exists(`${installed}/Contents/Stale.txt`), false);
  assert.deepEqual(opened, [SCREEN_SAVER_SETTINGS_URL]);
  assert.equal(SCREEN_SAVER_SETTINGS_URL, 'x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension');
});

test('fails clearly when the bundled saver is missing', async () => {
  await assert.rejects(
    installSaver({ fs: new MemoryFileSystem(), bundledPath: '/nope.saver', home: '/Users/me', openExternal: async () => {} }),
    /screensaver is missing/,
  );
});
