import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
process.chdir(root);
const cache = process.env.FIREBASE_EMULATORS_PATH || path.join(os.homedir(), '.cache/firebase/emulators');
const cli = process.env.QR_TEST_FIREBASE_CLI || path.join(process.env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const sdk = process.env.QR_TEST_FIREBASE_ROOT || path.join(os.homedir(), 'projects/antidisc');
const browserRoot = process.env.QR_TEST_BROWSER_ROOT || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node');
if (!existsSync(cli) || !existsSync(cache) || !existsSync(path.join(sdk, 'node_modules/firebase/package.json'))) throw new Error('Existing CLI/cache/Firebase SDK required; no automatic install or login');
mkdirSync('.local-verify', { recursive: true });
const profile = mkdtempSync(path.resolve('.local-verify/profile-'));
copyFileSync('verification/firestore.qr-only.rules', '.local-verify/firestore.qr-only.rules');
copyFileSync('verification/storage.deny.rules', '.local-verify/storage.deny.rules');
const ports = {};
for (const key of ['auth','firestore','storage','hub','logging']) {
  const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  ports[key] = server.address().port; await new Promise(r => server.close(r));
}
writeFileSync('.local-verify/firebase.json', JSON.stringify({
  firestore: { rules: 'firestore.qr-only.rules' }, storage: { rules: 'storage.deny.rules' },
  emulators: { ...Object.fromEntries(Object.entries(ports).map(([key,port]) => [key,{host:'127.0.0.1',port}])), ui:{enabled:false}, singleProjectMode:true }
}, null, 2));
const env = {};
for (const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','ComSpec','PATHEXT','JAVA_HOME','TEMP','TMP']) if (process.env[key]) env[key] = process.env[key];
Object.assign(env, {
  HOME:profile, USERPROFILE:profile, APPDATA:profile, LOCALAPPDATA:profile, XDG_CONFIG_HOME:profile, CLOUDSDK_CONFIG:profile,
  GOOGLE_APPLICATION_CREDENTIALS:path.join(profile,'no-credentials.json'), GCE_METADATA_HOST:'127.0.0.1:1', METADATA_SERVER_DETECTION:'none',
  JAVA_TOOL_OPTIONS:`-Duser.home="${profile}" -Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=1 -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=1 -Dhttp.nonProxyHosts="localhost|127.*|[::1]"`,
  FIREBASE_EMULATORS_PATH:cache, FIREBASE_CLI_NO_UPDATE_NOTIFIER:'true', CI:'true', ANTIDISC_SAFE_EMULATOR:'1',
  NODE_OPTIONS:`--require "${path.resolve('scripts/qr-local-network.cjs').replaceAll('\\','/')}"`,
  QR_TEST_FIREBASE_ROOT:sdk, QR_TEST_BROWSER_ROOT:browserRoot,
  QR_TEST_PROJECT:'demo-qr-pr11', QR_TEST_PORTS:JSON.stringify(ports),
  QR_TEST_BROWSER:process.argv.includes('--browser')?'1':'0',
  PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(),'AppData/Local/ms-playwright')
});
console.log('[QR isolation] demo project; loopback-only Node sockets; isolated credentials/profile; Auth/Firestore/Storage only');
const child = spawn(process.execPath, [cli,'emulators:exec','--project','demo-qr-pr11','--config','.local-verify/firebase.json','--only','auth,firestore,storage','node scripts/verify-qr-shared-sync.mjs'], {cwd:root,env,shell:false,stdio:'inherit'});
child.on('error', e => { console.error(e.message); process.exitCode=1; });
child.on('exit', code => { process.exitCode=code??1; });
