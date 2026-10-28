import type { SecretBox } from '../../core/auth/token-store.ts';

export type SafeStorageLike = {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(data: Buffer): string;
};

/** Electron safeStorage: on macOS the encryption key is kept in the user's Keychain. */
export function createSafeStorageBox(safeStorage: SafeStorageLike): SecretBox {
  return {
    encrypt(plain) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Keychain encryption is not available');
      return new Uint8Array(safeStorage.encryptString(plain));
    },
    decrypt: (data) => safeStorage.decryptString(Buffer.from(data)),
  };
}
