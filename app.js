const STORAGE_KEY = 'qr-group-check-state-v2';

const els = {
  setupCard: document.getElementById('setupCard'),
  activeControls: document.getElementById('activeControls'),
  roundInfoCard: document.getElementById('roundInfoCard'),
  scannerCard: document.getElementById('scannerCard'),
  progressCard: document.getElementById('progressCard'),
  recentCard: document.getElementById('recentCard'),
  endedCard: document.getElementById('endedCard'),
  startBtn: document.getElementById('startBtn'),
  cameraBtn: document.getElementById('cameraBtn'),
  endBtn: document.getElementById('endBtn'),
  newRoundBtn: document.getElementById('newRoundBtn'),
  resetBtn: document.getElementById('resetBtn'),
  classMode: document.getElementById('classMode'),
  roundTitle: document.getElementById('roundTitle'),
  roundNote: document.getElementById('roundNote'),
  classMinusBtn: document.getElementById('classMinusBtn'),
  classPlusBtn: document.getElementById('classPlusBtn'),
  classCountValue: document.getElementById('classCountValue'),
  classSetupList: document.getElementById('classSetupList'),
  manualInput: document.getElementById('manualInput'),
  manualAddBtn: document.getElementById('manualAddBtn'),
  checkedList: document.getElementById('checkedList'),
  emptyState: document.getElementById('emptyState'),
  countValue: document.getElementById('countValue'),
  totalValue: document.getElementById('totalValue'),
  uncheckedCount: document.getElementById('uncheckedCount'),
  uncheckedList: document.getElementById('uncheckedList'),
  progressBar: document.getElementById('progressBar'),
  completeBadge: document.getElementById('completeBadge'),
  sessionBadge: document.getElementById('sessionBadge'),
  scanHint: document.getElementById('scanHint'),
  cameraStopped: document.getElementById('cameraStopped'),
  activeRoundTitle: document.getElementById('activeRoundTitle'),
  activeRoundNoteWrap: document.getElementById('activeRoundNoteWrap'),
  activeRoundNote: document.getElementById('activeRoundNote'),
  endedSummary: document.getElementById('endedSummary'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultPanel: document.getElementById('resultPanel'),
  resultIcon: document.getElementById('resultIcon'),
  resultLabel: document.getElementById('resultLabel'),
  resultMessage: document.getElementById('resultMessage'),
};

let state = defaultState(); // Shared round state is server-authoritative; never restore old device-only results.
let scanner = null;
let overlayTimer = null;
let scanLocked = false;
let cameraPaused = false;
let audioContext = null;
let groupSync = null;
let sharedReady = false;
let newRoundSetup = false;

function defaultState() {
  return {
    status: 'idle',
    classMode: 'alpha',
    classGroups: [3],
    roundTitle: '',
    roundNote: '',
    startedAt: null,
    endedAt: null,
    checks: [],
  };
}

function sanitizeGroups(value) {
  if (!Array.isArray(value) || value.length === 0) return [3];
  return value.slice(0, 14).map((n) => Math.max(1, Math.min(8, Number(n) || 1)));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      status: ['idle', 'active', 'ended'].includes(parsed.status) ? parsed.status : 'idle',
      classMode: parsed.classMode === 'numeric' ? 'numeric' : 'alpha',
      classGroups: sanitizeGroups(parsed.classGroups),
      roundTitle: String(parsed.roundTitle || ''),
      roundNote: String(parsed.roundNote || ''),
      startedAt: parsed.startedAt || null,
      endedAt: parsed.endedAt || null,
      checks: Array.isArray(parsed.checks) ? parsed.checks : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  // Setup fields may be edited locally; checked groups never become device-local authority.
  // The legacy localStorage key is intentionally not written.
}

function classLabel(index) {
  if (state.classMode === 'numeric') return String(index + 1);
  return String.fromCharCode(65 + index);
}

function allGroups() {
  const result = [];
  state.classGroups.forEach((count, classIndex) => {
    const prefix = classLabel(classIndex);
    for (let group = 1; group <= count; group += 1) result.push(`${prefix}-${group}`);
  });
  return result;
}

function normalizeQr(raw) {
  const text = String(raw || '').trim().toUpperCase();
  const match = text.match(/^([A-N]|[1-9]|10)-([1-8])$/);
  if (!match) return null;
  return `${match[1]}-${Number(match[2])}`;
}

function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function renderClassSetup() {
  els.classMode.value = state.classMode;
  els.roundTitle.value = state.roundTitle;
  els.roundNote.value = state.roundNote;
  els.classCountValue.textContent = String(state.classGroups.length);
  els.classMinusBtn.disabled = state.classGroups.length <= 1;
  const maxClasses = state.classMode === 'numeric' ? 10 : 14;
  els.classPlusBtn.disabled = state.classGroups.length >= maxClasses;
  els.classSetupList.innerHTML = '';

  state.classGroups.forEach((count, index) => {
    const row = document.createElement('div');
    row.className = 'class-row';
    row.innerHTML = `
      <span class="class-name"></span>
      <div class="class-groups">
        <button class="btn btn-step group-minus" type="button">−</button>
        <strong></strong><span class="muted">班</span>
        <button class="btn btn-step group-plus" type="button">＋</button>
      </div>`;
    row.querySelector('.class-name').textContent = `${classLabel(index)}組`;
    row.querySelector('strong').textContent = String(count);
    const minus = row.querySelector('.group-minus');
    const plus = row.querySelector('.group-plus');
    minus.disabled = count <= 1;
    plus.disabled = count >= 8;
    minus.addEventListener('click', () => {
      state.classGroups[index] = Math.max(1, state.classGroups[index] - 1);
      saveState();
      renderClassSetup();
    });
    plus.addEventListener('click', () => {
      state.classGroups[index] = Math.min(8, state.classGroups[index] + 1);
      saveState();
      renderClassSetup();
    });
    els.classSetupList.appendChild(row);
  });
}

function renderProgress() {
  const groups = allGroups();
  const checkedSet = new Set(state.checks.map((item) => item.code));
  const unchecked = groups.filter((code) => !checkedSet.has(code));
  const checked = groups.length - unchecked.length;
  const pct = groups.length ? Math.round((checked / groups.length) * 100) : 0;

  els.countValue.textContent = String(checked);
  els.totalValue.textContent = String(groups.length);
  els.uncheckedCount.textContent = `${unchecked.length}班`;
  els.progressBar.style.width = `${pct}%`;
  els.completeBadge.hidden = !(groups.length > 0 && unchecked.length === 0);
  els.uncheckedList.innerHTML = '';
  unchecked.forEach((code) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = code;
    els.uncheckedList.appendChild(chip);
  });
  if (unchecked.length === 0) {
    const chip = document.createElement('span');
    chip.className = 'muted';
    chip.textContent = '未チェック班はありません';
    els.uncheckedList.appendChild(chip);
  }
}

function renderRecent() {
  els.checkedList.innerHTML = '';
  els.emptyState.hidden = state.checks.length > 0;
  [...state.checks].reverse().slice(0, 5).forEach((item) => {
    const li = document.createElement('li');
    li.className = 'checked-item';
    li.innerHTML = `<span class="checked-code"></span><span class="checked-meta"><span class="checked-time"></span><span class="checked-note"></span></span>`;
    li.querySelector('.checked-code').textContent = item.code;
    li.querySelector('.checked-time').textContent = formatTime(item.checkedAt);
    li.querySelector('.checked-note').textContent = 'チェック済み';
    els.checkedList.appendChild(li);
  });
}

function render() {
  const active = state.status === 'active';
  const ended = state.status === 'ended';

  els.setupCard.hidden = active || ended;
  els.activeControls.hidden = !active;
  els.roundInfoCard.hidden = !active;
  els.scannerCard.hidden = !active;
  els.progressCard.hidden = !active && !ended;
  els.recentCard.hidden = !active && !ended;
  els.endedCard.hidden = !ended;

  els.sessionBadge.className = 'badge';
  if (active) {
    els.sessionBadge.classList.add(cameraPaused ? 'badge-paused' : 'badge-active');
    els.sessionBadge.textContent = cameraPaused ? 'カメラ停止中' : 'チェック中';
  } else if (ended) {
    els.sessionBadge.classList.add('badge-ended');
    els.sessionBadge.textContent = '終了';
  } else {
    els.sessionBadge.classList.add('badge-idle');
    els.sessionBadge.textContent = '未開始';
  }

  if (!active && !ended) renderClassSetup();

  if (active || ended) {
    renderProgress();
    renderRecent();
    els.activeRoundTitle.textContent = state.roundTitle || '班チェック';
    els.activeRoundNote.textContent = state.roundNote;
    els.activeRoundNoteWrap.hidden = !state.roundNote;
  }

  if (active) {
    els.cameraBtn.textContent = cameraPaused ? 'カメラ再開' : 'カメラ停止';
    els.cameraStopped.hidden = !cameraPaused;
    els.scanHint.textContent = cameraPaused ? 'カメラ停止中' : 'QRをカメラにかざしてください';
  }

  if (ended) {
    const groups = allGroups();
    const checkedSet = new Set(state.checks.map((item) => item.code));
    const checked = groups.filter((code) => checkedSet.has(code)).length;
    els.endedSummary.textContent = `${checked} / ${groups.length}班をチェックしました`;
  }
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext = new AudioCtor();
  return audioContext;
}

function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx?.state === 'suspended') ctx.resume();
  } catch {}
}

function tone({ frequency, type, duration, gain, delay = 0 }) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.02);
    amp.gain.setValueAtTime(gain, Math.max(start + 0.02, start + duration - 0.04));
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch {}
}

function feedback(type) {
  unlockAudio();
  if (type === 'success') {
    tone({ frequency: 1000, type: 'triangle', duration: 0.60, gain: 0.50 });
    try { navigator.vibrate?.(70); } catch {}
    return;
  }
  if (type === 'duplicate') {
    tone({ frequency: 650, type: 'sine', duration: 0.16, gain: 0.90 });
    tone({ frequency: 650, type: 'sine', duration: 0.16, gain: 0.90, delay: 0.24 });
    try { navigator.vibrate?.([60, 60, 60]); } catch {}
    return;
  }
  tone({ frequency: 240, type: 'square', duration: 0.35, gain: 0.45 });
  tone({ frequency: 240, type: 'square', duration: 0.35, gain: 0.45, delay: 0.43 });
  try { navigator.vibrate?.([160, 70, 160]); } catch {}
}

async function startScanner() {
  if (!window.Html5Qrcode) {
    els.scanHint.textContent = 'QR読み取りライブラリを読み込めませんでした';
    return;
  }
  if (scanner) return;
  scanner = new Html5Qrcode('reader');
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
      (decodedText) => handleCode(decodedText, true),
      () => {}
    );
    cameraPaused = false;
    render();
  } catch {
    scanner = null;
    cameraPaused = true;
    els.scanHint.textContent = 'カメラを起動できません。権限を確認してください';
    render();
  }
}

function forceStopVideoTracks() {
  document.querySelectorAll('#reader video').forEach((video) => {
    const stream = video.srcObject;
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
    }
    try { video.srcObject = null; } catch {}
  });
}

async function stopScanner() {
  const activeScanner = scanner;
  scanner = null;
  forceStopVideoTracks();
  if (activeScanner) {
    try { await activeScanner.stop(); } catch {}
    try { await activeScanner.clear(); } catch {}
  }
  forceStopVideoTracks();
  document.getElementById('reader').innerHTML = '';
}

function showResult(type, code, message) {
  clearTimeout(overlayTimer);
  els.resultPanel.className = `result-panel ${type}`;
  els.resultIcon.textContent = type === 'success' ? '✓' : type === 'duplicate' ? '!' : '×';
  els.resultLabel.textContent = code || '読み取りエラー';
  els.resultMessage.textContent = message;
  els.resultOverlay.classList.add('show');
  els.resultOverlay.setAttribute('aria-hidden', 'false');
  overlayTimer = setTimeout(() => {
    els.resultOverlay.classList.remove('show');
    els.resultOverlay.setAttribute('aria-hidden', 'true');
  }, type === 'success' ? 2100 : 1500);
}

async function handleCode(raw, fromCamera = false) {
  if (state.status !== 'active' || scanLocked || !sharedReady || !groupSync) return;
  if (fromCamera && cameraPaused) return;

  const code = normalizeQr(raw);
  scanLocked = true;

  if (!code) {
    showResult('error', '', 'このQRは班チェック用ではありません');
    feedback('error');
    setTimeout(() => { scanLocked = false; }, 900);
    return;
  }

  const configured = new Set(allGroups());
  if (!configured.has(code)) {
    showResult('error', code, '今回の対象班ではありません');
    feedback('error');
    setTimeout(() => { scanLocked = false; }, 900);
    return;
  }

  if (state.checks.some((item) => item.code === code)) {
    showResult('duplicate', code, 'チェック済みです');
    feedback('duplicate');
    setTimeout(() => { scanLocked = false; }, 900);
    return;
  }

  try {
    const result = await groupSync.register(state.roundId, code);
    if (result === 'duplicate') {
      showResult('duplicate', code, '別の端末ですでにチェック済みです');
      feedback('duplicate');
    } else {
      showResult('success', code, '共有記録に保存しました！');
      feedback('success');
    }
  } catch (error) {
    console.error('Shared QR check failed:', error);
    showResult('error', code, '記録できませんでした。通信と権限を確認してください');
    feedback('error');
  } finally {
    setTimeout(() => { scanLocked = false; }, 700);
  }
}

els.classMode.addEventListener('change', () => {
  state.classMode = els.classMode.value === 'numeric' ? 'numeric' : 'alpha';
  const maxClasses = state.classMode === 'numeric' ? 10 : 14;
  state.classGroups = state.classGroups.slice(0, maxClasses);
  saveState();
  renderClassSetup();
});

els.roundTitle.addEventListener('input', () => {
  state.roundTitle = els.roundTitle.value;
  saveState();
});

els.roundNote.addEventListener('input', () => {
  state.roundNote = els.roundNote.value;
  saveState();
});

els.classPlusBtn.addEventListener('click', () => {
  const maxClasses = state.classMode === 'numeric' ? 10 : 14;
  if (state.classGroups.length >= maxClasses) return;
  if (state.classGroups.length === 1 && state.classGroups[0] === 3) state.classGroups[0] = 5;
  state.classGroups.push(5);
  saveState();
  renderClassSetup();
});

els.classMinusBtn.addEventListener('click', () => {
  if (state.classGroups.length <= 1) return;
  state.classGroups.pop();
  saveState();
  renderClassSetup();
});

els.startBtn.addEventListener('click', async () => {
  unlockAudio();
  if (!groupSync || !sharedReady || state.status !== 'idle') return;
  els.startBtn.disabled = true;
  try {
    await groupSync.start({
      title: state.roundTitle, note: state.roundNote,
      classMode: state.classMode, classGroups: state.classGroups
    });
    newRoundSetup = false;
    // Camera starts after a server-confirmed round snapshot is received.
  } catch (error) {
    console.error('Shared QR round start failed:', error);
    alert('チェック回を開始できませんでした。通信と権限を確認してください。');
  } finally {
    els.startBtn.disabled = false;
  }
});

els.cameraBtn.addEventListener('click', async () => {
  unlockAudio();
  if (state.status !== 'active') return;
  if (cameraPaused) {
    cameraPaused = false;
    render();
    await startScanner();
    return;
  }
  cameraPaused = true;
  render();
  await stopScanner();
});

els.endBtn.addEventListener('click', async () => {
  if (!sharedReady || !groupSync || !confirm('全端末のチェック回を終了しますか？')) return;
  els.endBtn.disabled = true;
  try {
    await groupSync.setStatus(state.roundId, 'ended');
  } catch (error) {
    console.error('Shared QR round end failed:', error);
    alert('チェック回を終了できませんでした。');
  } finally {
    els.endBtn.disabled = false;
  }
});

document.getElementById('resumeBtn')?.addEventListener('click', async () => {
  if (!sharedReady || !groupSync || state.status !== 'ended') return;
  try {
    await groupSync.setStatus(state.roundId, 'active');
  } catch (error) {
    console.error('Shared QR round resume failed:', error);
    alert('チェック回を再開できませんでした。');
  }
});

const memberAdminLink = document.getElementById('memberAdminLink');
if (memberAdminLink && window.QRAccess?.role === 'admin') {
  memberAdminLink.hidden = false;
  memberAdminLink.href = './members.html?trip=' + encodeURIComponent(window.QRAccess.tripId);
}

els.newRoundBtn.addEventListener('click', () => {
  if (!sharedReady || state.status !== 'ended') return;
  newRoundSetup = true;
  state.status = 'idle'; // Setup screen only; server round remains ended until new start ACK.
  state.checks = [];
  cameraPaused = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

els.resetBtn.addEventListener('click', () => {
  alert('共有済みのチェック記録は各端末から削除できません。新しいチェック回を開始してください。');
});

els.manualAddBtn.addEventListener('click', () => {
  unlockAudio();
  handleCode(els.manualInput.value, false);
  els.manualInput.value = '';
  els.manualInput.focus();
});

els.manualInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.manualAddBtn.click();
});

els.resultOverlay.addEventListener('click', () => {
  clearTimeout(overlayTimer);
  els.resultOverlay.classList.remove('show');
  els.resultOverlay.setAttribute('aria-hidden', 'true');
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden && state.status === 'active' && scanner) {
    cameraPaused = true;
    render();
    await stopScanner();
  }
});

window.addEventListener('pagehide', () => { stopScanner(); });
window.addEventListener('beforeunload', () => { stopScanner(); });

render();
els.startBtn.disabled = true;
const syncStatus = document.getElementById('sharedSyncStatus');
function setSharedStatus(message, isError = false) {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.style.color = isError ? '#b91c1c' : '';
}
(async () => {
  try {
    groupSync = await window.QRGroupSync.connect(window.QRAccess, async snapshot => {
      if (!snapshot.confirmed) {
        sharedReady = false;
        setSharedStatus('同期確認中。チェック操作はできません。', true);
        return;
      }
      sharedReady = true;
      if (newRoundSetup && snapshot.round?.status === 'ended') {
        setSharedStatus('次のチェック回を設定してください。');
        return;
      }
      newRoundSetup = false;
      const previous = state.status;
      const round = snapshot.round;
      state = round ? {
        status: round.status === 'active' ? 'active' : 'ended',
        classMode: round.classMode === 'numeric' ? 'numeric' : 'alpha',
        classGroups: sanitizeGroups(round.classGroups),
        roundTitle: String(round.title || ''),
        roundNote: String(round.note || ''),
        startedAt: round.createdAt?.toDate?.().toISOString() || null,
        endedAt: round.endedAt?.toDate?.().toISOString() || null,
        roundId: snapshot.roundId,
        checks: snapshot.checks
      } : defaultState();
      els.startBtn.disabled = state.status !== 'idle';
      setSharedStatus('端末間同期中（サーバー確認済み）');
      if (state.status !== 'active' && previous === 'active') {
        cameraPaused = false;
        await stopScanner();
      }
      render();
      if (state.status === 'active' && previous !== 'active') {
        cameraPaused = false;
        await startScanner();
      }
    }, error => {
      console.error('Shared QR subscription failed:', error);
      sharedReady = false;
      setSharedStatus('同期できません。通信と参加権限を確認してください。', true);
    });
  } catch (error) {
    console.error('Shared QR initialization failed:', error);
    setSharedStatus('共有チェックを開始できません。', true);
  }
})();
window.addEventListener('pagehide', () => groupSync?.dispose());
