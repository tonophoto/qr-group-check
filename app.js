const STORAGE_KEY = 'qr-group-check-state-v1';

const els = {
  startBtn: document.getElementById('startBtn'),
  cameraBtn: document.getElementById('cameraBtn'),
  endBtn: document.getElementById('endBtn'),
  resetBtn: document.getElementById('resetBtn'),
  manualInput: document.getElementById('manualInput'),
  manualAddBtn: document.getElementById('manualAddBtn'),
  checkedList: document.getElementById('checkedList'),
  emptyState: document.getElementById('emptyState'),
  countValue: document.getElementById('countValue'),
  sessionBadge: document.getElementById('sessionBadge'),
  scanHint: document.getElementById('scanHint'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultPanel: document.getElementById('resultPanel'),
  resultIcon: document.getElementById('resultIcon'),
  resultLabel: document.getElementById('resultLabel'),
  resultMessage: document.getElementById('resultMessage'),
};

let state = loadState();
let scanner = null;
let overlayTimer = null;
let scanLocked = false;
let cameraPaused = false;

function defaultState() {
  return { status: 'idle', startedAt: null, endedAt: null, checks: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      status: ['idle', 'active', 'ended'].includes(parsed.status) ? parsed.status : 'idle',
      startedAt: parsed.startedAt || null,
      endedAt: parsed.endedAt || null,
      checks: Array.isArray(parsed.checks) ? parsed.checks : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function render() {
  const active = state.status === 'active';
  els.startBtn.disabled = active;
  els.cameraBtn.disabled = !active;
  els.cameraBtn.textContent = cameraPaused ? 'カメラ再開' : 'カメラ停止';
  els.endBtn.disabled = !active;
  els.resetBtn.disabled = active || state.checks.length === 0;
  els.manualInput.disabled = !active;
  els.manualAddBtn.disabled = !active;
  els.countValue.textContent = String(state.checks.length);

  els.sessionBadge.className = 'badge';
  if (state.status === 'active') {
    els.sessionBadge.classList.add('badge-active');
    els.sessionBadge.textContent = 'チェック中';
    els.scanHint.textContent = cameraPaused ? 'カメラ停止中' : 'QRをカメラにかざしてください';
  } else if (state.status === 'ended') {
    els.sessionBadge.classList.add('badge-ended');
    els.sessionBadge.textContent = '終了';
    els.scanHint.textContent = '終了しました';
  } else {
    els.sessionBadge.classList.add('badge-idle');
    els.sessionBadge.textContent = '未開始';
    els.scanHint.textContent = '開始するとカメラが起動します';
  }

  els.checkedList.innerHTML = '';
  els.emptyState.hidden = state.checks.length > 0;
  [...state.checks].reverse().forEach((item) => {
    const li = document.createElement('li');
    li.className = 'checked-item';
    li.innerHTML = `<span class="checked-code"></span><span class="checked-time"></span>`;
    li.querySelector('.checked-code').textContent = item.code;
    li.querySelector('.checked-time').textContent = formatTime(item.checkedAt);
    els.checkedList.appendChild(li);
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
      { fps: 8, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
      (decodedText) => handleCode(decodedText),
      () => {}
    );
    cameraPaused = false;
    render();
  } catch (error) {
    els.scanHint.textContent = 'カメラを起動できません。HTTPSまたは権限を確認してください';
    scanner = null;
  }
}

async function stopScanner() {
  if (!scanner) return;
  try { await scanner.stop(); } catch {}
  try { await scanner.clear(); } catch {}
  scanner = null;
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
  }, type === 'success' ? 1800 : 1500);
}

function buzz(type) {
  try {
    if (type === 'success') navigator.vibrate?.(70);
    else if (type === 'duplicate') navigator.vibrate?.([60, 60, 60]);
    else navigator.vibrate?.([160, 70, 160]);
  } catch {}
}

function handleCode(raw) {
  if (state.status !== 'active' || scanLocked || cameraPaused) return;
  const code = normalizeQr(raw);
  scanLocked = true;

  if (!code) {
    showResult('error', '', 'このQRは班チェック用ではありません');
    buzz('error');
    setTimeout(() => { scanLocked = false; }, 1000);
    return;
  }

  if (state.checks.some((item) => item.code === code)) {
    showResult('duplicate', code, 'チェック済みです');
    buzz('duplicate');
    setTimeout(() => { scanLocked = false; }, 1000);
    return;
  }

  state.checks.push({ code, checkedAt: new Date().toISOString() });
  saveState();
  render();
  showResult('success', code, 'チェックできました！');
  buzz('success');
  setTimeout(() => { scanLocked = false; }, 1200);
}

els.startBtn.addEventListener('click', async () => {
  state = { status: 'active', startedAt: new Date().toISOString(), endedAt: null, checks: [] };
  cameraPaused = false;
  saveState();
  render();
  await startScanner();
});

els.cameraBtn.addEventListener('click', async () => {
  if (state.status !== 'active') return;
  if (cameraPaused) {
    await startScanner();
    return;
  }
  await stopScanner();
  cameraPaused = true;
  render();
});

els.endBtn.addEventListener('click', async () => {
  state.status = 'ended';
  state.endedAt = new Date().toISOString();
  cameraPaused = false;
  saveState();
  render();
  await stopScanner();
});

els.resetBtn.addEventListener('click', () => {
  if (!confirm('今回のチェック記録をリセットしますか？')) return;
  state = defaultState();
  cameraPaused = false;
  saveState();
  render();
});

els.manualAddBtn.addEventListener('click', () => {
  handleCode(els.manualInput.value);
  els.manualInput.value = '';
  els.manualInput.focus();
});

els.manualInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.manualAddBtn.click();
});

els.resultOverlay.addEventListener('click', () => {
  els.resultOverlay.classList.remove('show');
  els.resultOverlay.setAttribute('aria-hidden', 'true');
});

window.addEventListener('beforeunload', () => { stopScanner(); });

render();
if (state.status === 'active') startScanner();
