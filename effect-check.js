const previewBtn = document.getElementById('previewStartBtn');
const candidateList = document.getElementById('effectCandidateList');
const overlay = document.getElementById('resultOverlay');
const panel = document.getElementById('resultPanel');
const label = document.getElementById('resultLabel');
const message = document.getElementById('resultMessage');
const meta = document.getElementById('resultMeta');
let timer = null;

function showBase(count = 1) {
  clearTimeout(timer);
  window.PhotoEffects?.clearEffect?.(overlay);
  panel.className = 'result-panel success';
  label.textContent = 'A-1';
  message.textContent = `撮影チェック ${count}回目`;
  meta.textContent = '田中・10:24';
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
}

function closePreview(delay = 1600) {
  timer = setTimeout(() => {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    window.PhotoEffects?.clearEffect?.(overlay);
  }, delay);
}

function previewStartEffect() {
  showBase(1);
  window.PhotoEffects?.playStart?.(overlay);
  closePreview(1600);
}

function previewCandidate(id) {
  showBase(2);
  window.PhotoEffects?.playCandidate?.(id, overlay);
  closePreview(1650);
}

function renderCandidates() {
  if (!candidateList) return;
  candidateList.innerHTML = '';
  const candidates = window.PhotoEffects?.getCandidates?.() || [];
  candidates.forEach((effect) => {
    const row = document.createElement('div');
    row.className = 'effect-candidate-row';

    const info = document.createElement('div');
    info.className = 'effect-candidate-info';

    const name = document.createElement('strong');
    name.textContent = effect.name;

    const description = document.createElement('span');
    description.className = 'muted';
    description.textContent = effect.description;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.textContent = '▶ ためす';
    button.addEventListener('click', () => previewCandidate(effect.id));

    info.append(name, description);
    row.append(info, button);
    candidateList.appendChild(row);
  });
}

previewBtn.addEventListener('click', previewStartEffect);
renderCandidates();
