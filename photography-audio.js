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

function installPhotoSoundGate() {
  const sounds = window.PhotoSounds;
  if (!sounds || sounds.__muteGateInstalled) return;

  const originalPlaySuccess = sounds.playSuccess?.bind(sounds);
  const originalPlayRandomSuccess = sounds.playRandomSuccess?.bind(sounds);
  const originalPlayError = sounds.playError?.bind(sounds);

  if (originalPlaySuccess) {
    sounds.playSuccess = async (...args) => (
      photoSoundEnabled ? originalPlaySuccess(...args) : null
    );
  }
  if (originalPlayRandomSuccess) {
    sounds.playRandomSuccess = async (...args) => (
      photoSoundEnabled ? originalPlayRandomSuccess(...args) : null
    );
  }
  if (originalPlayError) {
    sounds.playError = async (...args) => (
      photoSoundEnabled ? originalPlayError(...args) : null
    );
  }

  sounds.__muteGateInstalled = true;
}

function encounterStage(count) {
  return ((Math.max(1, count) - 1) % 3) + 1;
}

async function photoSuccessSound(count) {
  if (!photoSoundEnabled) return;
  try {
    const stage = encounterStage(count);
    // 1回目系はリッチなパワーアップC、2回目系はスター、3回目系はレベルアップ。
    const soundId = stage === 1 ? 'powerup-c' : stage === 2 ? 'star' : 'levelup';
    await window.PhotoSounds?.playSuccess?.(soundId);
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

installPhotoSoundGate();

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
      const added = state.events[state.events.length - 1];
      const groupCount = state.events.filter((e) => e.groupCode === added.groupCode).length;
      photoSuccessSound(groupCount);
    } else if (state.status === 'active' && !wasLocked && isInvalid) {
      // 読み取り直後のscanLocked中に同じQRが再検出されてもエラー音を鳴らさない。
      photoErrorSound();
    }

    return result;
  };
}

renderPhotoSoundButton();
