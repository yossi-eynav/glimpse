import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRequest, LineSplitter, parseLine, SUPPORTED_HELPER_VERSION } from '../../../src/core/wallpaper/helper-protocol.ts';

test('encodeRequest writes one JSON object per line', () => {
  assert.equal(encodeRequest({ id: 1, cmd: 'show', path: '/p/a.jpg' }), '{"id":1,"cmd":"show","path":"/p/a.jpg"}\n');
  assert.equal(encodeRequest({ id: 2, cmd: 'get' }), '{"id":2,"cmd":"get"}\n');
  assert.equal(encodeRequest({ id: 3, cmd: 'clear' }), '{"id":3,"cmd":"clear"}\n');
});

test('parses responses', () => {
  assert.deepEqual(parseLine('{"id":1,"ok":true}'), { type: 'response', id: 1, ok: true });
  assert.deepEqual(parseLine('{"id":2,"ok":false,"error":"missing file"}'), { type: 'response', id: 2, ok: false, error: 'missing file' });
  assert.deepEqual(parseLine('{"id":3,"ok":true,"paths":["/a.jpg","/b.jpg"]}'), { type: 'response', id: 3, ok: true, paths: ['/a.jpg', '/b.jpg'] });
});

test('parses events', () => {
  assert.deepEqual(parseLine('{"event":"ready","version":1}'), { type: 'event', event: 'ready', version: 1 });
  assert.deepEqual(parseLine('{"event":"applied","reason":"space","path":"/p/a.jpg"}'), { type: 'event', event: 'applied', reason: 'space', path: '/p/a.jpg' });
  assert.deepEqual(parseLine('{"event":"externalChange","paths":["/x.heic"]}'), { type: 'event', event: 'externalChange', paths: ['/x.heic'] });
});

test('rejects malformed lines', () => {
  for (const line of [
    'not json',
    '[]',
    '{"ok":true}',
    '{"id":"1","ok":true}',
    '{"id":1}',
    '{"id":1,"ok":true,"paths":[1]}',
    '{"event":"nope"}',
    '{"event":"ready","version":"1"}',
    '{"event":"applied","reason":"other","path":"/a"}',
    '{"event":"externalChange","paths":"x"}',
    `{"id":1,"ok":true,"error":"${'x'.repeat(70_000)}"}`,
  ]) {
    assert.equal(parseLine(line).type, 'invalid', line.slice(0, 60));
  }
});

test('LineSplitter reassembles lines across chunks and holds back partial lines', () => {
  const s = new LineSplitter();
  assert.deepEqual(s.push('{"id":1,"ok":tr'), []);
  assert.deepEqual(s.push('ue}\n{"id":2,"ok":true}\n{"id":3'), ['{"id":1,"ok":true}', '{"id":2,"ok":true}']);
  assert.deepEqual(s.push(',"ok":true}\n'), ['{"id":3,"ok":true}']);
  assert.deepEqual(s.push('\n\n'), []);
});

test('the supported helper version is 1', () => {
  assert.equal(SUPPORTED_HELPER_VERSION, 1);
});

// --- Feature 004: restore ---

test('encodes restore with per-display paths', () => {
  assert.equal(encodeRequest({ id: 7, cmd: 'restore', paths: ['/a.heic', null] }), '{"id":7,"cmd":"restore","paths":["/a.heic",null]}\n');
});

test('parses the restored count', () => {
  assert.deepEqual(parseLine('{"id":7,"ok":true,"restored":2}'), { type: 'response', id: 7, ok: true, restored: 2 });
  assert.equal(parseLine('{"id":7,"ok":true,"restored":"2"}').type, 'invalid');
});
