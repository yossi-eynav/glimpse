import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuModel, type MenuItem } from '../../../src/core/menu/menu-model.ts';
import { defaultState } from '../../../src/core/persistence/app-state.ts';
import { signedInState } from '../../support/state.ts';

const NOW = Date.UTC(2026, 9, 27, 10, 0);
const model = (state = signedInState(['a', 'b'])) => menuModel({ state, notice: null, now: NOW, timeZone: 'UTC' });
const intervalSubmenu = (current: number): MenuItem => ({
  kind: 'submenu',
  label: 'Change every',
  items: [
    ...([[5, '5 min'], [15, '15 min'], [30, '30 min'], [60, '1 hour'], [360, '6 hours'], [1440, '1 day']] as const).map(
      ([m, label]): MenuItem => ({ kind: 'radio', id: `interval:${m}`, label, checked: m === current }),
    ),
    { kind: 'separator' },
    { kind: 'action', id: 'customInterval', label: 'Custom…', enabled: true },
  ],
});

test('signed out shows only Sign in and Quit', () => {
  assert.deepEqual(model(defaultState()), [
    { kind: 'action', id: 'signIn', label: 'Sign in with Google', enabled: true },
    { kind: 'action', id: 'quit', label: 'Quit', enabled: true },
  ]);
});

test('signed in shows every item in contract order', () => {
  assert.deepEqual(model(signedInState(['a', 'b'], (s) => (s.settings.startAtLogin = true))), [
    { kind: 'label', label: 'Rotation stopped' },
    { kind: 'label', label: '2 photos selected' },
    { kind: 'separator' },
    { kind: 'action', id: 'chooseImages', label: 'Choose Google Photos images…', enabled: true },
    intervalSubmenu(30),
    { kind: 'action', id: 'start', label: 'Start rotation', enabled: true },
    { kind: 'action', id: 'next', label: 'Next photo', enabled: true },
    { kind: 'separator' },
    { kind: 'toggle', id: 'toggleScreensaver', label: 'Use for screensaver', checked: false },
    { kind: 'toggle', id: 'toggleLogin', label: 'Start at login', checked: true },
    { kind: 'separator' },
    { kind: 'action', id: 'turnOff', label: 'Turn off', enabled: true },
    { kind: 'separator' },
    { kind: 'label', label: 'test@example.com' },
    { kind: 'action', id: 'signOut', label: 'Sign out', enabled: true },
    { kind: 'action', id: 'quit', label: 'Quit', enabled: true },
  ]);
});

test('the start item depends on the rotation mode', () => {
  const startItem = (mode: 'stopped' | 'running' | 'paused' | 'pausedExternalChange' | 'blockedNoPhotos') =>
    model(signedInState(['a'], (s) => (s.rotation.mode = mode)))[5];
  assert.deepEqual(startItem('stopped'), { kind: 'action', id: 'start', label: 'Start rotation', enabled: true });
  assert.deepEqual(startItem('blockedNoPhotos'), { kind: 'action', id: 'start', label: 'Start rotation', enabled: true });
  assert.deepEqual(startItem('running'), { kind: 'action', id: 'pause', label: 'Pause', enabled: true });
  assert.deepEqual(startItem('paused'), { kind: 'action', id: 'resume', label: 'Resume', enabled: true });
  assert.deepEqual(startItem('pausedExternalChange'), { kind: 'action', id: 'resume', label: 'Resume', enabled: true });
});

test('status line covers paused and blocked modes', () => {
  const status = (mode: 'paused' | 'pausedExternalChange' | 'blockedNoPhotos') => model(signedInState(['a'], (s) => (s.rotation.mode = mode)))[0];
  assert.deepEqual(status('paused'), { kind: 'label', label: 'Paused' });
  assert.deepEqual(status('pausedExternalChange'), { kind: 'label', label: 'Paused — wallpaper changed in System Settings' });
  assert.deepEqual(status('blockedNoPhotos'), { kind: 'label', label: 'Stopped — no photos available' });
});

test('the screensaver toggle reflects the setting', () => {
  const items = model(signedInState(['a'], (s) => (s.settings.useForScreensaver = true)));
  assert.deepEqual(items.find((i) => i.kind === 'toggle' && i.id === 'toggleScreensaver'), {
    kind: 'toggle',
    id: 'toggleScreensaver',
    label: 'Use for screensaver',
    checked: true,
  });
});

test('Start and Next are disabled with no available photos', () => {
  const items = model(signedInState([]));
  const byId = (id: string) => items.find((i) => 'id' in i && i.id === id);
  assert.deepEqual(byId('start'), { kind: 'action', id: 'start', label: 'Start rotation', enabled: false });
  assert.deepEqual(byId('next'), { kind: 'action', id: 'next', label: 'Next photo', enabled: false });
  assert.deepEqual(items[1], { kind: 'label', label: '0 photos selected' });
});

test('a non-preset interval shows a checked Custom (<n> min) item', () => {
  const items = model(signedInState(['a'], (s) => (s.settings.intervalMinutes = 45)));
  const sub = items.find((i) => i.kind === 'submenu');
  assert.ok(sub && sub.kind === 'submenu');
  assert.deepEqual(sub.items.slice(-3), [
    { kind: 'radio', id: 'interval:45', label: 'Custom (45 min)', checked: true },
    { kind: 'separator' },
    { kind: 'action', id: 'customInterval', label: 'Custom…', enabled: true },
  ]);
  assert.ok(sub.items.filter((i) => i.kind === 'radio').every((i) => i.kind !== 'radio' || i.checked === (i.id === 'interval:45')));
});

test('status line shows the next change time, with a weekday when not today', () => {
  const running = (at: number) =>
    model(signedInState(['a'], (s) => (s.rotation = { mode: 'running', currentPhotoId: 'a', nextChangeAt: at })));
  assert.deepEqual(running(Date.UTC(2026, 9, 27, 10, 30))[0], { kind: 'label', label: 'Next change at 10:30' });
  assert.deepEqual(running(Date.UTC(2026, 9, 28, 9, 0))[0], { kind: 'label', label: 'Next change Wed 09:00' });
});

// --- Feature 004: Turn off / Turn on ---

const offState = (ids: string[] = ['a'], patch: (s: ReturnType<typeof signedInState>) => void = () => {}) =>
  signedInState(ids, (s) => {
    s.power = 'off';
    patch(s);
  });

test('the off menu shows only the status, Turn on, account, Sign out and Quit', () => {
  assert.deepEqual(model(offState()), [
    { kind: 'label', label: 'Turned off — your wallpaper is restored' },
    { kind: 'separator' },
    { kind: 'action', id: 'turnOn', label: 'Turn on', enabled: true },
    { kind: 'separator' },
    { kind: 'label', label: 'test@example.com' },
    { kind: 'action', id: 'signOut', label: 'Sign out', enabled: true },
    { kind: 'action', id: 'quit', label: 'Quit', enabled: true },
  ]);
});

test('Turn on is disabled when no photo is saved', () => {
  const items = model(offState([]));
  assert.deepEqual(items[2], { kind: 'action', id: 'turnOn', label: 'Turn on', enabled: false });
});

test('while off, only the sign-in notice is shown', () => {
  const reauth = menuModel({
    state: offState(['a'], (s) => (s.account.status = 'needsReauth')),
    notice: { text: 'Sign in again to change your photos', action: 'signIn' },
    now: NOW,
    timeZone: 'UTC',
  });
  assert.deepEqual(reauth[0], { kind: 'action', id: 'signIn', label: '⚠ Sign in again to change your photos', enabled: true });
  const lowDisk = menuModel({ state: offState(), notice: { text: "Low disk space — new photos aren't being saved", action: null }, now: NOW, timeZone: 'UTC' });
  assert.deepEqual(lowDisk[0], { kind: 'label', label: 'Turned off — your wallpaper is restored' });
});
