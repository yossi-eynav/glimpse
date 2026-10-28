import { cp, mkdir, readFile, readdir, rename, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type FileSystem = {
  /** Writes `<path>.tmp` and renames it over `path`, creating parent folders. */
  writeAtomic(path: string, data: Uint8Array | string): Promise<void>;
  read(path: string): Promise<Uint8Array>;
  /** Removes a file or folder recursively. Missing paths are not an error. */
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Names of the entries directly inside `dir`, or [] if it doesn't exist. */
  list(dir: string): Promise<string[]>;
  /** Copies a file, or a folder recursively. */
  copy(from: string, to: string): Promise<void>;
  freeBytes(dir: string): Promise<number>;
};

export class NodeFileSystem implements FileSystem {
  async writeAtomic(path: string, data: Uint8Array | string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.tmp`, data);
    await rename(`${path}.tmp`, path);
  }

  async read(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(path));
  }

  async remove(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async list(dir: string): Promise<string[]> {
    try {
      return await readdir(dir);
    } catch {
      return [];
    }
  }

  async copy(from: string, to: string): Promise<void> {
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to, { recursive: true });
  }

  async freeBytes(dir: string): Promise<number> {
    await mkdir(dir, { recursive: true });
    const s = await statfs(dir);
    return s.bavail * s.bsize;
  }
}

/** In-memory file system for tests. Folders exist implicitly as path prefixes. */
export class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, Uint8Array>();
  readonly writeLog: string[] = [];
  free = Number.MAX_SAFE_INTEGER;

  async writeAtomic(path: string, data: Uint8Array | string): Promise<void> {
    this.files.set(path, typeof data === 'string' ? new TextEncoder().encode(data) : data);
    this.writeLog.push(path);
  }

  async read(path: string): Promise<Uint8Array> {
    const data = this.files.get(path);
    if (!data) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    return data;
  }

  async remove(path: string): Promise<void> {
    for (const key of [...this.files.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) this.files.delete(key);
    }
  }

  async exists(path: string): Promise<boolean> {
    return [...this.files.keys()].some((k) => k === path || k.startsWith(`${path}/`));
  }

  async list(dir: string): Promise<string[]> {
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (key.startsWith(`${dir}/`)) names.add(key.slice(dir.length + 1).split('/')[0]);
    }
    return [...names];
  }

  async copy(from: string, to: string): Promise<void> {
    for (const [key, data] of [...this.files]) {
      if (key === from) this.files.set(to, data);
      else if (key.startsWith(`${from}/`)) this.files.set(to + key.slice(from.length), data);
    }
  }

  async freeBytes(_dir: string): Promise<number> {
    return this.free;
  }
}
