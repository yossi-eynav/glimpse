import type { MenuItemConstructorOptions } from 'electron';
import type { MenuItem } from '../core/menu/menu-model.ts';

/** Maps menu-model items one to one onto Electron menu options. */
export function toElectronMenu(items: MenuItem[], onClick: (id: string) => void): MenuItemConstructorOptions[] {
  return items.map((item): MenuItemConstructorOptions => {
    switch (item.kind) {
      case 'action':
        return { id: item.id, label: item.label, enabled: item.enabled, click: () => onClick(item.id) };
      case 'toggle':
        return { id: item.id, label: item.label, type: 'checkbox', checked: item.checked, click: () => onClick(item.id) };
      case 'radio':
        return { id: item.id, label: item.label, type: 'radio', checked: item.checked, click: () => onClick(item.id) };
      case 'submenu':
        return { label: item.label, submenu: toElectronMenu(item.items, onClick) };
      case 'separator':
        return { type: 'separator' };
      case 'label':
        return { label: item.label, enabled: false };
    }
  });
}
