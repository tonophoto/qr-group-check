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

const firebaseConfig = {
  apiKey: 'AIzaSyDs-DC5EpcgaNsYN8F5zy4D98k5zfB8KV8',
  authDomain: 'school-trip-chat.firebaseapp.com',
  projectId: 'school-trip-chat',
  storageBucket: 'school-trip-chat.firebasestorage.app',
  messagingSenderId: '69261895871',
  appId: '1:69261895871:web:db880a765de328ca49be0a',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

try { await setPersistence(auth, browserLocalPersistence); } catch {}

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

function showUserBar(user) {
  document.querySelector('.auth-user-bar')?.remove();
  const bar = document.createElement('div');
  bar.className = 'auth-user-bar';
  const name = user.displayName || user.email || 'ログイン中';
  bar.innerHTML = `<span></span><button type="button">ログアウト</button>`;
  bar.querySelector('span').textContent = name;
  bar.querySelector('button').addEventListener('click', async () => {
    await signOut(auth);
  });
  document.body.appendChild(bar);
}

onAuthStateChanged(auth, (user) => {
  document.querySelector('.auth-gate')?.remove();
  document.querySelector('.auth-user-bar')?.remove();
  if (!user) {
    showLogin();
    return;
  }
  document.documentElement.classList.remove('auth-pending');
  showUserBar(user);
});
