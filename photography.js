const PHOTO_KEY = 'qr-group-photo-state-v2';
const LEGACY_PHOTO_KEY = 'qr-group-photo-state-v1';
const GROUP_KEY = 'qr-group-check-state-v2';

const els = {
  setupCard: document.getElementById('setupCard'),
  activeControls: document.getElementById('activeControls'),
  scannerCard: document.getElementById('scannerCard'),
  groupSummaryCard: document.getElementById('groupSummaryCard'),
  historyCard: document.getElementById('historyCard'),
  endedCard: document.getElementById('endedCard'),
  photographerName: document.getElementById('photographerName'),
  classMode: document.getElementById('classMode'),
  classMinusBtn: document.getElementById('classMinusBtn'),
  classPlusBtn: document.getElementById('classPlusBtn'),
  classCountValue: document.getElementById('classCountValue'),
  classSetupList: document.getElementById('classSetupList'),
  targetCount: document.getElementById('targetCount'),
  targetHint: document.getElementById('targetHint'),
  importGroupsBtn: document.getElementById('importGroupsBtn'),
  startBtn: document.getElementById('startBtn'),
  cameraBtn: document.getElementById('cameraBtn'),
  endBtn: document.getElementById('endBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  clearBtn: document.getElementById('clearBtn'),
  scannerOwner: document.getElementById('scannerOwner'),
  scanHint: document.getElementById('scanHint'),
  cameraStopped: document.getElementById('cameraStopped'),
  manualInput: document.getElementById('manualInput'),
  manualAddBtn: document.getElementById('manualAddBtn'),
  groupSummaryList: document.getElementById('groupSummaryList'),
  totalEvents: document.getElementById('totalEvents'),
  historyList: document.getElementById('historyList'),
  emptyHistory: document.getElementById('emptyHistory'),
  endedSummary: document.getElementById('endedSummary'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultPanel: document.getElementById('resultPanel'),
  resultIcon: document.getElementById('resultIcon'),
  resultLabel: document.getElementById('resultLabel'),
  resultMessage: document.getElementById('resultMessage'),
  resultMeta: document.getElementById('resultMeta'),
};

let scanner = null;
let cameraPaused = false;
let scanLocked = false;
let overlayTimer = null;

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeGroups(value) {
  if (!Array.isArray(value) || value.length === 0) return [3];
  return value.slice(0, 14).map((n) => Math.max(1, Math.min(8, Number(n) || 1)));
}

function loadMainGroupConfig() {
  try {
    const s = JSON.parse(localStorage.getItem(GROUP_KEY) || 'null');
    if (!s || !Array.isArray(s.classGroups)) return null;
    return {
      classMode: s.classMode === 'numeric' ? 'numeric' : 'alpha',
      classGroups: sanitizeGroups(s.classGroups),
    };
  } catch {
    return null;
  }
}

function defaultState() {
  const imported = loadMainGroupConfig();
  return {
    status: 'idle',
    photographerId: id(),
    photographerName: '',
    classMode: imported?.classMode || 'alpha',
    classGroups: imported?.classGroups || [3],
    events: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(PHOTO_KEY) || localStorage.getItem(LEGACY_PHOTO_KEY);
    const s = JSON.parse(raw || 'null');
    if (!s || !Array.isArray(s.events)) return defaultState();
    const imported = loadMainGroupConfig();
    return {
      ...defaultState(),
      ...s,
      classMode: s.classMode === 'numeric' ? 'numeric' : (s.classMode === 'alpha' ? 'alpha' : imported?.classMode || 'alpha'),
      classGroups: sanitizeGroups(s.classGroups || imported?.classGroups),
    };
  } catch {
    return defaultState();
  }
}

let state = load();

function save() {
  localStorage.setItem(PHOTO_KEY, JSON.stringify(state));
}

function classLabel(index) {
  return state.classMode === 'numeric' ? String(index + 1) : String.fromCharCode(65 + index);
}

function configuredGroups() {
  return state.classGroups.flatMap((count, i) => {
    const prefix = classLabel(i);
    return Array.from({ length: Number(count) || 0 }, (_, j) => `${prefix}-${j + 1}`);
  });
}

function norm(raw) {
  const m = String(raw || '').trim().toUpperCase().match(/^([A-N]|[1-9]|10)-([1-8])$/);
  return m ? `${m[1]}-${Number(m[2])}` : null;
}

function time(iso) {
  try {
    return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

function renderClassSetup() {
  els.classMode.value = state.classMode;
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
      save();
      render();
    });
    plus.addEventListener('click', () => {
      state.classGroups[index] = Math.min(8, state.classGroups[index] + 1);
      save();
      render();
    });
    els.classSetupList.appendChild(row);
  });
}

function render() {
  const groups = configuredGroups();
  const active = state.status === 'active';
  const ended = state.status === 'ended';

  els.setupCard.hidden = active || ended;
  els.activeControls.hidden = !active;
  els.scannerCard.hidden = !active;
  els.groupSummaryCard.hidden = !(active || ended);
  els.historyCard.hidden = !(active || ended);
  els.endedCard.hidden = !ended;

  els.photographerName.value = state.photographerName;
  els.targetCount.textContent = `${groups.length}班`;
  els.startBtn.disabled = !groups.length;

  if (!active && !ended) {
    renderClassSetup();
    els.targetHint.textContent = 'この撮影チェック専用の対象班として保存されます。';
  }

  if (active) {
    els.scannerOwner.textContent = `撮影者：${state.photographerName}`;
    els.cameraBtn.textContent = cameraPaused ? 'カメラ再開' : 'カメラ停止';
    els.cameraStopped.hidden = !cameraPaused;
    els.scanHint.textContent = cameraPaused ? 'カメラ停止中' : 'QRをカメラにかざしてください';
  }

  renderSummary(groups);
  renderHistory();

  if (ended) els.endedSummary.textContent = `${state.events.length}件の撮影チェックを記録しました`;
}

function renderSummary(groups) {
  const by = new Map(groups.map((g) => [g, []]));
  for (const e of state.events) {
    if (by.has(e.groupCode)) by.get(e.groupCode).push(e);
  }

  els.totalEvents.textContent = `${state.events.length}件`;
  els.groupSummaryList.innerHTML = '';

  [...by.entries()].forEach(([g, ev]) => {
    const last = ev.at(-1);
    const row = document.createElement('div');
    row.className = 'group-row';
    row.innerHTML = '<span class="group-code"></span><span class="group-count"></span><span class="group-last"></span>';
    row.children[0].textContent = g;
    row.children[1].textContent = `${ev.length}回`;
    row.children[2].textContent = last ? `最終 ${time(last.capturedAt)} ${last.photographerName}` : '未撮影';
    els.groupSummaryList.appendChild(row);
  });
}

function renderHistory() {
  els.historyList.innerHTML = '';
  els.emptyHistory.hidden = state.events.length > 0;
  [...state.events].reverse().slice(0, 30).forEach((e) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = '<span class="history-code"></span><span class="history-meta"><span class="history-time"></span><span class="history-owner"></span></span><strong class="history-count"></strong>';
    li.querySelector('.history-code').textContent = e.groupCode;
    li.querySelector('.history-time').textContent = time(e.capturedAt);
    li.querySelector('.history-owner').textContent = e.photographerName;
    const count = state.events.filter((x) => x.groupCode === e.groupCode && x.capturedAt <= e.capturedAt).length;
    li.querySelector('.history-count').textContent = `${count}回目`;
    els.historyList.appendChild(li);
  });
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
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
      (text) => record(text, 'camera'),
      () => {}
    );
    cameraPaused = false;
    render();
  } catch {
    scanner = null;
    cameraPaused = true;
    render();
    els.scanHint.textContent = 'カメラを起動できません。権限を確認してください';
  }
}

function forceStop() {
  document.querySelectorAll('#reader video').forEach((video) => {
    const stream = video.srcObject;
    if (stream?.getTracks) {
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
  forceStop();
  if (activeScanner) {
    try { await activeScanner.stop(); } catch {}
    try { await activeScanner.clear(); } catch {}
  }
  forceStop();
  document.getElementById('reader').innerHTML = '';
}

function show(type, code, msg, meta) {
  clearTimeout(overlayTimer);
  els.resultPanel.className = `result-panel ${type}`;
  els.resultIcon.textContent = type === 'success' ? '✓' : '×';
  els.resultLabel.textContent = code || '読み取りエラー';
  els.resultMessage.textContent = msg;
  els.resultMeta.textContent = meta || '';
  els.resultOverlay.classList.add('show');
  els.resultOverlay.setAttribute('aria-hidden', 'false');
  overlayTimer = setTimeout(() => {
    els.resultOverlay.classList.remove('show');
    els.resultOverlay.setAttribute('aria-hidden', 'true');
  }, 1600);
}

function record(raw, source) {
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
  const recent = state.events.findLast?.((e) => e.groupCode === code);
  if (recent && now - new Date(recent.capturedAt).getTime() < 5000) {
    setTimeout(() => { scanLocked = false; }, 700);
    return;
  }

  const event = {
    eventId: id(),
    groupCode: code,
    photographerId: state.photographerId,
    photographerName: state.photographerName,
    capturedAt: new Date().toISOString(),
    source,
    syncStatus: 'local',
  };

  state.events.push(event);
  save();
  const count = state.events.filter((e) => e.groupCode === code).length;
  render();
  show('success', code, `撮影チェック ${count}回目`, `${event.photographerName}・${time(event.capturedAt)}`);
  try { navigator.vibrate?.(70); } catch {}
  setTimeout(() => { scanLocked = false; }, 900);
}

els.photographerName.addEventListener('input', () => {
  state.photographerName = els.photographerName.value.trim();
  save();
});

els.classMode.addEventListener('change', () => {
  state.classMode = els.classMode.value === 'numeric' ? 'numeric' : 'alpha';
  const maxClasses = state.classMode === 'numeric' ? 10 : 14;
  state.classGroups = state.classGroups.slice(0, maxClasses);
  save();
  render();
});

els.classPlusBtn.addEventListener('click', () => {
  const maxClasses = state.classMode === 'numeric' ? 10 : 14;
  if (state.classGroups.length >= maxClasses) return;
  if (state.classGroups.length === 1 && state.classGroups[0] === 3) state.classGroups[0] = 5;
  state.classGroups.push(5);
  save();
  render();
});

els.classMinusBtn.addEventListener('click', () => {
  if (state.classGroups.length <= 1) return;
  state.classGroups.pop();
  save();
  render();
});

els.importGroupsBtn.addEventListener('click', () => {
  const imported = loadMainGroupConfig();
  if (!imported) {
    alert('班チェック側にクラス・班設定がありません');
    return;
  }
  state.classMode = imported.classMode;
  state.classGroups = imported.classGroups;
  save();
  render();
});

els.startBtn.addEventListener('click', async () => {
  const name = els.photographerName.value.trim();
  if (!name) {
    alert('カメラマン名を入力してください');
    return;
  }
  state.photographerName = name;
  state.status = 'active';
  save();
  cameraPaused = false;
  render();
  await startScanner();
});

els.cameraBtn.addEventListener('click', async () => {
  if (cameraPaused) {
    cameraPaused = false;
    render();
    await startScanner();
  } else {
    cameraPaused = true;
    render();
    await stopScanner();
  }
});

els.endBtn.addEventListener('click', async () => {
  if (!confirm('撮影チェックを終了しますか？')) return;
  state.status = 'ended';
  save();
  cameraPaused = false;
  render();
  await stopScanner();
});

els.resumeBtn.addEventListener('click', () => {
  state.status = 'active';
  save();
  cameraPaused = true;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

els.clearBtn.addEventListener('click', () => {
  if (!confirm('この端末の撮影履歴をすべて消去しますか？')) return;
  const name = state.photographerName;
  const classMode = state.classMode;
  const classGroups = [...state.classGroups];
  state = defaultState();
  state.photographerName = name;
  state.classMode = classMode;
  state.classGroups = classGroups;
  save();
  render();
});

els.manualAddBtn.addEventListener('click', () => {
  record(els.manualInput.value, 'manual');
  els.manualInput.value = '';
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
  if (document.hidden && scanner) {
    cameraPaused = true;
    render();
    await stopScanner();
  }
});

window.addEventListener('pagehide', () => stopScanner());

save();
render();
if (state.status === 'active') {
  cameraPaused = true;
  render();
}
