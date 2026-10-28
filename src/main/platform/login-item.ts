type AppLike = {
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
  getLoginItemSettings(): { openAtLogin: boolean };
};

/** Start at login (FR-023), backed by Electron's app login item settings. */
export function createLoginItem(app: AppLike) {
  return {
    isEnabled: () => app.getLoginItemSettings().openAtLogin,
    setEnabled: (enabled: boolean) => app.setLoginItemSettings({ openAtLogin: enabled }),
  };
}
