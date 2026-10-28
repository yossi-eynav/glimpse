import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { wireSystemEvents } from '../../src/main/system-events.ts';

test('display changes re-apply the current photo', () => {
  const screen = new EventEmitter();
  const calls: string[] = [];
  wireSystemEvents({ screen, powerMonitor: new EventEmitter(), engine: { displaysChanged: async () => void calls.push('displays'), tick: async () => {} } });
  screen.emit('display-added');
  screen.emit('display-removed');
  assert.deepEqual(calls, ['displays', 'displays']);
});

test('waking from sleep ticks the engine once', () => {
  const powerMonitor = new EventEmitter();
  const calls: string[] = [];
  wireSystemEvents({ screen: new EventEmitter(), powerMonitor, engine: { displaysChanged: async () => {}, tick: async () => void calls.push('tick') } });
  powerMonitor.emit('resume');
  assert.deepEqual(calls, ['tick']);
});
