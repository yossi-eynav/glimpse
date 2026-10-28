import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoginItem } from '../../src/main/platform/login-item.ts';

test('setEnabled and isEnabled use app login item settings', () => {
  let openAtLogin = false;
  const calls: unknown[] = [];
  const item = createLoginItem({
    setLoginItemSettings: (s) => {
      calls.push(s);
      openAtLogin = s.openAtLogin;
    },
    getLoginItemSettings: () => ({ openAtLogin }),
  });
  assert.equal(item.isEnabled(), false);
  item.setEnabled(true);
  assert.deepEqual(calls, [{ openAtLogin: true }]);
  assert.equal(item.isEnabled(), true);
});
