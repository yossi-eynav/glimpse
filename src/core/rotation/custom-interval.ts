import { MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from '../persistence/app-state.ts';
import type { IntervalUnit } from '../../shared/ipc-types.ts';

export const INTERVAL_HINT = 'Between 1 minute and 7 days';

const PER_UNIT: Record<IntervalUnit, number> = { minutes: 1, hours: 60, days: 1440 };

export function toMinutes(value: number, unit: IntervalUnit): number {
  return value * PER_UNIT[unit];
}

export function isValidIntervalMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= MIN_INTERVAL_MINUTES && minutes <= MAX_INTERVAL_MINUTES;
}

export function validateInterval(value: number, unit: IntervalUnit): { ok: true; minutes: number } | { ok: false; hint: string } {
  const minutes = toMinutes(value, unit);
  return Number.isInteger(value) && isValidIntervalMinutes(minutes) ? { ok: true, minutes } : { ok: false, hint: INTERVAL_HINT };
}
