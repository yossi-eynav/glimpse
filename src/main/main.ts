import { app, dialog, net, powerMonitor, safeStorage, screen, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGoogleClient } from '../core/auth/google-client.ts';
import { persistRefreshedTokens, signIn } from '../core/auth/sign-in.ts';
import { signOut } from '../core/auth/sign-out.ts';
import { TokenStore } from '../core/auth/token-store.ts';
import { createDownloader } from '../core/library/downloader.ts';
import { createPhotoStore } from '../core/library/photo-store.ts';
import { createSelectionSession } from '../core/library/selection-session.ts';
import { consoleLog } from '../core/log.ts';
import { menuModel } from '../core/menu/menu-model.ts';
import { currentNotice } from '../core/menu/notice.ts';
import { NodeFileSystem } from '../core/persistence/fs.ts';
import { loadState, saveState } from '../core/persistence/state-file.ts';
import { createPickerClient } from '../core/picker/picker-client.ts';
import { systemClock } from '../core/rotation/clock.ts';
import { createRotationEngine } from '../core/rotation/engine.ts';
import { createHandoffWriter, defaultHandoffDir } from '../core/screensaver/handoff.ts';
import { installSaver, SCREEN_SAVER_SETTINGS_URL } from '../core/screensaver/installer.ts';
import { uninstallSaver } from '../core/screensaver/uninstall.ts';
import { registerIpc } from './ipc.ts';
import { createLoginItem } from './platform/login-item.ts';
import { createSafeStorageBox } from './platform/safe-storage-box.ts';
import { startLoopbackServer } from './platform/loopback-server.ts';
import { createHelperDesktop } from './platform/helper-desktop.ts';
import { handleProtocols, registerSchemes } from './protocols.ts';
import { createScheduler } from './scheduler.ts';
import { wireSystemEvents } from './system-events.ts';
import { createTray } from './tray.ts';
import { createWindows } from './windows.ts';

const isPrimaryInstance = app.requestSingleInstanceLock();
registerSchemes();

// A menu bar app: closing every window must not quit it (FR-001).
app.on('window-all-closed', () => {});

async function loadGoogleConfig(): Promise<{ clientId: string; clientSecret: string }> {
  const path = app.isPackaged ? join(process.resourcesPath, 'google.json') : join(app.getAppPath(), 'config', 'google.json');
  const config = JSON.parse(await readFile(path, 'utf8')) as { clientId?: string; clientSecret?: string };
  if (!config.clientId || !config.clientSecret) throw new Error(`Missing clientId/clientSecret in ${path}`);
  return { clientId: config.clientId, clientSecret: config.clientSecret };
}

/** The largest connected display in physical pixels, for the wallpaper download size. */
function largestDisplaySize(): { width: number; height: number } {
  return screen
    .getAllDisplays()
    .map((d) => ({ width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) }))
    .reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a), { width: 1920, height: 1080 });
}

async function main(): Promise<void> {
  await app.whenReady();
  app.dock?.hide();

  const appDir = app.getAppPath();
  const dataDir = app.getPath('userData');
  const fs = new NodeFileSystem();
  const photos = createPhotoStore({ fs, dir: dataDir });
  const tokenStore = new TokenStore({ fs, path: join(dataDir, 'tokens.bin'), box: createSafeStorageBox(safeStorage) });

  const google = createGoogleClient({
    ...(await loadGoogleConfig()),
    // Electron's net.fetch uses the system proxy and certificate settings; it takes strings, not URL objects.
    fetch: (input, init) => net.fetch(input instanceof URL ? input.toString() : input, init),
  });
  persistRefreshedTokens(google, tokenStore);
  const stored = await tokenStore.load();
  if (stored) google.oauth.setCredentials(stored);

  const state = await loadState(fs, dataDir);
  if (!stored && state.account.status !== 'signedOut') state.account = { status: 'needsReauth', email: state.account.email };

  // Our own wallpaper helper (contracts/wallpaper-helper.md); it also re-applies the photo on Space changes.
  const desktop = createHelperDesktop({
    command: app.isPackaged ? join(process.resourcesPath, 'pw-helper') : join(appDir, 'build', 'pw-helper'),
    args: ['--photos-dir', photos.photosDir],
    log: consoleLog,
  });
  app.on('before-quit', () => void desktop.stop());

  const handoff = createHandoffWriter({ fs, dir: defaultHandoffDir(app.getPath('home')), clock: systemClock });

  const engine = createRotationEngine({
    state,
    clock: systemClock,
    desktop,
    photos,
    random: Math.random,
    save: (s) => saveState(fs, dataDir, s),
    log: consoleLog,
    handoff,
  });

  const openExternal = (url: string) => shell.openExternal(url);
  const picker = createPickerClient({ google, clock: systemClock, openExternal });
  const downloader = createDownloader({ google, fs, dir: dataDir });

  const windows = createWindows({
    preloadDir: join(appDir, 'dist', 'preload'),
    onClosed: (kind) => {
      if (kind === 'selection') void session.discard();
    },
  });

  const session = createSelectionSession({
    engine,
    picker,
    downloader,
    photos,
    clock: systemClock,
    displaySize: largestDisplaySize,
    onDraftChanged: (view) => windows.get('selection')?.webContents.send('selection:draftChanged', view),
    log: consoleLog,
    onLowDisk: () => {
      lowDisk = true;
      consoleLog('warn', 'Low disk space: stopped saving new photos');
      renderMenu();
    },
    onSelectionCommitted: ({ addedIds }) => engine.selectionChanged({ addedIds }),
  });

  const loginItem = createLoginItem(app);
  await engine.update((s) => (s.settings.startAtLogin = loginItem.isEnabled()));

  handleProtocols({
    rendererDir: join(appDir, 'dist', 'renderer'),
    thumbPath: photos.thumbPath,
    isKnownId: (id) =>
      Boolean(session.view()?.photos.some((p) => p.id === id) || engine.getState().selection.photos.some((p) => p.id === id)),
  });
  registerIpc({ session, engine, windows });

  const runSignIn = async (): Promise<boolean> => {
    try {
      const { email } = await signIn({ google, tokenStore, openExternal, startLoopback: () => startLoopbackServer({ timeoutMs: 5 * 60_000 }) });
      await engine.update((s) => (s.account = { status: 'signedIn', email }));
      return true;
    } catch (e) {
      void dialog.showMessageBox({ type: 'warning', message: 'Sign-in was not completed', detail: (e as Error).message });
      return false;
    }
  };

  let lowDisk = false;

  /** Installs our screensaver and asks the user to select it; macOS won't let apps select it (FR-021). */
  const installAndGuideSaver = async () => {
    await installSaver({
      fs,
      bundledPath: app.isPackaged
        ? join(process.resourcesPath, 'PhotoWallpaperSaver.saver')
        : join(appDir, 'build', 'PhotoWallpaperSaver.saver'),
      home: app.getPath('home'),
      openExternal,
    });
    void dialog.showMessageBox({
      type: 'info',
      message: "Select 'Google Photos Wallpaper' in Screen Saver settings",
      detail: 'The screensaver will then show the same photo as your wallpaper.',
    });
  };

  const handlers: Record<string, () => unknown> = {
    signIn: runSignIn,
    chooseImages: async () => {
      if (engine.getState().account.status === 'needsReauth' && !(await runSignIn())) return;
      if (!session.view()) session.open();
      windows.show('selection');
    },
    customInterval: () => windows.show('custom-interval'),
    start: () => engine.start(),
    pause: () => engine.pause(),
    resume: () => engine.resume(),
    next: () => engine.next(),
    toggleScreensaver: async () => {
      if (engine.getState().settings.useForScreensaver) return engine.setUseForScreensaver(false);
      await engine.setUseForScreensaver(true);
      await installAndGuideSaver();
    },
    // Feature 004: give the Mac back, keeping sign-in, photos and settings (FR-008–FR-010).
    turnOff: async () => {
      windows.close('selection'); // discards any pick in progress
      const usedScreensaver = engine.getState().settings.useForScreensaver;
      await engine.turnOff();
      if (!usedScreensaver) return;
      await uninstallSaver({ fs, home: app.getPath('home') });
      const { response } = await dialog.showMessageBox({
        type: 'info',
        message: 'Google Photos Wallpaper is turned off and your wallpaper is restored.',
        detail: 'Your screensaver was reset. Choose a screensaver in System Settings → Screen Saver.',
        buttons: ['Open Screen Saver Settings', 'OK'],
        defaultId: 1,
      });
      if (response === 0) void shell.openExternal(SCREEN_SAVER_SETTINGS_URL);
    },
    turnOn: async () => {
      await engine.turnOn();
      if (engine.getState().settings.useForScreensaver) await installAndGuideSaver();
    },
    toggleLogin: async () => {
      loginItem.setEnabled(!engine.getState().settings.startAtLogin);
      await engine.update((s) => (s.settings.startAtLogin = loginItem.isEnabled()));
    },
    signOut: async () => {
      windows.close('selection');
      await signOut({ engine, google, tokenStore, photos, handoff });
    },
    quit: () => app.quit(),
  };

  const onClick = (id: string) => {
    const interval = /^interval:(\d+)$/.exec(id);
    const handler = interval ? () => engine.setInterval(Number(interval[1])) : handlers[id];
    if (!handler) return consoleLog('warn', 'No handler for menu item', { id });
    void Promise.resolve(handler()).catch((e: unknown) => consoleLog('error', 'Menu action failed', { id, error: String(e) }));
  };

  const tray = createTray({ iconPath: join(appDir, 'assets', 'trayTemplate.png'), onClick });
  function renderMenu() {
    const state = engine.getState();
    tray.render(menuModel({ state, notice: currentNotice({ state, isOnline: net.isOnline(), lowDisk }), now: Date.now() }));
  }
  engine.onChange(renderMenu);
  renderMenu();

  // Retry downloads left pending by a network drop whenever the rotation ticks or the Mac wakes.
  const retryIfOnline = () => {
    if (net.isOnline()) void session.retryPending();
  };
  const tickAndRetry = async () => {
    retryIfOnline();
    await engine.tick();
  };

  createScheduler({ ...engine, tick: tickAndRetry });
  wireSystemEvents({ screen, powerMonitor, engine: { ...engine, tick: tickAndRetry } });
  desktop.onExternalChange(() => void engine.externalChange());

  try {
    await desktop.start();
  } catch (e) {
    // Keep the tray running so sign-in and choosing photos still work.
    dialog.showErrorBox('Google Photos Wallpaper could not start its wallpaper helper', (e as Error).message);
    return;
  }
  await engine.restore();
}

if (!isPrimaryInstance) {
  app.quit();
} else {
  main().catch((e: unknown) => {
    console.error(e);
    dialog.showErrorBox('Google Photos Wallpaper could not start', (e as Error).message);
    app.quit();
  });
}
