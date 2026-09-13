let photoAudioContext = null;
let photoSoundEnabled = true;

const photoSoundToggleBtn = document.getElementById('soundToggleBtn');

function getPhotoAudioContext() {
  if (photoAudioContext) return photoAudioContext;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  photoAudioContext = new AudioCtor();
  return photoAudioContext;
}

async function unlockPhotoAudio() {
  try {
    const ctx = getPhotoAudioContext();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
  } catch {}
}

function renderPhotoSoundButton() {
  if (!photoSoundToggleBtn) return;
  photoSoundToggleBtn.setAttribute('aria-pressed', String(!photoSoundEnabled));
  photoSoundToggleBtn.textContent = photoSoundEnabled ? '🔇 音を出さない' : '🔊 音を出す';
  photoSoundToggleBtn.classList.toggle('is-muted', !photoSoundEnabled);
}

function photoTone({ frequency, type, duration, gain, delay = 0 }) {
  if (!photoSoundEnabled) return;
  try {
    const ctx = getPhotoAudioContext();
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

// 通常の班チェックと同じ成功音。
function photoSuccessSound() {
  photoTone({ frequency: 1000, type: 'triangle', duration: 0.60, gain: 0.50 });
}

function photoErrorSound() {
  photoTone({ frequency: 240, type: 'square', duration: 0.35, gain: 0.45 });
  photoTone({ frequency: 240, type: 'square', duration: 0.35, gain: 0.45, delay: 0.43 });
}

if (photoSoundToggleBtn) {
  photoSoundToggleBtn.addEventListener('click', async () => {
    photoSoundEnabled = !photoSoundEnabled;
    if (photoSoundEnabled) await unlockPhotoAudio();
    renderPhotoSoundButton();
  });
}

['pointerdown', 'touchstart', 'click'].forEach((eventName) => {
  document.addEventListener(eventName, unlockPhotoAudio, { once: true, passive: true });
});

if (typeof record === 'function') {
  const originalRecord = record;
  record = function recordWithAudio(raw, source) {
    if (photoSoundEnabled) unlockPhotoAudio();

    const beforeCount = state.events.length;
    const code = norm(raw);
    const groups = new Set(configuredGroups());
    const wasLocked = scanLocked;
    const isInvalid = !code || !groups.has(code);

    const result = originalRecord(raw, source);

    if (state.events.length > beforeCount) {
      photoSuccessSound();
    } else if (state.status === 'active' && !wasLocked && isInvalid) {
      // 読み取り直後のscanLocked中に同じQRが再検出されてもエラー音を鳴らさない。
      photoErrorSound();
    }

    return result;
  };
}

renderPhotoSoundButton();
