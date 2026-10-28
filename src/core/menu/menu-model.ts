import { availableCount, type AppState } from '../persistence/app-state.ts';

export type MenuItem =
  | { kind: 'action'; id: string; label: string; enabled: boolean }
  | { kind: 'toggle'; id: string; label: string; checked: boolean }
  | { kind: 'radio'; id: string; label: string; checked: boolean }
  | { kind: 'submenu'; label: string; items: MenuItem[] }
  | { kind: 'separator' }
  | { kind: 'label'; label: string };

export type Notice = { text: string; action: string | null };

const PRESETS: [number, string][] = [
  [5, '5 min'],
  [15, '15 min'],
  [30, '30 min'],
  [60, '1 hour'],
  [360, '6 hours'],
  [1440, '1 day'],
];

const action = (id: string, label: string, enabled = true): MenuItem => ({ kind: 'action', id, label, enabled });
const separator: MenuItem = { kind: 'separator' };

/** The tray menu as data (contracts/menu-ui.md). */
export function menuModel(input: { state: AppState; notice: Notice | null; now: number; timeZone?: string }): MenuItem[] {
  const { state, notice } = input;
  if (state.account.status === 'signedOut') return [action('signIn', 'Sign in with Google'), action('quit', 'Quit')];

  const n = availableCount(state.selection);
  if (state.power === 'off') return offMenu(state, notice, n);
  const items: MenuItem[] = [];
  if (notice) items.push(notice.action ? action(notice.action, `⚠ ${notice.text}`) : { kind: 'label', label: `⚠ ${notice.text}` });
  items.push(
    { kind: 'label', label: statusLine(state, input.now, input.timeZone) },
    { kind: 'label', label: `${n} photos selected` },
    separator,
    action('chooseImages', 'Choose Google Photos images…'),
    intervalSubmenu(state.settings.intervalMinutes),
    startItem(state, n),
    action('next', 'Next photo', n > 0),
    separator,
    { kind: 'toggle', id: 'toggleScreensaver', label: 'Use for screensaver', checked: state.settings.useForScreensaver },
    { kind: 'toggle', id: 'toggleLogin', label: 'Start at login', checked: state.settings.startAtLogin },
    separator,
    action('turnOff', 'Turn off'),
    separator,
    { kind: 'label', label: state.account.email ?? 'Signed in' },
    action('signOut', 'Sign out'),
    action('quit', 'Quit'),
  );
  return items;
}

/** Turned off: only what's needed to turn back on or leave (feature 004, contracts/menu-power.md). */
function offMenu(state: AppState, notice: Notice | null, available: number): MenuItem[] {
  const items: MenuItem[] = [];
  // Only the sign-in notice matters while off, so the user knows to sign in before turning on.
  if (notice?.action === 'signIn') items.push(action('signIn', `⚠ ${notice.text}`));
  items.push(
    { kind: 'label', label: 'Turned off — your wallpaper is restored' },
    separator,
    action('turnOn', 'Turn on', available > 0),
    separator,
    { kind: 'label', label: state.account.email ?? 'Signed in' },
    action('signOut', 'Sign out'),
    action('quit', 'Quit'),
  );
  return items;
}

function startItem(state: AppState, available: number): MenuItem {
  switch (state.rotation.mode) {
    case 'running':
      return action('pause', 'Pause');
    case 'paused':
    case 'pausedExternalChange':
      return action('resume', 'Resume');
    default:
      return action('start', 'Start rotation', available > 0);
  }
}

function intervalSubmenu(current: number): MenuItem {
  const items: MenuItem[] = PRESETS.map(([m, label]) => ({ kind: 'radio', id: `interval:${m}`, label, checked: m === current }));
  if (!PRESETS.some(([m]) => m === current)) {
    items.push({ kind: 'radio', id: `interval:${current}`, label: `Custom (${current} min)`, checked: true });
  }
  items.push(separator, action('customInterval', 'Custom…'));
  return { kind: 'submenu', label: 'Change every', items };
}

function statusLine(state: AppState, now: number, timeZone?: string): string {
  const { mode, nextChangeAt } = state.rotation;
  switch (mode) {
    case 'running':
      return nextChangeAt === null ? 'Running' : `Next change ${formatWhen(nextChangeAt, now, timeZone)}`;
    case 'paused':
      return 'Paused';
    case 'pausedExternalChange':
      return 'Paused — wallpaper changed in System Settings';
    case 'blockedNoPhotos':
      return 'Stopped — no photos available';
    case 'stopped':
      return 'Rotation stopped';
  }
}

function formatWhen(at: number, now: number, timeZone?: string): string {
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(at);
  const day = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(t);
  if (day(at) === day(now)) return `at ${time}`;
  return `${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(at)} ${time}`;
}
