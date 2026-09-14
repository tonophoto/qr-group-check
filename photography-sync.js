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

  function mergeRemoteEvents(remoteEvents) {
    const remoteById = new Map(remoteEvents.map((event) => [event.eventId, event]));
    const localOnly = state.events.filter((event) => !remoteById.has(event.eventId));
    state.events = sortEvents([...remoteEvents, ...localOnly]);
    save();
    render();
  }

  if (state.tripId !== access.tripId) {
    state.tripId = access.tripId;
    state.status = 'idle';
    state.events = [];
  }
  state.photographerId = access.uid;
  if (!state.photographerName) state.photographerName = access.displayName || access.email || '撮影者';
  save();
  render();

  if (typeof els !== 'undefined' && els?.clearBtn) els.clearBtn.hidden = true;

  let firestoreApi = null;
  let db = null;
  let collectionRef = null;
  let unsubscribe = null;

  async function uploadEvent(event) {
    if (!firestoreApi || !db || !collectionRef) return;
    if (!event || event.photographerId !== access.uid) return;

    const payload = {
      eventId: String(event.eventId),
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
      setNotice('Firestore共有・複数端末同期', '同じ旅行の撮影履歴を複数カメラマン間でリアルタイム共有しています。');
    } catch (error) {
      console.error('photo check sync failed', error);
      const local = state.events.find((item) => item.eventId === payload.eventId);
      if (local) local.syncStatus = 'error';
      save();
      setNotice('Firestore同期エラー・端末内には保存済み', '通信復旧後に再読み込みしてください。撮影記録はこの端末には残っています。');
    }
  }

  record = function syncedRecord(raw, source) {
    if (state.status !== 'active' || scanLocked) return;
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
      event.groupCode === code && event.photographerId === access.uid
    ));
    if (recentOwn && now - new Date(recentOwn.capturedAt).getTime() < 5000) {
      setTimeout(() => { scanLocked = false; }, 700);
      return;
    }

    const event = {
      eventId: id(),
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
    const count = state.events.filter((item) => item.groupCode === code).length;
    render();
    show('success', code, `撮影チェック ${count}回目`, `${event.photographerName}・${time(event.capturedAt)}`);
    try { navigator.vibrate?.(70); } catch {}
    uploadEvent(event);
    setTimeout(() => { scanLocked = false; }, 900);
  };

  async function boot() {
    try {
      const [{ getApp }, firestore] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
      ]);
      firestoreApi = firestore;
      db = firestore.getFirestore(getApp());
      collectionRef = firestore.collection(db, 'qrTrips', access.tripId, 'photoChecks');

      setNotice('Firestore接続中', '同じ旅行の撮影履歴を読み込んでいます。');

      unsubscribe = firestore.onSnapshot(
        collectionRef,
        (snapshot) => {
          const remoteEvents = snapshot.docs.map((snap) => {
            const data = snap.data() || {};
            return {
              eventId: String(data.eventId || snap.id),
              groupCode: String(data.groupCode || ''),
              photographerId: String(data.photographerId || ''),
              photographerName: String(data.photographerName || ''),
              capturedAt: normalizeCapturedAt(data.capturedAt),
              source: String(data.source || 'camera'),
              syncStatus: 'synced',
            };
          });
          mergeRemoteEvents(remoteEvents);
          setNotice('Firestore共有・複数端末同期', '同じ旅行の撮影履歴を複数カメラマン間でリアルタイム共有しています。');
        },
        (error) => {
          console.error('photo check listener failed', error);
          setNotice('Firestore同期エラー・端末内保存', '共有履歴を読み込めません。撮影記録はこの端末には保存されます。');
        },
      );

      const pending = state.events.filter((event) => event.photographerId === access.uid && ['pending', 'error'].includes(event.syncStatus));
      pending.forEach((event) => uploadEvent(event));
    } catch (error) {
      console.error('photo check sync init failed', error);
      setNotice('Firestore同期エラー・端末内保存', '共有機能を初期化できません。撮影記録はこの端末には保存されます。');
    }
  }

  window.addEventListener('pagehide', () => {
    try { unsubscribe?.(); } catch {}
  });

  boot();
})();
