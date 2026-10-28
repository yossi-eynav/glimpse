// Stand-in for native/helper (pw-helper) in tests. Speaks contracts/wallpaper-helper.md over stdio
// and never touches the real wallpaper. Behaviour is driven by FAKE_HELPER_* environment variables.
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const env = process.env;
const send = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);
let current = null;
let restoreTargets = null;
let emittedExternal = false;

send({ event: 'ready', version: Number(env.FAKE_HELPER_VERSION ?? 1) });

createInterface({ input: process.stdin }).on('line', (line) => {
  if (env.FAKE_HELPER_LOG) appendFileSync(env.FAKE_HELPER_LOG, `${line}\n`);
  const req = JSON.parse(line);
  if (env.FAKE_HELPER_CRASH_ON === req.cmd) process.exit(1);
  if (env.FAKE_HELPER_SILENT_ON === req.cmd) return;
  if (env.FAKE_HELPER_FAIL_ON === req.cmd) return send({ id: req.id, ok: false, error: 'boom' });

  if (req.cmd === 'show') {
    current = req.path;
    restoreTargets = null;
    send({ id: req.id, ok: true });
    if (env.FAKE_HELPER_EMIT_EXTERNAL === '1' && !emittedExternal) {
      emittedExternal = true;
      setTimeout(() => send({ event: 'externalChange', paths: ['/Users/x/Pictures/cat.jpg'] }), 50);
    }
  } else if (req.cmd === 'restore') {
    current = null;
    restoreTargets = req.paths;
    send({ id: req.id, ok: true, restored: req.paths.length });
  } else if (req.cmd === 'get') {
    send({ id: req.id, ok: true, paths: [current ?? restoreTargets?.[0] ?? '/System/Library/CoreServices/DefaultDesktop.heic'] });
  } else if (req.cmd === 'clear') {
    current = null;
    send({ id: req.id, ok: true });
  }
});

process.stdin.on('end', () => process.exit(0));
