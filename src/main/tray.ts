import { Menu, Tray, nativeImage } from 'electron';
import type { MenuItem } from '../core/menu/menu-model.ts';
import { toElectronMenu } from './tray-menu.ts';

/** The menu bar icon; render() replaces its menu whenever app state changes. */
export function createTray(opts: { iconPath: string; onClick(id: string): void }) {
  const icon = nativeImage.createFromPath(opts.iconPath);
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip('Google Photos Wallpaper');
  return {
    render(items: MenuItem[]) {
      tray.setContextMenu(Menu.buildFromTemplate(toElectronMenu(items, opts.onClick)));
    },
  };
}
