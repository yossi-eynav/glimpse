import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Log } from '../../core/log.ts';
import type { Desktop } from '../../core/wallpaper/desktop.ts';
import {
  encodeRequest,
  LineSplitter,
  parseLine,
  SUPPORTED_HELPER_VERSION,
  type HelperRequest,
} from '../../core/wallpaper/helper-protocol.ts';

export class HelperError extends Error {
  override name = 'HelperError';
}
export class HelperTimeout extends Error {
  override name = 'HelperTimeout';
}
export class HelperUnavailable extends Error {
  override name = 'HelperUnavailable';
}
export class HelperIncompatible extends Error {
  override name = 'HelperIncompatible';
}

type Command = { cmd: 'show'; path: string } | { cmd: 'get' } | { cmd: 'clear' } | { cmd: 'restore'; paths: (string | null)[] };
type Reply = { paths?: string[]; restored?: number };
type Pending = {
  request: HelperRequest;
  sent: boolean;
  timer: NodeJS.Timeout;
  resolve(reply: Reply): void;
  reject(e: Error): void;
};

export type HelperDesktop = Required<Desktop> & { start(): Promise<void>; stop(): Promise<void> };

/** Runs pw-helper as a supervised child process and speaks contracts/wallpaper-helper.md. */
export function createHelperDesktop(opts: {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  log: Log;
  readyTimeoutMs?: number;
  requestTimeoutMs?: number;
  restartDelaysMs?: number[];
  maxRestarts?: number;
  restartWindowMs?: number;
}): HelperDesktop {
  const readyTimeoutMs = opts.readyTimeoutMs ?? 5_000;
  const requestTimeoutMs = opts.requestTimeoutMs ?? 5_000;
  const restartDelaysMs = opts.restartDelaysMs ?? [1_000, 2_000, 4_000, 8_000, 16_000];
  const maxRestarts = opts.maxRestarts ?? 5;
  const restartWindowMs = opts.restartWindowMs ?? 10 * 60_000;

  let child: ChildProcessWithoutNullStreams | null = null;
  let ready = false;
  let closed = false; // stopped, incompatible, or gave up: no more restarts or requests
  let nextId = 0;
  /** The last command that decides what the wallpaper should be; replayed after a restart. */
  let lastWallpaperCommand: Extract<Command, { cmd: 'show' | 'restore' }> | null = null;
  let restarts: number[] = [];
  const pending = new Map<number, Pending>();
  const externalListeners = new Set<(paths: string[]) => void>();
  let readyWaiter: { resolve(): void; reject(e: Error): void; timer: NodeJS.Timeout } | null = null;

  /** Rejects requests already written to the helper (or all of them); unsent ones wait for a restart. */
  const fail = (error: () => Error, { includeUnsent }: { includeUnsent: boolean }) => {
    for (const [id, p] of pending) {
      if (!p.sent && !includeUnsent) continue;
      clearTimeout(p.timer);
      pending.delete(id);
      p.reject(error());
    }
  };

  const kill = (proc: ChildProcessWithoutNullStreams | null) => {
    if (proc === child) ready = false; // queue new requests until the replacement is ready
    proc?.kill('SIGKILL');
  };

  const write = (p: Pending) => {
    p.sent = true;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => {
      pending.delete(p.request.id);
      p.reject(new HelperTimeout(`pw-helper did not answer ${p.request.cmd} within ${requestTimeoutMs} ms`));
      opts.log('warn', 'pw-helper is not responding; restarting it');
      kill(child);
    }, requestTimeoutMs);
    child?.stdin.write(encodeRequest(p.request));
  };

  const onReady = (version: number, isRestart: boolean) => {
    if (version !== SUPPORTED_HELPER_VERSION) {
      closed = true;
      const error = new HelperIncompatible(`pw-helper speaks version ${version}, expected ${SUPPORTED_HELPER_VERSION}`);
      readyWaiter?.reject(error);
      fail(() => new HelperUnavailable(error.message), { includeUnsent: true });
      kill(child);
      return;
    }
    ready = true;
    if (readyWaiter) {
      clearTimeout(readyWaiter.timer);
      readyWaiter.resolve();
      readyWaiter = null;
    }
    for (const p of pending.values()) if (!p.sent) write(p);
    // A restarted helper has forgotten the current photo (or the restore); send it again.
    if (isRestart && lastWallpaperCommand) {
      request(lastWallpaperCommand).catch((e: unknown) =>
        opts.log('warn', 'Could not re-apply the wallpaper after a helper restart', { error: String(e) }),
      );
    }
  };

  const spawnHelper = (isRestart: boolean) => {
    ready = false;
    const proc = spawn(opts.command, opts.args, { env: opts.env, stdio: ['pipe', 'pipe', 'pipe'] });
    child = proc;
    const out = new LineSplitter();
    const err = new LineSplitter();

    proc.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      for (const line of out.push(chunk)) {
        const msg = parseLine(line);
        if (msg.type === 'invalid') {
          opts.log('warn', 'pw-helper sent an invalid line', { reason: msg.reason });
        } else if (msg.type === 'event') {
          if (msg.event === 'ready') onReady(msg.version, isRestart);
          else if (msg.event === 'externalChange') for (const l of externalListeners) l(msg.paths);
          else opts.log('info', 'pw-helper re-applied the wallpaper', { reason: msg.reason });
        } else {
          const p = pending.get(msg.id);
          if (!p) continue;
          pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.ok) p.resolve({ paths: msg.paths, restored: msg.restored });
          else p.reject(new HelperError(msg.error));
        }
      }
    });
    proc.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      for (const line of err.push(chunk)) opts.log('warn', line);
    });
    proc.on('error', (e) => opts.log('error', 'Could not run pw-helper', { error: String(e) }));
    proc.on('exit', (code, signal) => {
      if (child !== proc) return;
      child = null;
      ready = false;
      fail(() => new HelperUnavailable('pw-helper exited'), { includeUnsent: closed });
      if (closed) return;
      opts.log('warn', 'pw-helper exited', { code, signal });
      scheduleRestart();
    });
  };

  const scheduleRestart = () => {
    const now = Date.now();
    restarts = restarts.filter((t) => now - t < restartWindowMs);
    if (restarts.length >= maxRestarts) {
      closed = true;
      fail(() => new HelperUnavailable('pw-helper is not running'), { includeUnsent: true });
      opts.log('error', `pw-helper keeps exiting; giving up after ${maxRestarts} restarts`);
      return;
    }
    const delay = restartDelaysMs[Math.min(restarts.length, restartDelaysMs.length - 1)];
    restarts.push(now);
    opts.log('warn', `pw-helper will restart in ${delay} ms`);
    setTimeout(() => {
      if (!closed) spawnHelper(true);
    }, delay);
  };

  const request = (command: Command): Promise<Reply> => {
    if (closed) return Promise.reject(new HelperUnavailable('pw-helper is not running'));
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const p: Pending = {
        request: { id, ...command } as HelperRequest,
        sent: false,
        resolve,
        reject,
        // Until it is sent, the request waits for the helper to (re)start.
        timer: setTimeout(() => {
          pending.delete(id);
          reject(new HelperUnavailable('pw-helper did not become ready'));
        }, readyTimeoutMs),
      };
      pending.set(id, p);
      if (ready) write(p);
    });
  };

  return {
    start() {
      if (closed) return Promise.reject(new HelperUnavailable('pw-helper is not running'));
      return new Promise<void>((resolve, reject) => {
        readyWaiter = {
          resolve,
          reject,
          timer: setTimeout(() => {
            readyWaiter = null;
            reject(new HelperUnavailable(`pw-helper did not start within ${readyTimeoutMs} ms`));
            closed = true;
            kill(child);
          }, readyTimeoutMs),
        };
        spawnHelper(false);
      });
    },

    async stop() {
      closed = true;
      fail(() => new HelperUnavailable('pw-helper stopped'), { includeUnsent: true });
      const proc = child;
      if (!proc) return;
      await new Promise<void>((resolve) => {
        const kill = setTimeout(() => proc.kill('SIGTERM'), 1_000);
        proc.once('exit', () => {
          clearTimeout(kill);
          resolve();
        });
        proc.stdin.end(); // the helper exits at end of input
      });
    },

    async set(path) {
      lastWallpaperCommand = { cmd: 'show', path };
      await request(lastWallpaperCommand);
    },

    async get() {
      return (await request({ cmd: 'get' })).paths ?? [];
    },

    async clear() {
      lastWallpaperCommand = null;
      await request({ cmd: 'clear' });
    },

    async restore(paths) {
      lastWallpaperCommand = { cmd: 'restore', paths };
      return (await request(lastWallpaperCommand)).restored ?? 0;
    },

    onExternalChange(listener) {
      externalListeners.add(listener);
      return () => externalListeners.delete(listener);
    },
  };
}
