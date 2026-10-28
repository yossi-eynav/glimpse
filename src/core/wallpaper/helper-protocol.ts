// Wire format between the app and pw-helper: one JSON object per line (contracts/wallpaper-helper.md).

export const SUPPORTED_HELPER_VERSION = 1;
const MAX_LINE = 64 * 1024;

export type HelperRequest =
  | { id: number; cmd: 'show'; path: string }
  | { id: number; cmd: 'get' }
  | { id: number; cmd: 'clear' }
  | { id: number; cmd: 'restore'; paths: (string | null)[] };

export type HelperMessage =
  | { type: 'response'; id: number; ok: true; paths?: string[]; restored?: number }
  | { type: 'response'; id: number; ok: false; error: string }
  | { type: 'event'; event: 'ready'; version: number }
  | { type: 'event'; event: 'applied'; reason: 'space' | 'screens'; path: string }
  | { type: 'event'; event: 'externalChange'; paths: string[] }
  | { type: 'invalid'; reason: string };

export function encodeRequest(req: HelperRequest): string {
  return `${JSON.stringify(req)}\n`;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const invalid = (reason: string): HelperMessage => ({ type: 'invalid', reason });

export function parseLine(line: string): HelperMessage {
  if (line.length > MAX_LINE) return invalid('line too long');
  let m: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(line);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid('not an object');
    m = parsed as Record<string, unknown>;
  } catch {
    return invalid('not JSON');
  }

  if ('event' in m) {
    switch (m.event) {
      case 'ready':
        return typeof m.version === 'number' ? { type: 'event', event: 'ready', version: m.version } : invalid('bad ready');
      case 'applied':
        return (m.reason === 'space' || m.reason === 'screens') && typeof m.path === 'string'
          ? { type: 'event', event: 'applied', reason: m.reason, path: m.path }
          : invalid('bad applied');
      case 'externalChange':
        return isStringArray(m.paths) ? { type: 'event', event: 'externalChange', paths: m.paths } : invalid('bad externalChange');
      default:
        return invalid('unknown event');
    }
  }

  if (typeof m.id !== 'number' || typeof m.ok !== 'boolean') return invalid('bad response');
  if (!m.ok) return { type: 'response', id: m.id, ok: false, error: typeof m.error === 'string' ? m.error : 'unknown error' };
  if (m.restored !== undefined) {
    return typeof m.restored === 'number' ? { type: 'response', id: m.id, ok: true, restored: m.restored } : invalid('bad restored');
  }
  if (m.paths === undefined) return { type: 'response', id: m.id, ok: true };
  return isStringArray(m.paths) ? { type: 'response', id: m.id, ok: true, paths: m.paths } : invalid('bad paths');
}

/** Turns stdout chunks into complete, non-empty lines; keeps a trailing partial line for the next chunk. */
export class LineSplitter {
  #buffer = '';

  push(chunk: string): string[] {
    this.#buffer += chunk;
    const parts = this.#buffer.split('\n');
    this.#buffer = parts.pop() ?? '';
    return parts.filter((l) => l.length > 0);
  }
}
