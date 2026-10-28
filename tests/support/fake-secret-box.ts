import type { SecretBox } from '../../src/core/auth/token-store.ts';

/** Reversible base64 "encryption", for tests only. */
export const fakeSecretBox: SecretBox = {
  encrypt: (s) => new TextEncoder().encode(`enc:${Buffer.from(s).toString('base64')}`),
  decrypt: (b) => {
    const t = new TextDecoder().decode(b);
    if (!t.startsWith('enc:')) throw new Error('cannot decrypt');
    return Buffer.from(t.slice(4), 'base64').toString();
  },
};
