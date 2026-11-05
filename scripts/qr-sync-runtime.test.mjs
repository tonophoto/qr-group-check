import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { test } from 'node:test';

async function harness() {
  const watches = [], updates = [], errors = [];
  const events = new EventTarget();
  const window = { addEventListener: (...a) => events.addEventListener(...a), removeEventListener: (...a) => events.removeEventListener(...a) };
  const fs = {
    getFirestore: () => ({}), doc: (...a) => a.slice(1).join('/'), collection: (...a) => a.slice(1).join('/'),
    onSnapshot(ref, options, next, error) {
      const watch = { ref, next, error, active: true }; watches.push(watch);
      return () => { watch.active = false; };
    }
  };
  let source = process.env.QR_VERIFY_BASELINE === '1'
    ? execFileSync('git', ['show', '16fda7abfbfe690e5113051feb69eb26ebd9368b:group-sync.js'], { encoding: 'utf8' })
    : readFileSync(new URL('../group-sync.js', import.meta.url), 'utf8');
  source = source.replace('import(APP)', 'Promise.resolve(__app)').replace('import(SDK)', 'Promise.resolve(__fs)');
  const context = vm.createContext({ window, navigator: { onLine: true }, __app: { getApp: () => ({}) }, __fs: fs, console, Event });
  vm.runInContext(source, context);
  const session = await window.QRGroupSync.connect({ tripId: 'trip-a', uid: 'teacher-a', role: 'teacher' }, u => updates.push(u), e => errors.push(e));
  const snapshot = (data, fromCache = false, hasPendingWrites = false) => ({ exists: () => data !== null, data: () => data, metadata: { fromCache, hasPendingWrites } });
  const control = (id, cache = false, pending = false) => watches[0].next(snapshot(id ? { roundId: id } : null, cache, pending));
  const latest = suffix => watches.filter(w => w.ref.endsWith(suffix)).at(-1);
  const round = id => latest('/groupRounds/' + id).next(snapshot({ status: 'active' }));
  const checks = (id, cache = false, pending = false) => latest('/groupRounds/' + id + '/checks').next({ metadata: { fromCache: cache, hasPendingWrites: pending }, docs: [{ id: 'A-1', data: () => ({ status: 'checked', checkedAt: { toDate: () => new Date(0) } }) }] });
  return { watches, updates, errors, session, control, round, checks, latest, context, events };
}
test('same-round metadata updates retain exactly one pair of child watches', async () => {
  const h = await harness(); h.control('r1'); h.round('r1'); h.checks('r1');
  assert.equal(h.updates.at(-1).confirmed, true);
  h.control('r1', true); assert.equal(h.updates.at(-1).confirmed, false);
  h.control('r1'); assert.equal(h.updates.at(-1).confirmed, true);
  assert.equal(h.watches.length, 3);
  assert.equal(h.watches.filter(w => w.active).length, 3);
  h.session.dispose();
});
test('cached and pending checks never announce checked groups; ACK restores them', async () => {
  const h = await harness(); h.control('r1'); h.round('r1');
  for (const meta of [[true, false], [false, true]]) {
    h.checks('r1', ...meta); assert.equal(h.updates.at(-1).confirmed, false); assert.equal(h.updates.at(-1).checks.length, 0);
  }
  h.checks('r1'); assert.equal(h.updates.at(-1).confirmed, true); assert.equal(h.updates.at(-1).checks.length, 1);
  h.session.dispose();
});
test('listener failure clears checked groups and ends the session', async () => {
  const h = await harness(); h.control('r1'); h.round('r1'); h.checks('r1');
  h.latest('/checks').error(new Error('permission-denied'));
  assert.equal(h.updates.at(-1).confirmed, false); assert.equal(h.updates.at(-1).checks.length, 0);
  assert.equal(h.errors.length, 1);
  await assert.rejects(h.session.register('r1', 'A-1'), /qr-session-ended/);
  h.session.dispose();
});
test('old-round snapshots/errors and disposed sessions cannot affect the new view', async () => {
  const h = await harness(); h.control('r1'); h.round('r1'); h.checks('r1');
  const old = h.latest('/checks'); h.control('r2'); h.round('r2'); h.checks('r2');
  old.error(new Error('late error')); assert.equal(h.errors.length, 0); assert.equal(h.updates.at(-1).roundId, 'r2');
  h.session.dispose(); const count = h.updates.length; old.next({ metadata: { fromCache: false, hasPendingWrites: false }, docs: [] });
  assert.equal(h.updates.length, count); assert.equal(h.watches.filter(w => w.active).length, 0);
  await assert.rejects(h.session.register('r2', 'A-1'), /qr-session-ended/);
});
test('offline immediately hides a previously confirmed check', async () => {
  const h = await harness(); h.control('r1'); h.round('r1'); h.checks('r1');
  h.context.navigator.onLine = false; h.events.dispatchEvent(new Event('offline'));
  assert.equal(h.updates.at(-1).confirmed, false); assert.equal(h.updates.at(-1).checks.length, 0);
  h.session.dispose();
});
