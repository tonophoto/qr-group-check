// Loaded before Firebase CLI, verifier and Functions child runtimes.
// Block before DNS/socket creation, including Node fetch, http(s) and gRPC.
const net = require('node:net');
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const allowed = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '::ffff:127.0.0.1']);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  const host = typeof options === 'object' ? options.host : (typeof args[1] === 'string' ? args[1] : 'localhost');
  const pipe = typeof options === 'object' ? options.path : (typeof options === 'string' && !/^\d+$/.test(options) ? options : null);
  if (pipe) {
    // Local named pipes used by esbuild/Node IPC are not network endpoints.
    if (process.platform === 'win32' && !pipe.startsWith('\\\\.\\pipe\\') && !pipe.startsWith('\\\\?\\pipe\\')) {
      throw new Error('Test network: nonlocal pipe blocked');
    }
  } else if (!allowed.has(host || 'localhost')) {
    throw new Error('Test network: external connection blocked');
  }
  return connect.apply(this, args);
};
process.env.ANTIDISC_NETWORK_GUARD_ACTIVE = '1';
// Firebase discovery deliberately rebuilds its child env. Carry ONLY these
// already-isolated process settings through that boundary as well.
const spawn = childProcess.spawn;
childProcess.spawn = function (command, args, options) {
  if (args && !Array.isArray(args)) { options = args; args = []; }
  const safeOptions = { ...options, env: { ...(options?.env || process.env) } };
  for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME',
    'CLOUDSDK_CONFIG', 'GOOGLE_APPLICATION_CREDENTIALS', 'GCE_METADATA_HOST',
    'METADATA_SERVER_DETECTION', 'NODE_OPTIONS', 'ANTIDISC_SAFE_EMULATOR']) {
    if (process.env.ANTIDISC_SAFE_EMULATOR === '1' && process.env[key]) safeOptions.env[key] = process.env[key];
  }
  return spawn.call(this, command, args, safeOptions);
};
syncBuiltinESMExports();
