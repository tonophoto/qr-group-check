const previewBtn = document.getElementById('previewStartBtn');
const overlay = document.getElementById('resultOverlay');
const panel = document.getElementById('resultPanel');
const label = document.getElementById('resultLabel');
const message = document.getElementById('resultMessage');
const meta = document.getElementById('resultMeta');
let timer = null;

function previewStartEffect() {
  clearTimeout(timer);
  panel.className = 'result-panel success';
  label.textContent = 'A-1';
  message.textContent = '撮影チェック 1回目';
  meta.textContent = '田中・10:24';
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  window.PhotoEffects?.playStart?.(overlay);
  timer = setTimeout(() => {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    window.PhotoEffects?.clearEffect?.(overlay);
  }, 1600);
}

previewBtn.addEventListener('click', previewStartEffect);
