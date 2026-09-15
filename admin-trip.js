(() => {
  const access = window.QRAccess;
  if (!access || access.role !== 'admin') return;

  const roleLabels = {
    teacher: '先生',
    photographer: '撮影者',
    admin: '管理者',
  };

  const state = {
    members: [],
    requests: [],
    photoChecks: [],
    photoSession: null,
    busy: false,
    unsubscribers: [],
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setStatus(message, isError = false) {
    const el = document.getElementById('tripAdminStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('admin-status-error', isError);
  }

  function roleOptions(selected) {
    return Object.entries(roleLabels)
      .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`)
      .join('');
  }

  function roleBadge(role) {
    const safeRole = Object.hasOwn(roleLabels, role) ? role : 'teacher';
    return `<span class="admin-role-badge admin-role-${safeRole}">${escapeHtml(roleLabels[safeRole])}</span>`;
  }

  function copyButton(value, label) {
    const safe = escapeHtml(value);
    return `<button class="admin-copy-btn" type="button" data-copy="${safe}" aria-label="${escapeHtml(label)}をコピー">コピー</button>`;
  }

  function memberRow(member) {
    const isSelf = member.id === access.uid;
    const disabled = member.disabled === true;
    const id = escapeHtml(member.id);
    const displayName = escapeHtml(member.displayName || '名前未設定');
    const email = escapeHtml(member.email || 'メール未設定');
    return `
      <div class="admin-member-row ${disabled ? 'is-disabled' : ''}" data-member-id="${id}">
        <div class="admin-member-main">
          <div class="admin-member-title"><strong>${displayName}${isSelf ? '（自分）' : ''}</strong>${roleBadge(member.role)}<span class="admin-state-badge ${disabled ? 'is-off' : 'is-on'}">${disabled ? '無効' : '有効'}</span></div>
          <span class="admin-copy-line">${email}${copyButton(member.email || '', 'メール')}</span>
          <span class="admin-copy-line"><code>${id}</code>${copyButton(member.id, 'UID')}</span>
        </div>
        <div class="admin-member-controls">
          <select class="admin-role-select" ${isSelf ? 'disabled' : ''}>${roleOptions(member.role)}</select>
          <label class="admin-disabled-toggle">
            <input class="admin-disabled-input" type="checkbox" ${disabled ? 'checked' : ''} ${isSelf ? 'disabled' : ''} />
            無効
          </label>
          <button class="btn btn-secondary admin-save-member" type="button" ${isSelf ? 'disabled' : ''}>保存</button>
        </div>
      </div>`;
  }

  function requestRow(request) {
    const id = escapeHtml(request.id);
    const displayName = escapeHtml(request.displayName || '名前未設定');
    const email = escapeHtml(request.email || 'メール未設定');
    return `
      <div class="admin-request-row" data-request-id="${id}">
        <div class="admin-member-main">
          <strong>${displayName}</strong>
          <span class="admin-copy-line">${email}${copyButton(request.email || '', 'メール')}</span>
          <span class="admin-copy-line"><code>${id}</code>${copyButton(request.id, 'UID')}</span>
        </div>
        <div class="admin-member-controls">
          <select class="admin-request-role">${roleOptions('teacher')}</select>
          <button class="btn btn-primary admin-approve-request" type="button">承認</button>
          <button class="btn btn-secondary admin-reject-request" type="button">却下</button>
        </div>
      </div>`;
  }

  function normalizeCapturedAt(value) {
    if (value?.toDate) return value.toDate();
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function currentPhotoChecks() {
    const sessionId = String(state.photoSession?.sessionId || '');
    if (!sessionId) return state.photoChecks;
    return state.photoChecks.filter((event) => event.sessionId === sessionId);
  }

  function renderAudit() {
    const list = document.getElementById('adminPhotoAuditList');
    const total = document.getElementById('adminPhotoTotal');
    const session = document.getElementById('adminPhotoSessionState');
    const exportBtn = document.getElementById('adminPhotoCsvBtn');
    if (!list || !total || !session || !exportBtn) return;

    const events = currentPhotoChecks();
    total.textContent = `${events.length}件`;
    exportBtn.disabled = events.length === 0;

    if (!state.photoSession) {
      session.textContent = '共有撮影セッションなし';
    } else {
      session.textContent = state.photoSession.status === 'active'
        ? `共同チェック中 / ${state.photoSession.sessionId || '-'}`
        : `終了済み / ${state.photoSession.sessionId || '-'}`;
    }

    if (!events.length) {
      list.innerHTML = '<p class="muted">このセッションの撮影履歴はありません。</p>';
      return;
    }

    const byGroup = new Map();
    const byPhotographer = new Map();
    for (const event of events) {
      const group = event.groupCode || '不明';
      byGroup.set(group, (byGroup.get(group) || 0) + 1);
      const shooter = event.photographerName || event.photographerId || '不明';
      byPhotographer.set(shooter, (byPhotographer.get(shooter) || 0) + 1);
    }

    const groupHtml = [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ja', { numeric: true }))
      .map(([name, count]) => `<div class="admin-stat-row"><span>${escapeHtml(name)}</span><strong>${count}回</strong></div>`)
      .join('');
    const shooterHtml = [...byPhotographer.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ja'))
      .map(([name, count]) => `<div class="admin-stat-row"><span>${escapeHtml(name)}</span><strong>${count}回</strong></div>`)
      .join('');

    list.innerHTML = `
      <div class="admin-audit-grid">
        <div><h3>班別</h3><div class="admin-stat-list">${groupHtml}</div></div>
        <div><h3>撮影者別</h3><div class="admin-stat-list">${shooterHtml}</div></div>
      </div>`;
  }

  function render() {
    const memberList = document.getElementById('adminMemberList');
    const requestList = document.getElementById('adminJoinRequestList');
    const memberCount = document.getElementById('adminMemberCount');
    const requestCount = document.getElementById('adminRequestCount');
    if (memberList) {
      memberList.innerHTML = state.members.length
        ? state.members.map(memberRow).join('')
        : '<p class="muted">参加者はいません。</p>';
    }
    if (requestList) {
      requestList.innerHTML = state.requests.length
        ? state.requests.map(requestRow).join('')
        : '<p class="muted">未処理の参加申請はありません。</p>';
    }
    if (memberCount) memberCount.textContent = `${state.members.length}人`;
    if (requestCount) requestCount.textContent = `${state.requests.length}件`;
    renderAudit();
  }

  async function boot() {
    const [{ getApp }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
    ]);
    const db = firestore.getFirestore(getApp());
    const tripPath = ['qrTrips', access.tripId];
    const memberRef = firestore.collection(db, ...tripPath, 'members');
    const requestRef = firestore.collection(db, ...tripPath, 'joinRequests');
    const photoRef = firestore.collection(db, ...tripPath, 'photoChecks');
    const sessionRef = firestore.doc(db, ...tripPath, 'photoSession', 'current');

    function sortMembers(items) {
      return items.sort((a, b) => (a.displayName || a.email || a.id).localeCompare(b.displayName || b.email || b.id, 'ja'));
    }

    function connectLiveData() {
      state.unsubscribers.forEach((stop) => { try { stop(); } catch {} });
      state.unsubscribers = [];
      setStatus('リアルタイム同期中…');

      state.unsubscribers.push(firestore.onSnapshot(memberRef, (snap) => {
        state.members = sortMembers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        render();
        setStatus('最新の状態です。変更は自動反映されます。');
      }, (error) => {
        console.error(error);
        setStatus('参加者情報のリアルタイム同期に失敗しました。', true);
      }));

      state.unsubscribers.push(firestore.onSnapshot(requestRef, (snap) => {
        state.requests = sortMembers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        render();
      }, (error) => {
        console.error(error);
        setStatus('参加申請のリアルタイム同期に失敗しました。', true);
      }));

      state.unsubscribers.push(firestore.onSnapshot(photoRef, (snap) => {
        state.photoChecks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderAudit();
      }, (error) => {
        console.error(error);
        const el = document.getElementById('adminPhotoAuditList');
        if (el) el.innerHTML = '<p class="admin-status-error">撮影履歴を読み込めませんでした。</p>';
      }));

      state.unsubscribers.push(firestore.onSnapshot(sessionRef, (snap) => {
        state.photoSession = snap.exists() ? snap.data() : null;
        renderAudit();
      }, (error) => {
        console.error(error);
      }));
    }

    async function saveMember(row) {
      const uid = row.dataset.memberId;
      if (!uid || uid === access.uid) return;
      const current = state.members.find((member) => member.id === uid);
      if (!current) return;
      const role = row.querySelector('.admin-role-select').value;
      const disabled = row.querySelector('.admin-disabled-input').checked;
      const button = row.querySelector('.admin-save-member');
      button.disabled = true;
      try {
        await firestore.setDoc(firestore.doc(db, ...tripPath, 'members', uid), {
          role,
          displayName: String(current.displayName || ''),
          email: String(current.email || ''),
          disabled,
        });
        setStatus(`${current.displayName || current.email || uid} を更新しました。`);
      } catch (error) {
        console.error(error);
        setStatus('参加者を更新できませんでした。', true);
      } finally {
        button.disabled = false;
      }
    }

    async function approveRequest(row) {
      const uid = row.dataset.requestId;
      const request = state.requests.find((item) => item.id === uid);
      if (!request) return;
      const role = row.querySelector('.admin-request-role').value;
      const button = row.querySelector('.admin-approve-request');
      button.disabled = true;
      try {
        await firestore.setDoc(firestore.doc(db, ...tripPath, 'members', uid), {
          role,
          displayName: String(request.displayName || request.email || ''),
          email: String(request.email || ''),
          disabled: false,
        });
        await firestore.deleteDoc(firestore.doc(db, ...tripPath, 'joinRequests', uid));
        setStatus(`${request.displayName || request.email || uid} を${roleLabels[role]}として承認しました。`);
      } catch (error) {
        console.error(error);
        setStatus('参加申請を承認できませんでした。', true);
      } finally {
        button.disabled = false;
      }
    }

    async function rejectRequest(row) {
      const uid = row.dataset.requestId;
      const request = state.requests.find((item) => item.id === uid);
      if (!request) return;
      const button = row.querySelector('.admin-reject-request');
      button.disabled = true;
      try {
        await firestore.deleteDoc(firestore.doc(db, ...tripPath, 'joinRequests', uid));
        setStatus(`${request.displayName || request.email || uid} の申請を却下しました。`);
      } catch (error) {
        console.error(error);
        setStatus('参加申請を却下できませんでした。', true);
      } finally {
        button.disabled = false;
      }
    }

    async function copyText(value) {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setStatus('コピーしました。');
      } catch {
        setStatus('コピーできませんでした。', true);
      }
    }

    function exportCsv() {
      const events = currentPhotoChecks().slice().sort((a, b) => normalizeCapturedAt(a.capturedAt) - normalizeCapturedAt(b.capturedAt));
      if (!events.length) return;
      const rows = [
        ['旅行コード', 'セッションID', '班', '撮影者名', '撮影者UID', '撮影時刻', '入力方法'],
        ...events.map((event) => [
          access.tripId,
          event.sessionId || '',
          event.groupCode || '',
          event.photographerName || '',
          event.photographerId || '',
          normalizeCapturedAt(event.capturedAt).toLocaleString('ja-JP'),
          event.source || '',
        ]),
      ];
      const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `photo-check-${access.tripId}-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    document.getElementById('adminRefreshBtn')?.addEventListener('click', () => {
      connectLiveData();
      setStatus('再接続しました。');
    });

    document.addEventListener('click', (event) => {
      const copy = event.target.closest('.admin-copy-btn');
      if (copy) copyText(copy.dataset.copy || '');
    });

    document.getElementById('adminMemberList')?.addEventListener('click', (event) => {
      const button = event.target.closest('.admin-save-member');
      if (!button) return;
      const row = button.closest('.admin-member-row');
      if (row) saveMember(row);
    });

    document.getElementById('adminJoinRequestList')?.addEventListener('click', (event) => {
      const approve = event.target.closest('.admin-approve-request');
      const reject = event.target.closest('.admin-reject-request');
      const row = event.target.closest('.admin-request-row');
      if (!row) return;
      if (approve) approveRequest(row);
      if (reject) rejectRequest(row);
    });

    document.getElementById('adminPhotoCsvBtn')?.addEventListener('click', exportCsv);

    document.getElementById('adminManualMemberForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const uid = form.elements.uid.value.trim();
      const displayName = form.elements.displayName.value.trim();
      const email = form.elements.email.value.trim();
      const role = form.elements.role.value;
      if (!uid || !displayName || !email) {
        setStatus('UID・名前・メールを入力してください。', true);
        return;
      }
      if (uid === access.uid) {
        setStatus('自分自身の権限はこの画面から変更できません。', true);
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        await firestore.setDoc(firestore.doc(db, ...tripPath, 'members', uid), {
          role,
          displayName,
          email,
          disabled: false,
        });
        form.reset();
        setStatus(`${displayName} を${roleLabels[role]}として追加しました。`);
      } catch (error) {
        console.error(error);
        setStatus('参加者を追加できませんでした。', true);
      } finally {
        submit.disabled = false;
      }
    });

    const tripCode = document.getElementById('adminTripCode');
    if (tripCode) tripCode.textContent = access.tripId;
    connectLiveData();
    window.addEventListener('pagehide', () => {
      state.unsubscribers.forEach((stop) => { try { stop(); } catch {} });
      state.unsubscribers = [];
    }, { once: true });
  }

  boot().catch((error) => {
    console.error(error);
    setStatus('管理画面の初期化に失敗しました。', true);
  });
})();
