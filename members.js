/* Independent group-check member administration; never loads photo management. */
(async function () {
  const status = document.getElementById('memberStatus');
  const requestList = document.getElementById('pendingRequests');
  const memberList = document.getElementById('approvedMembers');
  const access = window.QRAccess;
  if (!access || access.role !== 'admin') {
    status.textContent = 'QR班チェック管理者の権限が必要です。';
    status.classList.add('error');
    return;
  }
  function message(value, error = false) {
    status.textContent = value;
    status.classList.toggle('error', error);
  }
  try {
    const [{ getApp }, fs] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    const db = fs.getFirestore(getApp());
    const root = ['qrTrips', access.tripId];
    const members = fs.collection(db, ...root, 'members');
    const requests = fs.collection(db, ...root, 'joinRequests');
    const stops = [];
    let disposed = false;
    const active = () => !disposed && window.QRAccess === access;
    const requireActive = () => {
      if (!active() || !navigator.onLine) throw new Error('qr-member-access-unavailable');
    };
    const dispose = () => {
      disposed = true;
      stops.forEach(stop => stop());
      requestList.replaceChildren();
      memberList.replaceChildren();
      message('参加権限を確認してください。', true);
    };
    window.addEventListener('qr-access-ended', dispose, { once: true });
    function row(info, content) {
      const div = document.createElement('div');
      div.className = 'row';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = info.displayName || info.email || info.id;
      const actions = document.createElement('div');
      actions.className = 'controls';
      content(actions, div);
      div.append(name, actions);
      return div;
    }
    function selectRole(initial = 'teacher') {
      const select = document.createElement('select');
      for (const role of ['teacher', 'admin']) {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role === 'teacher' ? '先生' : '管理者';
        select.appendChild(option);
      }
      select.value = initial;
      return select;
    }
    stops.push(fs.onSnapshot(requests, { includeMetadataChanges: true }, snap => {
      if (!active()) return;
      requestList.replaceChildren();
      if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) {
        requestList.textContent = 'サーバー確認中です。操作できません。';
        return;
      }
      if (snap.empty) { requestList.textContent = '申請はありません。'; return; }
      snap.docs.forEach(item => {
        const request = { id: item.id, ...item.data() };
        requestList.appendChild(row(request, actions => {
          const role = selectRole();
          const approve = document.createElement('button');
          approve.type = 'button';
          approve.textContent = '承認';
          approve.addEventListener('click', async () => {
            approve.disabled = true;
            try {
              requireActive();
              const batch = fs.writeBatch(db);
              batch.set(fs.doc(db, ...root, 'members', item.id), {
                role: role.value, displayName: String(request.displayName || request.email || ''),
                email: String(request.email || ''), disabled: false
              });
              batch.delete(item.ref);
              await batch.commit();
              if (active()) message('参加者を承認しました。');
            } catch (error) {
              console.error('QR member approval failed:', error);
              message('承認に失敗しました。通信と権限を確認してください。', true);
              approve.disabled = false;
            }
          });
          const reject = document.createElement('button');
          reject.type = 'button';
          reject.textContent = '拒否';
          reject.addEventListener('click', async () => {
            reject.disabled = true;
            try {
              requireActive();
              await fs.deleteDoc(item.ref);
              if (active()) message('参加申請を拒否しました。');
            } catch {
              if (active()) message('参加申請を拒否できませんでした。', true);
              reject.disabled = false;
            }
          });
          actions.append(role, approve, reject);
        }));
      });
      message('参加申請を同期しています。');
    }, error => { if (!active()) return; requestList.replaceChildren(); console.error(error); message('参加申請を取得できません。', true); }));
    stops.push(fs.onSnapshot(members, { includeMetadataChanges: true }, snap => {
      if (!active()) return;
      memberList.replaceChildren();
      if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) {
        memberList.textContent = 'サーバー確認中です。操作できません。';
        return;
      }
      if (snap.empty) { memberList.textContent = '登録者はいません。'; return; }
      snap.docs.forEach(item => {
        const member = { id: item.id, ...item.data() };
        memberList.appendChild(row(member, actions => {
          const role = selectRole(member.role);
          const disabled = document.createElement('input');
          disabled.type = 'checkbox';
          disabled.checked = member.disabled === true;
          disabled.setAttribute('aria-label', '無効化');
          const label = document.createElement('label');
          label.textContent = '無効';
          label.append(disabled);
          const save = document.createElement('button');
          save.type = 'button';
          save.textContent = '保存';
          save.disabled = member.id === access.uid;
          save.addEventListener('click', async () => {
            save.disabled = true;
            try {
              requireActive();
              await fs.setDoc(item.ref, {
                role: role.value, displayName: String(member.displayName || ''),
                email: String(member.email || ''), disabled: disabled.checked
              });
              if (active()) message('参加者情報を更新しました。');
            } catch (error) {
              console.error('QR member update failed:', error);
              message('更新できませんでした。', true);
            } finally { save.disabled = member.id === access.uid; }
          });
          actions.append(role, label, save);
        }));
      });
    }, error => { if (!active()) return; memberList.replaceChildren(); console.error(error); message('参加者一覧を取得できません。', true); }));
    window.addEventListener('pagehide', dispose, { once: true });
  } catch (error) {
    console.error('QR member administration failed:', error);
    message('参加者管理を初期化できませんでした。', true);
  }
})();
