(function () {
  async function ensureAudioReady() {
    try {
      const ctx = typeof getAudioContext === 'function' ? getAudioContext() : null;
      if (!ctx) return false;
      if (ctx.state === 'suspended') await ctx.resume();
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  ['pointerdown', 'touchstart', 'click'].forEach((eventName) => {
    document.addEventListener(eventName, () => { ensureAudioReady(); }, { once: true, passive: true });
  });

  if (typeof feedback !== 'function' || typeof tone !== 'function') return;

  feedback = async function robustFeedback(type) {
    await ensureAudioReady();

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
  };
})();
