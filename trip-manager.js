import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDs-DC5EpcgaNsYN8F5zy4D98k5zfB8KV8',
  authDomain: 'school-trip-chat.firebaseapp.com',
  projectId: 'school-trip-chat',
  storageBucket: 'school-trip-chat.firebasestorage.app',
  messagingSenderId: '69261895871',
  appId: '1:69261895871:web:db880a765de328ca49be0a',
};

const app = initializeApp(firebaseConfig, 'qr-trip-manager');
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
try { await setPersistence(auth, browserLocalPersistence); } catch {}

const appRoot = document.getElementById('tripManagerApp');
const loginRoot = document.getElementById('tripManagerLogin');
const loginBtn = document.getElementById('tripManagerLoginBtn');
const loginStatus = document.getElementById('tripManagerLoginStatus');
const statusEl = document.getElementById('tripManagerStatus');
const tripList = document.getElementById('tripList');
const tripCount = document.getElementById('tripCount');
let unsubscribeTrips = null;
let currentUser = null;

function setLoginStatus(message, isError = false) {
  loginStatus.textContent = message || '';
  loginStatus.classList.toggle('manager-status-error', isError);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('manager-status-error', isError);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeTripId(value) {
  return String(value || '').trim().toLowerCase();
}

function validTripId(value) {
  return /^[a-z0-9][a-z0-9-]{2,79}$/.test(value);
}

function toDateText(value) {
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return '';
  }
}

function renderTrips(snapshot) {
  const trips = snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .sort((a, b) => {
      if ((a.status === 'active') !== (b.status === 'active')) return a.status === 'active' ? -1 : 1;
      return String(a.name || a.id).localeCompare(String(b.name || b.id), 'ja');
    });

  tripCount.textContent = `${trips.length}件`;
  tripList.innerHTML = trips.length ? trips.map((trip) => {
    const id = escapeHtml(trip.id);
    const name = escapeHtml(trip.name || trip.id);
    const active = trip.status !== 'ended';
    const created = toDateText(trip.createdAt);
    const ended = toDateText(trip.endedAt);
    return `
      <div class="trip-row" data-trip-id="${id}" data-trip-status="${active ? 'active' : 'ended'}">
        <div class="trip-main">
          <span class="trip-status ${active ? 'trip-status-active' : 'trip-status-ended'}">${active ? '運用中' : '終了済み'}</span>
          <strong>${name}</strong>
          <code>${id}</code>
          <span class="trip-meta">${created ? `作成: ${escapeHtml(created)}` : ''}${ended ? ` / 終了: ${escapeHtml(ended)}` : ''}</span>
        </div>
        <div class="trip-controls">
          <a class="btn btn-secondary" href="./admin-check.html?trip=${encodeURIComponent(trip.id)}">参加者管理</a>
          <a class="btn btn-secondary" href="./photography.html?trip=${encodeURIComponent(trip.id)}">撮影チェック</a>
          <button class="btn ${active ? 'btn-danger' : 'btn-primary'} trip-status-toggle" type="button">${active ? '旅行を終了' : '旅行を再開'}</button>
        </div>
      </div>`;
  }).join('') : '<p class="muted">旅行はまだありません。</p>';
}

async function ensureServiceAdmin(user) {
  const snap = await getDocFromServer(doc(db, 'qrServiceAdmins', user.uid));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  if (data.disabled === true) return null;
  return data;
}

async function startManager(user) {
  const serviceAdmin = await ensureServiceAdmin(user);
  if (!serviceAdmin) {
    currentUser = null;
    appRoot.hidden = true;
    loginRoot.hidden = false;
    setLoginStatus('このGoogleアカウントにはQRサービス管理者権限がありません。', true);
    return;
  }

  currentUser = user;
  loginRoot.hidden = true;
  appRoot.hidden = false;
  setStatus('旅行一覧を同期しています…');
  unsubscribeTrips?.();
  unsubscribeTrips = onSnapshot(
    collection(db, 'qrTrips'),
    (snapshot) => {
      renderTrips(snapshot);
      setStatus('最新の状態です。');
    },
    (error) => {
      console.error('trip list sync failed', error);
      setStatus(`旅行一覧を読み込めません。（${error?.code || 'unknown-error'}）`, true);
    },
  );
}

loginBtn.addEventListener('click', async () => {
  loginBtn.disabled = true;
  setLoginStatus('Googleログイン中…');
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('trip manager login failed', error);
    setLoginStatus(`ログインできませんでした。（${error?.code || 'unknown-error'}）`, true);
    loginBtn.disabled = false;
  }
});

document.getElementById('tripManagerLogout')?.addEventListener('click', async () => {
  unsubscribeTrips?.();
  unsubscribeTrips = null;
  await signOut(auth);
});

document.getElementById('tripCreateForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const form = event.currentTarget;
  const tripId = normalizeTripId(form.elements.tripId.value);
  const name = form.elements.name.value.trim();
  const submit = form.querySelector('button[type="submit"]');
  if (!validTripId(tripId)) {
    setStatus('旅行コードは3〜80文字の半角英小文字・数字・ハイフンで入力してください。', true);
    return;
  }
  if (!name) {
    setStatus('旅行名を入力してください。', true);
    return;
  }

  submit.disabled = true;
  try {
    const tripRef = doc(db, 'qrTrips', tripId);
    const existing = await getDocFromServer(tripRef);
    if (existing.exists()) {
      setStatus('同じ旅行コードがすでに存在します。', true);
      return;
    }

    const batch = writeBatch(db);
    batch.set(tripRef, {
      name,
      status: 'active',
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
      endedAt: null,
      endedBy: null,
    });
    batch.set(doc(db, 'qrTrips', tripId, 'members', currentUser.uid), {
      role: 'admin',
      displayName: currentUser.displayName || currentUser.email || 'サービス管理者',
      email: currentUser.email || '',
      disabled: false,
    });
    await batch.commit();
    form.reset();
    setStatus(`${name} を作成しました。あなたを旅行管理者として登録しました。`);
  } catch (error) {
    console.error('trip create failed', error);
    setStatus(`旅行を作成できません。（${error?.code || 'unknown-error'}）`, true);
  } finally {
    submit.disabled = false;
  }
});

tripList?.addEventListener('click', async (event) => {
  const button = event.target.closest('.trip-status-toggle');
  if (!button || !currentUser) return;
  const row = button.closest('.trip-row');
  const tripId = row?.dataset.tripId;
  const status = row?.dataset.tripStatus;
  if (!tripId || !status) return;
  const ending = status === 'active';
  if (ending && !confirm(`${tripId} を終了済みにしますか？`)) return;

  button.disabled = true;
  try {
    await updateDoc(doc(db, 'qrTrips', tripId), ending ? {
      status: 'ended',
      endedAt: serverTimestamp(),
      endedBy: currentUser.uid,
    } : {
      status: 'active',
      endedAt: null,
      endedBy: null,
    });
    setStatus(ending ? `${tripId} を終了済みにしました。` : `${tripId} を再開しました。`);
  } catch (error) {
    console.error('trip lifecycle update failed', error);
    setStatus(`旅行状態を変更できません。（${error?.code || 'unknown-error'}）`, true);
  } finally {
    button.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  unsubscribeTrips?.();
  unsubscribeTrips = null;
  if (!user) {
    currentUser = null;
    appRoot.hidden = true;
    loginRoot.hidden = false;
    loginBtn.disabled = false;
    setLoginStatus('');
    return;
  }
  try {
    await startManager(user);
  } catch (error) {
    console.error('trip manager init failed', error);
    appRoot.hidden = true;
    loginRoot.hidden = false;
    setLoginStatus(`管理者権限を確認できません。（${error?.code || 'unknown-error'}）`, true);
    loginBtn.disabled = false;
  }
});

window.addEventListener('pagehide', () => unsubscribeTrips?.());
