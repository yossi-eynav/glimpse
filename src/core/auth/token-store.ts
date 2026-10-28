import type { Credentials } from 'google-auth-library';
import type { FileSystem } from '../persistence/fs.ts';

/** Encrypts secrets at rest. In the app this is Electron safeStorage (Keychain-backed key). */
export type SecretBox = {
  encrypt(plain: string): Uint8Array;
  decrypt(data: Uint8Array): string;
};

/** Persists Google OAuth credentials, encrypted, in a single file. */
export class TokenStore {
  readonly #fs: FileSystem;
  readonly #path: string;
  readonly #box: SecretBox;

  constructor(opts: { fs: FileSystem; path: string; box: SecretBox }) {
    this.#fs = opts.fs;
    this.#path = opts.path;
    this.#box = opts.box;
  }

  async save(tokens: Credentials): Promise<void> {
    await this.#fs.writeAtomic(this.#path, this.#box.encrypt(JSON.stringify(tokens)));
  }

  async load(): Promise<Credentials | null> {
    try {
      return JSON.parse(this.#box.decrypt(await this.#fs.read(this.#path))) as Credentials;
    } catch {
      return null;
    }
  }

  /** Saves refreshed tokens, keeping the stored refresh_token when Google doesn't send a new one. */
  async merge(tokens: Credentials): Promise<void> {
    const current = await this.load();
    await this.save({ ...current, ...tokens, refresh_token: tokens.refresh_token ?? current?.refresh_token });
  }

  async clear(): Promise<void> {
    await this.#fs.remove(this.#path);
  }
}
