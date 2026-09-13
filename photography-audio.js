let photoSoundEnabled = true;

const photoSoundToggleBtn = document.getElementById('soundToggleBtn');

async function unlockPhotoAudio() {
  try {
    await window.PhotoSounds?.unlock?.();
  } catch {}
}

function renderPhotoSoundButton() {
  if (!photoSoundToggleBtn) return;
  photoSoundToggleBtn.setAttribute('aria-pressed', String(!photoSoundEnabled));
  photoSoundToggleBtn.textContent = photoSoundEnabled ? '🔇 音を出さない' : '🔊 音を出す';
  photoSoundToggleBtn.classList.toggle('is-muted', !photoSoundEnabled);
}

async function photoSuccessSound() {
  if (!photoSoundEnabled) return;
  try {
    await window.PhotoSounds?.playRandomSuccess?.();
  } catch {}
}

async function photoErrorSound() {
  if (!photoSoundEnabled) return;
  try {
    await window.PhotoSounds?.playError?.();
  } catch {}
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
