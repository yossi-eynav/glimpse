import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toElectronMenu } from '../../src/main/tray-menu.ts';

test('maps every MenuItem kind onto Electron menu options', () => {
  const clicked: string[] = [];
  const out = toElectronMenu(
    [
      { kind: 'label', label: 'Status' },
      { kind: 'separator' },
      { kind: 'action', id: 'start', label: 'Start rotation', enabled: false },
      { kind: 'toggle', id: 'toggleLogin', label: 'Start at login', checked: true },
      { kind: 'submenu', label: 'Change every', items: [{ kind: 'radio', id: 'interval:5', label: '5 min', checked: true }] },
    ],
    (id) => clicked.push(id),
  );

  assert.deepEqual(out[0], { label: 'Status', enabled: false });
  assert.deepEqual(out[1], { type: 'separator' });
  assert.equal(out[2].label, 'Start rotation');
  assert.equal(out[2].enabled, false);
  assert.equal(out[3].type, 'checkbox');
  assert.equal(out[3].checked, true);
  const sub = out[4].submenu as Array<{ type?: string; checked?: boolean; click?: () => void }>;
  assert.equal(out[4].label, 'Change every');
  assert.equal(sub[0].type, 'radio');
  assert.equal(sub[0].checked, true);

  (out[2].click as () => void)();
  (out[3].click as () => void)();
  sub[0].click?.();
  assert.deepEqual(clicked, ['start', 'toggleLogin', 'interval:5']);
});
