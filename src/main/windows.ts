import { BrowserWindow, nativeTheme } from 'electron';

type Kind = 'selection' | 'custom-interval';

const SIZES: Record<Kind, Electron.BrowserWindowConstructorOptions> = {
  selection: { width: 720, height: 560, minWidth: 560, minHeight: 420, title: 'Choose Google Photos images', titleBarStyle: 'hiddenInset' },
  'custom-interval': { width: 360, height: 190, resizable: false, minimizable: false, title: 'Custom interval' },
};

/** At most one window of each kind; reopening focuses the existing one. */
export function createWindows(opts: { preloadDir: string; onClosed(kind: Kind): void }) {
  const open = new Map<Kind, BrowserWindow>();

  const show = (kind: Kind): BrowserWindow => {
    const existing = open.get(kind);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }
    const win = new BrowserWindow({
      ...SIZES[kind],
      // Match the theme's background so the window never flashes white (spec SC-001).
      ...(kind === 'selection' && { backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f5f5f7' }),
      show: false,
      fullscreenable: false,
      webPreferences: {
        preload: `${opts.preloadDir}/${kind}.cjs`,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    // Navigation and new windows are never needed; block them.
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.once('ready-to-show', () => win.show());
    win.on('closed', () => {
      open.delete(kind);
      opts.onClosed(kind);
    });
    void win.loadURL(`app://renderer/${kind}/index.html`);
    open.set(kind, win);
    return win;
  };

  return {
    show,
    get: (kind: Kind) => open.get(kind),
    close: (kind: Kind) => open.get(kind)?.close(),
  };
}

export type Windows = ReturnType<typeof createWindows>;
