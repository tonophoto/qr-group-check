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
    busy: false,
  };

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

  function memberRow(member) {
    const isSelf = member.id === access.uid;
    const disabled = member.disabled === true;
    return `
      <div class="admin-member-row" data-member-id="${member.id}">
        <div class="admin-member-main">
          <strong>${member.displayName || '名前未設定'}${isSelf ? '（自分）' : ''}</strong>
          <span>${member.email || 'メール未設定'}</span>
          <code>${member.id}</code>
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
    return `
      <div class="admin-request-row" data-request-id="${request.id}">
        <div class="admin-member-main">
          <strong>${request.displayName || '名前未設定'}</strong>
          <span>${request.email || 'メール未設定'}</span>
          <code>${request.id}</code>
        </div>
        <div class="admin-member-controls">
          <select class="admin-request-role">${roleOptions('teacher')}</select>
          <button class="btn btn-primary admin-approve-request" type="button">承認</button>
          <button class="btn btn-secondary admin-reject-request" type="button">却下</button>
        </div>
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
  }

  async function boot() {
    const [{ getApp }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
    ]);
    const db = firestore.getFirestore(getApp());
    const tripPath = ['qrTrips', access.tripId];

    async function load() {
      if (state.busy) return;
      state.busy = true;
      setStatus('読み込み中…');
      try {
        const [memberSnap, requestSnap] = await Promise.all([
          firestore.getDocs(firestore.collection(db, ...tripPath, 'members')),
          firestore.getDocs(firestore.collection(db, ...tripPath, 'joinRequests')),
        ]);
        state.members = memberSnap.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .sort((a, b) => (a.displayName || a.email || a.id).localeCompare(b.displayName || b.email || b.id, 'ja'));
        state.requests = requestSnap.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .sort((a, b) => (a.displayName || a.email || a.id).localeCompare(b.displayName || b.email || b.id, 'ja'));
        render();
        setStatus('最新の状態です。');
      } catch (error) {
        console.error(error);
        setStatus(error?.code === 'permission-denied'
          ? '管理権限のFirestore設定がまだ反映されていません。'
          : '参加者情報を読み込めませんでした。', true);
      } finally {
        state.busy = false;
      }
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
        await load();
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
        await load();
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
        await load();
      } catch (error) {
        console.error(error);
        setStatus('参加申請を却下できませんでした。', true);
      } finally {
        button.disabled = false;
      }
    }

    document.getElementById('adminRefreshBtn')?.addEventListener('click', load);
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
        await load();
      } catch (error) {
        console.error(error);
        setStatus('参加者を追加できませんでした。', true);
      } finally {
        submit.disabled = false;
      }
    });

    const tripCode = document.getElementById('adminTripCode');
    if (tripCode) tripCode.textContent = access.tripId;
    await load();
  }

  boot().catch((error) => {
    console.error(error);
    setStatus('管理画面の初期化に失敗しました。', true);
  });
})();
