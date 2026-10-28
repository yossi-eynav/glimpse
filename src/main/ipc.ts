import { ipcMain } from 'electron';
import type { RotationEngine } from '../core/rotation/engine.ts';
import { validateInterval } from '../core/rotation/custom-interval.ts';
import type { createSelectionSession } from '../core/library/selection-session.ts';
import { Channels, type IntervalUnit } from '../shared/ipc-types.ts';
import type { Windows } from './windows.ts';

const UNITS: IntervalUnit[] = ['minutes', 'hours', 'days'];

/** ipcMain handlers for contracts/ipc.md. Every argument from a renderer is checked here. */
export function registerIpc(deps: {
  session: ReturnType<typeof createSelectionSession>;
  engine: RotationEngine;
  windows: Windows;
}): void {
  const { session, engine, windows } = deps;

  ipcMain.handle(Channels.getDraft, () => session.view() ?? session.open());
  ipcMain.handle(Channels.pick, () => session.pick());
  ipcMain.handle(Channels.cancelPick, () => session.cancelPick());
  ipcMain.handle(Channels.remove, (_e, id: unknown) => {
    if (typeof id !== 'string') throw new TypeError('id must be a string');
    return session.remove(id);
  });
  ipcMain.handle(Channels.clear, () => session.clear());
  ipcMain.handle(Channels.commit, async () => {
    await session.commit();
    windows.close('selection');
  });
  ipcMain.handle(Channels.discard, async () => {
    await session.discard();
    windows.close('selection');
  });

  ipcMain.handle(Channels.intervalGetCurrent, () => ({ minutes: engine.getState().settings.intervalMinutes }));
  ipcMain.handle(Channels.intervalSubmit, async (_e, value: unknown, unit: unknown) => {
    if (typeof value !== 'number' || !UNITS.includes(unit as IntervalUnit)) return { ok: false, hint: 'Between 1 minute and 7 days' };
    const result = validateInterval(value, unit as IntervalUnit);
    if (!result.ok) return result;
    await engine.setInterval(result.minutes);
    windows.close('custom-interval');
    return { ok: true };
  });
  ipcMain.handle(Channels.intervalCancel, () => windows.close('custom-interval'));
}
