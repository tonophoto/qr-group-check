import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
test('Hosting only uses allowlisted output, not repository root', () => {
  const hosting = JSON.parse(read('firebase.json'));
  assert.equal(hosting.hosting.public, 'dist-qr');
  const build = read('scripts/build-qr-public.mjs');
  assert.match(build, /const allow = \[/);
  assert.match(build, /'members.html'/);
  assert.match(build, /'group-sync.js'/);
  assert.match(build, /'\.git'/);
  assert.doesNotMatch(build, /cpSync\(root, out/);
});
test('QR group page is isolated from photography UI', () => {
  const index = read('index.html');
  assert.doesNotMatch(index, /href="\.\/photography\.html"/);
  assert.match(index, /sharedSyncStatus/);
  assert.match(index, /members\.html/);
  assert.doesNotMatch(index, /localStorage\.setItem\(k/);
});
test('authorized members load shared adapter before legacy QR UI', () => {
  const gate = read('auth-gate.js');
  assert.ok(gate.indexOf("'./group-sync.js") < gate.indexOf("'./app.js"));
  assert.match(gate, /members: new Set\(\['admin'\]\)/);
});
test('the shared check path and server ACK guard remain in place', () => {
  const sync = read('group-sync.js');
  const app = read('app.js');
  assert.match(sync, /'qrTrips', tripId, 'groupRounds', id, 'checks', code/);
  assert.match(sync, /fs\.runTransaction/);
  assert.match(sync, /fs\.getDocFromServer\(controlRef\)/);
  assert.match(sync, /!snapshot\.metadata\.fromCache/);
  assert.match(app, /await groupSync\.register\(state\.roundId, code\)/);
  assert.doesNotMatch(app, /state\.checks\.push\(/);
  assert.doesNotMatch(app, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(state\)\)/);
});
