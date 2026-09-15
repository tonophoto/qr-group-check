(() => {
  if (document.documentElement.dataset.authPage !== 'photography') return;
  const access = window.QRAccess;
  if (!access || !['photographer', 'admin'].includes(access.role)) return;
  if (typeof state === 'undefined' || typeof record !== 'function' || typeof save !== 'function' || typeof render !== 'function') return;

  const notice = document.querySelector('.notice-card');
  const noticeTitle = notice?.querySelector('strong');
  const noticeText = notice?.querySelector('p');

  const setNotice = (title, text) => {
    if (noticeTitle) noticeTitle.textContent = title;
    if (noticeText) noticeText.textContent = text;
  };

  function normalizeCapturedAt(value) {
    if (value?.toDate) return value.toDate().toISOString();
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }

  function sortEvents(events) {
    return [...events].sort((a, b) => {
      const at = new Date(a.capturedAt || 0).getTime();
      const bt = new Date(b.capturedAt || 0).getTime();
      if (at !== bt) return at - bt;
      return String(a.eventId || '').localeCompare(String(b.eventId || ''));
    });
  }

  function sanitizeSessionGroups(value) {
    if (!Array.isArray(value) || value.length === 0) return [3];
    return value.slice(0, 14).map((n) => Math.max(1, Math.min(8, Number(n) || 1)));
  }

  if (state.tripId !== access.tripId) {
    state.tripId = access.tripId;
    state.sessionId = '';
    state.status = 'idle';
    state.events = [];
  }
  state.photographerId = access.uid;
  if (!state.photographerName) state.photographerName = access.displayName || access.email || '撮影者';
  save();
  render();

  if (typeof els !== 'undefined' && els?.clearBtn) {
    els.clearBtn.hidden = false;
    els.clearBtn.textContent = '新しい撮影チェック';
  }

  let firestoreApi = null;
  let db = null;
  let collectionRef = null;
  let sessionRef = null;
  let unsubscribeChecks = null;
  let unsubscribeSession = null;
  let ready = false;
  let currentSession = null;
  let remoteEventsCache = [];

  function currentSessionEvents() {
    if (!state.sessionId) return [];
    return remoteEventsCache.filter((event) => event.sessionId === state.sessionId);
  }

  function mergeRemoteEvents() {
    const remoteEvents = currentSessionEvents();
    const remoteById = new Map(remoteEvents.map((event) => [event.eventId, event]));
    const localOnly = state.events.filter((event) => (
      event.sessionId === state.sessionId && !remoteById.has(event.eventId)
    ));
    state.events = sortEvents([...remoteEvents, ...localOnly]);
    save();
    render();
  }

  async function applySession(session) {
    const previousStatus = state.status;
    const previousSessionId = state.sessionId || '';

    if (!session) {
      state.sessionId = '';
      state.status = 'idle';
      state.events = [];
      save();
      render();
      if (previousStatus === 'active') await stopScanner();
      return;
    }

    const nextSessionId = String(session.sessionId || '');
    const sessionChanged = nextSessionId && nextSessionId !== previousSessionId;
    if (sessionChanged) {
      state.sessionId = nextSessionId;
      state.events = [];
    }

    state.classMode = session.classMode === 'numeric' ? 'numeric' : 'alpha';
    state.classGroups = sanitizeSessionGroups(session.classGroups);
    state.status = session.status === 'ended' ? 'ended' : 'active';
    mergeRemoteEvents();

    if (state.status === 'active') {
      setNotice('Firestore共有・共同チェック中', '開始状態・対象班・撮影履歴を同じ旅行の撮影者全員で共有しています。');
      if (previousStatus !== 'active' || sessionChanged || !scanner) {
        cameraPaused = false;
        render();
        await startScanner();
      }
    } else {
      setNotice('Firestore共有・チェック終了', 'この撮影チェックは終了しました。再開すると全端末に反映されます。');
      cameraPaused = false;
      render();
      if (previousStatus === 'active') await stopScanner();
    }
  }

  async function uploadEvent(event) {
    if (!firestoreApi || !db || !collectionRef || !currentSession || currentSession.status !== 'active') return;
    if (!event || event.photographerId !== access.uid) return;
    if (!state.sessionId || event.sessionId !== state.sessionId) return;

    const payload = {
      eventId: String(event.eventId),
      sessionId: String(event.sessionId),
      groupCode: String(event.groupCode),
      photographerId: access.uid,
      photographerName: String(event.photographerName || access.displayName || access.email || '撮影者'),
      capturedAt: String(event.capturedAt),
      source: String(event.source || 'camera'),
    };

    try {
      event.syncStatus = 'syncing';
      save();
      await firestoreApi.setDoc(firestoreApi.doc(collectionRef, payload.eventId), payload);
      const local = state.events.find((item) => item.eventId === payload.eventId);
      if (local) local.syncStatus = 'synced';
      save();
      setNotice('Firestore共有・共同チェック中', '開始状態・対象班・撮影履歴を同じ旅行の撮影者全員で共有しています。');
    } catch (error) {
      console.error('photo check sync failed', error);
      const local = state.events.find((item) => item.eventId === payload.eventId);
      if (local) local.syncStatus = 'error';
      save();
      setNotice('Firestore同期エラー・端末内には保存済み', '通信復旧後に再読み込みしてください。撮影記録はこの端末には残っています。');
    }
  }

  record = function syncedRecord(raw, source) {
    if (state.status !== 'active' || !state.sessionId || scanLocked) return;
    const code = norm(raw);
    const groups = new Set(configuredGroups());
    scanLocked = true;

    if (!code || !groups.has(code)) {
      show('error', code, '今回の対象班ではありません', '');
      try { navigator.vibrate?.([120, 60, 120]); } catch {}
      setTimeout(() => { scanLocked = false; }, 900);
      return;
    }

    const now = Date.now();
    const recentOwn = [...state.events].reverse().find((event) => (
      event.sessionId === state.sessionId
      && event.groupCode === code
      && event.photographerId === access.uid
    ));
    if (recentOwn && now - new Date(recentOwn.capturedAt).getTime() < 5000) {
      setTimeout(() => { scanLocked = false; }, 700);
      return;
    }

    const event = {
      eventId: id(),
      sessionId: state.sessionId,
      groupCode: code,
      photographerId: access.uid,
      photographerName: state.photographerName || access.displayName || access.email || '撮影者',
      capturedAt: new Date().toISOString(),
      source,
      syncStatus: 'pending',
    };

    state.events.push(event);
    state.events = sortEvents(state.events);
    save();
    const count = state.events.filter((item) => item.sessionId === state.sessionId && item.groupCode === code).length;
    render();
    show('success', code, `撮影チェック ${count}回目`, `${event.photographerName}・${time(event.capturedAt)}`);
    try { navigator.vibrate?.(70); } catch {}
    uploadEvent(event);
    setTimeout(() => { scanLocked = false; }, 900);
  };

  async function beginSharedSession() {
    const name = els.photographerName.value.trim();
    if (!name) {
      alert('カメラマン名を入力してください');
      return;
    }
    state.photographerName = name;
    save();
    if (!ready || !firestoreApi || !sessionRef) {
      setNotice('Firestore接続中', '共有セッションの準備ができるまで少し待ってください。');
      return;
    }

    try {
      await firestoreApi.runTransaction(db, async (tx) => {
        const snap = await tx.get(sessionRef);
        const existing = snap.exists() ? snap.data() : null;
        if (existing?.status === 'active') return;
        tx.set(sessionRef, {
          sessionId: id(),
          status: 'active',
          classMode: state.classMode === 'numeric' ? 'numeric' : 'alpha',
          classGroups: sanitizeSessionGroups(state.classGroups),
          startedAt: firestoreApi.serverTimestamp(),
          startedBy: access.uid,
          startedByName: name,
          endedAt: null,
          endedBy: null,
        });
      });
    } catch (error) {
      console.error('photo session start failed', error);
      setNotice('共有チェックを開始できません', '通信状態またはFirestore権限を確認してください。');
    }
  }

  async function endSharedSession() {
    if (!ready || !firestoreApi || !sessionRef || !state.sessionId) return;
    if (!confirm('撮影チェックを終了しますか？\n他の撮影者の端末も終了します。')) return;
    try {
      await firestoreApi.runTransaction(db, async (tx) => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.sessionId !== state.sessionId || data.status !== 'active') return;
        tx.update(sessionRef, {
          status: 'ended',
          endedAt: firestoreApi.serverTimestamp(),
          endedBy: access.uid,
        });
      });
    } catch (error) {
      console.error('photo session end failed', error);
      setNotice('共有チェックを終了できません', '通信状態またはFirestore権限を確認してください。');
    }
  }

  async function resumeSharedSession() {
    if (!ready || !firestoreApi || !sessionRef || !state.sessionId) return;
    try {
      await firestoreApi.runTransaction(db, async (tx) => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.sessionId !== state.sessionId || data.status !== 'ended') return;
        tx.update(sessionRef, {
          status: 'active',
          endedAt: null,
          endedBy: null,
        });
      });
    } catch (error) {
      console.error('photo session resume failed', error);
      setNotice('共有チェックを再開できません', '通信状態またはFirestore権限を確認してください。');
    }
  }

  async function prepareNewSharedSession() {
    if (state.status !== 'ended') return;
    state.sessionId = '';
    state.status = 'idle';
    state.events = [];
    save();
    render();
    setNotice('新しい共有チェックの準備', '対象クラス・班を設定して開始すると、全撮影者に共有されます。');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function intercept(button, handler) {
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, { capture: true });
  }

  intercept(els?.startBtn, beginSharedSession);
  intercept(els?.endBtn, endSharedSession);
  intercept(els?.resumeBtn, resumeSharedSession);
  intercept(els?.clearBtn, prepareNewSharedSession);

  async function boot() {
    try {
      const [{ getApp }, firestore] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
      ]);
      firestoreApi = firestore;
      db = firestore.getFirestore(getApp());
      collectionRef = firestore.collection(db, 'qrTrips', access.tripId, 'photoChecks');
      sessionRef = firestore.doc(db, 'qrTrips', access.tripId, 'photoSession', 'current');

      setNotice('Firestore接続中', '共有セッションと撮影履歴を読み込んでいます。');

      unsubscribeChecks = firestore.onSnapshot(
        collectionRef,
        (snapshot) => {
          remoteEventsCache = snapshot.docs.map((snap) => {
            const data = snap.data() || {};
            return {
              eventId: String(data.eventId || snap.id),
              sessionId: String(data.sessionId || ''),
              groupCode: String(data.groupCode || ''),
              photographerId: String(data.photographerId || ''),
              photographerName: String(data.photographerName || ''),
              capturedAt: normalizeCapturedAt(data.capturedAt),
              source: String(data.source || 'camera'),
              syncStatus: 'synced',
            };
          });
          mergeRemoteEvents();
        },
        (error) => {
          console.error('photo check listener failed', error);
          setNotice('Firestore同期エラー・端末内保存', '共有履歴を読み込めません。撮影記録はこの端末には保存されます。');
        },
      );

      unsubscribeSession = firestore.onSnapshot(
        sessionRef,
        async (snapshot) => {
          currentSession = snapshot.exists() ? snapshot.data() : null;
          ready = true;
          await applySession(currentSession);
          const pending = state.events.filter((event) => (
            event.sessionId === state.sessionId
            && event.photographerId === access.uid
            && ['pending', 'error'].includes(event.syncStatus)
          ));
          pending.forEach((event) => uploadEvent(event));
        },
        (error) => {
          console.error('photo session listener failed', error);
          ready = false;
          setNotice('共有セッション同期エラー', '開始・終了状態を共有できません。通信状態またはFirestore権限を確認してください。');
        },
      );
    } catch (error) {
      console.error('photo check sync init failed', error);
      setNotice('Firestore同期エラー・端末内保存', '共有機能を初期化できません。撮影記録はこの端末には保存されます。');
    }
  }

  window.addEventListener('pagehide', () => {
    try { unsubscribeChecks?.(); } catch {}
    try { unsubscribeSession?.(); } catch {}
  });

  boot();
})();
