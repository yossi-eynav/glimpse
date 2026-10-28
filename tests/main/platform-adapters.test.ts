import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSafeStorageBox } from '../../src/main/platform/safe-storage-box.ts';

test('safe storage box round-trips through encryptString/decryptString', () => {
  const box = createSafeStorageBox({
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(`x${s}`),
    decryptString: (b) => b.toString().slice(1),
  });
  const enc = box.encrypt('secret');
  assert.equal(Buffer.from(enc).toString(), 'xsecret');
  assert.equal(box.decrypt(enc), 'secret');
});

test('safe storage box refuses to store secrets when encryption is unavailable', () => {
  const box = createSafeStorageBox({
    isEncryptionAvailable: () => false,
    encryptString: (s) => Buffer.from(s),
    decryptString: (b) => b.toString(),
  });
  assert.throws(() => box.encrypt('secret'), /Keychain/);
});
