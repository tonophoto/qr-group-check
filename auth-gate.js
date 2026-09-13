import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  doc,
  getDoc,
  getFirestore,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDs-DC5EpcgaNsYN8F5zy4D98k5zfB8KV8',
  authDomain: 'school-trip-chat.firebaseapp.com',
  projectId: 'school-trip-chat',
  storageBucket: 'school-trip-chat.firebasestorage.app',
  messagingSenderId: '69261895871',
  appId: '1:69261895871:web:db880a765de328ca49be0a',
};

const TRIP_STORAGE_KEY = 'qr-group-active-trip-v1';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
let protectedAppLoaded = false;

const pageScripts = {
  group: [
    'https://unpkg.com/html5-qrcode',
    './app.js?v=20260913-4',
    './group-audio-fix.js?v=20260913-1',
    './photography-effects.js?v=20260913-6',
    './group-effects.js?v=20260913-1',
    './status.js?v=20260913-4',
  ],
  photography: [
    'https://unpkg.com/html5-qrcode',
    './photography.js?v=20260913-3',
    './photography-sounds.js?v=20260913-3',
    './photography-audio.js?v=20260913-5',
    './photography-effects.js?v=20260913-5',
    './photography-summary.js?v=20260913-3',
    './photography-manual.js?v=20260913-2',
    './admin-entry.js?v=20260913-2',
  ],
  admin: [
    './photography-sounds.js?v=20260913-3',
    './photography-effects.js?v=20260913-7',
    './sound-check.js?v=20260913-1',
    './effect-check.js?v=20260913-4',
  ],
};

const pageRoles = {
  group: new Set(['teacher', 'admin']),
  photography: new Set(['photographer', 'admin']),
  admin: new Set(['admin']),
};

try { await setPersistence(auth, browserLocalPersistence); } catch {}

function appendScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadProtectedApp() {
  if (protectedAppLoaded) return;
  protectedAppLoaded = true;
  const page = document.documentElement.dataset.authPage || 'group';
  const scripts = pageScripts[page] || pageScripts.group;
  for (const src of scripts) await appendScript(src);
}

function currentTripId() {
  const fromUrl = new URLSearchParams(location.search).get('trip')?.trim();
  if (fromUrl) {
    try { localStorage.setItem(TRIP_STORAGE_KEY, fromUrl); } catch {}
    return fromUrl;
  }
  try { return localStorage.getItem(TRIP_STORAGE_KEY)?.trim() || ''; } catch { return ''; }
}

function showLogin(message = '') {
  document.querySelector('.auth-gate')?.remove();
  const gate = document.createElement('div');
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-gate-card">
      <h1>QRチェック</h1>
      <p>このページを利用するには認証が必要です。</p>
      <button class="auth-gate-btn" type="button">Googleでログイン</button>
      <div class="auth-gate-error" ${message ? '' : 'hidden'}></div>
    </div>`;
  const button = gate.querySelector('.auth-gate-btn');
  const error = gate.querySelector('.auth-gate-error');
  if (message) error.textContent = message;
  button.addEventListener('click', async () => {
    button.disabled = true;
    error.hidden = true;
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = err?.code || '';
      if (['auth/popup-blocked','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      error.hidden = false;
      error.textContent = code === 'auth/unauthorized-domain'
        ? 'このHostingドメインがFirebase Authの許可ドメインに未登録です。管理者に連絡してください。'
        : 'ログインできませんでした。もう一度お試しください。';
      button.disabled = false;
    }
  });
  document.body.appendChild(gate);
  document.documentElement.classList.remove('auth-pending');
}

function showTripEntry(user, message = '') {
  document.querySelector('.auth-gate')?.remove();
  const gate = document.createElement('div');
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-gate-card">
      <h1>旅行に参加</h1>
      <p>旅行コードを入力してください。</p>
      <input class="auth-trip-input" type="text" autocomplete="off" placeholder="旅行コード" />
      <button class="auth-gate-btn" type="button">参加する</button>
      <div class="auth-gate-error" ${message ? '' : 'hidden'}></div>
      <div class="auth-gate-meta"></div>
    </div>`;
  const input = gate.querySelector('.auth-trip-input');
  const button = gate.querySelector('.auth-gate-btn');
  const error = gate.querySelector('.auth-gate-error');
  const meta = gate.querySelector('.auth-gate-meta');
  meta.textContent = user.email || user.displayName || user.uid;
  if (message) error.textContent = message;
  button.addEventListener('click', () => {
    const tripId = input.value.trim();
    if (!tripId) return;
    try { localStorage.setItem(TRIP_STORAGE_KEY, tripId); } catch {}
    const url = new URL(location.href);
    url.searchParams.set('trip', tripId);
    location.href = url.toString();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') button.click();
  });
  document.body.appendChild(gate);
  document.documentElement.classList.remove('auth-pending');
  input.focus();
}

function showDenied(user, tripId, reason) {
  document.querySelector('.auth-gate')?.remove();
  const gate = document.createElement('div');
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-gate-card">
      <h1>この旅行には参加できません</h1>
      <p class="auth-denied-reason"></p>
      <div class="auth-gate-meta"></div>
      <button class="auth-gate-btn auth-change-trip" type="button">旅行コードを変更</button>
      <button class="auth-gate-btn auth-signout" type="button">別のGoogleアカウントでログイン</button>
    </div>`;
  gate.querySelector('.auth-denied-reason').textContent = reason;
  gate.querySelector('.auth-gate-meta').textContent = `trip: ${tripId} / uid: ${user.uid}`;
  gate.querySelector('.auth-change-trip').addEventListener('click', () => {
    try { localStorage.removeItem(TRIP_STORAGE_KEY); } catch {}
    const url = new URL(location.href);
    url.searchParams.delete('trip');
    location.href = url.toString();
  });
  gate.querySelector('.auth-signout').addEventListener('click', async () => {
    try { localStorage.removeItem(TRIP_STORAGE_KEY); } catch {}
    await signOut(auth);
    location.reload();
  });
  document.body.appendChild(gate);
  document.documentElement.classList.remove('auth-pending');
}

async function readMembership(user, tripId) {
  const snap = await getDoc(doc(db, 'qrTrips', tripId, 'members', user.uid));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    role: String(data.role || ''),
    displayName: String(data.displayName || user.displayName || ''),
    email: String(data.email || user.email || ''),
    disabled: data.disabled === true,
  };
}

function showUserBar(user, access) {
  document.querySelector('.auth-user-bar')?.remove();
  const bar = document.createElement('div');
  bar.className = 'auth-user-bar';
  const name = access.displayName || user.displayName || user.email || 'ログイン中';
  bar.innerHTML = `<span></span><button class="auth-trip-change" type="button">旅行変更</button><button class="auth-logout" type="button">ログアウト</button>`;
  bar.querySelector('span').textContent = `${name} / ${access.tripId}`;
  bar.querySelector('.auth-trip-change').addEventListener('click', () => {
    try { localStorage.removeItem(TRIP_STORAGE_KEY); } catch {}
    const url = new URL(location.href);
    url.searchParams.delete('trip');
    location.href = url.toString();
  });
  bar.querySelector('.auth-logout').addEventListener('click', async () => {
    await signOut(auth);
    location.reload();
  });
  document.body.appendChild(bar);
}

onAuthStateChanged(auth, async (user) => {
  document.querySelector('.auth-gate')?.remove();
  document.querySelector('.auth-user-bar')?.remove();
  if (!user) {
    showLogin();
    return;
  }

  const tripId = currentTripId();
  if (!tripId) {
    showTripEntry(user);
    return;
  }

  let membership;
  try {
    membership = await readMembership(user, tripId);
  } catch (error) {
    const code = error?.code || '';
    const reason = code === 'permission-denied'
      ? '参加者確認の権限設定がまだ反映されていません。管理者に連絡してください。'
      : '参加者情報を確認できませんでした。通信状態を確認してください。';
    showDenied(user, tripId, reason);
    return;
  }

  if (!membership || membership.disabled) {
    showDenied(user, tripId, 'このGoogleアカウントは、この旅行の参加者として登録されていません。');
    return;
  }

  const page = document.documentElement.dataset.authPage || 'group';
  const allowed = pageRoles[page] || pageRoles.group;
  if (!allowed.has(membership.role)) {
    showDenied(user, tripId, `この画面を利用できる権限がありません。（role: ${membership.role || '未設定'}）`);
    return;
  }

  const access = {
    tripId,
    uid: user.uid,
    role: membership.role,
    displayName: membership.displayName,
    email: membership.email,
  };
  window.QRAccess = Object.freeze(access);

  try {
    await loadProtectedApp();
    document.documentElement.classList.remove('auth-pending');
    showUserBar(user, access);
  } catch {
    showDenied(user, tripId, 'アプリの読み込みに失敗しました。再読み込みしてください。');
  }
});
