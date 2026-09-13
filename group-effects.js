(function () {
  const STORAGE_KEY = 'qr-group-check-effect-v1';
  const EFFECTS = new Set(['standard', 'start', 'star-burst', 'double-burst']);
  const setupSelect = document.getElementById('groupEffectSelect');
  const activeSelect = document.getElementById('activeGroupEffectSelect');
  const overlay = document.getElementById('resultOverlay');

  function loadEffect() {
    try {
      const value = localStorage.getItem(STORAGE_KEY) || 'standard';
      return EFFECTS.has(value) ? value : 'standard';
    } catch {
      return 'standard';
    }
  }

  let selectedEffect = loadEffect();

  function syncSelects() {
    if (setupSelect) setupSelect.value = selectedEffect;
    if (activeSelect) activeSelect.value = selectedEffect;
  }

  function saveEffect(value) {
    selectedEffect = EFFECTS.has(value) ? value : 'standard';
    try { localStorage.setItem(STORAGE_KEY, selectedEffect); } catch {}
    syncSelects();
  }

  setupSelect?.addEventListener('change', () => saveEffect(setupSelect.value));
  activeSelect?.addEventListener('change', () => saveEffect(activeSelect.value));
  syncSelects();

  if (typeof showResult !== 'function') return;
  const originalShowResult = showResult;

  showResult = function showResultWithSelectedEffect(type, code, message) {
    const result = originalShowResult(type, code, message);
    if (type !== 'success' || !overlay) return result;

    setTimeout(() => {
      if (selectedEffect === 'standard') return;

      clearTimeout(overlayTimer);
      window.PhotoEffects?.clearEffect?.(overlay);

      let duration = 2400;
      if (selectedEffect === 'start') {
        window.PhotoEffects?.playStart?.(overlay);
        duration = 2400;
      } else if (selectedEffect === 'star-burst') {
        window.PhotoEffects?.playCandidate?.('star-burst', overlay);
        duration = 2800;
      } else if (selectedEffect === 'double-burst') {
        window.PhotoEffects?.playCandidate?.('double-burst', overlay);
        duration = 3000;
      }

      overlayTimer = setTimeout(() => {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        window.PhotoEffects?.clearEffect?.(overlay);
      }, duration);
    }, 10);

    return result;
  };
})();
