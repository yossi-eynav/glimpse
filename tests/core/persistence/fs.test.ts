import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryFileSystem, NodeFileSystem, type FileSystem } from '../../../src/core/persistence/fs.ts';

const text = (b: Uint8Array) => new TextDecoder().decode(b);

for (const [name, make] of [
  ['MemoryFileSystem', async () => ({ fs: new MemoryFileSystem() as FileSystem, root: '/root' })],
  ['NodeFileSystem', async () => ({ fs: new NodeFileSystem() as FileSystem, root: await mkdtemp(join(tmpdir(), 'pw-')) })],
] as const) {
  test(`${name}: writeAtomic, read, exists, list`, async () => {
    const { fs, root } = await make();
    const file = join(root, 'a', 'b.txt');
    assert.equal(await fs.exists(file), false);
    await fs.writeAtomic(file, 'hello');
    assert.equal(await fs.exists(file), true);
    assert.equal(text(await fs.read(file)), 'hello');
    assert.equal(await fs.exists(`${file}.tmp`), false);
    assert.deepEqual(await fs.list(join(root, 'a')), ['b.txt']);
    assert.deepEqual(await fs.list(join(root, 'missing')), []);
  });

  test(`${name}: remove is recursive and tolerates missing paths`, async () => {
    const { fs, root } = await make();
    await fs.writeAtomic(join(root, 'd', 'x.jpg'), 'x');
    await fs.writeAtomic(join(root, 'd', 'sub', 'y.jpg'), 'y');
    await fs.remove(join(root, 'd'));
    assert.equal(await fs.exists(join(root, 'd', 'x.jpg')), false);
    assert.equal(await fs.exists(join(root, 'd', 'sub', 'y.jpg')), false);
    await fs.remove(join(root, 'nope'));
  });

  test(`${name}: copy copies files and directories`, async () => {
    const { fs, root } = await make();
    await fs.writeAtomic(join(root, 'src', 'Contents', 'Info.plist'), 'plist');
    await fs.copy(join(root, 'src'), join(root, 'dst'));
    assert.equal(text(await fs.read(join(root, 'dst', 'Contents', 'Info.plist'))), 'plist');
    await fs.copy(join(root, 'src', 'Contents', 'Info.plist'), join(root, 'one.plist'));
    assert.equal(text(await fs.read(join(root, 'one.plist'))), 'plist');
  });

  test(`${name}: freeBytes reports a non-negative number`, async () => {
    const { fs, root } = await make();
    assert.ok((await fs.freeBytes(root)) >= 0);
  });
}

test('MemoryFileSystem records write order and has settable free space', async () => {
  const fs = new MemoryFileSystem();
  await fs.writeAtomic('/x/1', 'a');
  await fs.writeAtomic('/x/2', 'b');
  assert.deepEqual(fs.writeLog, ['/x/1', '/x/2']);
  fs.free = 42;
  assert.equal(await fs.freeBytes('/x'), 42);
});

test('MemoryFileSystem.read throws for a missing file', async () => {
  await assert.rejects(new MemoryFileSystem().read('/missing'));
});
