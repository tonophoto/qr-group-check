// Produce a strict allowlist of files for the QR-only Hosting site.
// Never deploy the repository root: old versions contained .git artifacts.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist-qr');
const allow = [
  'index.html', 'members.html', 'auth-gate.js', 'auth-gate.css',
  'app.js', 'group-sync.js', 'status.js', 'members.js',
  'style.css', 'group-audio-fix.js', 'group-effects.js',
  'photography-effects.js', 'photography-effects.css'
];
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of allow) {
  const input = join(root, file);
  if (!existsSync(input) || !statSync(input).isFile()) throw new Error('QR allowlist source missing: ' + file);
  cpSync(input, join(out, file));
}
const actual = readdirSync(out).sort();
if (actual.length !== allow.length || actual.some(x => !allow.includes(x))) {
  throw new Error('QR public directory contains an unexpected file');
}
for (const forbidden of ['.git', 'firebase.json', '.firebaserc', 'photography.html', 'trips.html', 'admin-check.html', 'node_modules']) {
  if (existsSync(join(out, forbidden))) throw new Error('Forbidden public path: ' + forbidden);
}
console.log('QR-only public assets prepared:', actual.join(', '));
