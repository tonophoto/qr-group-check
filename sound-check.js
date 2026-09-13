const randomSoundBtn = document.getElementById('randomSoundBtn');
const lastSound = document.getElementById('lastSound');
const soundList = document.getElementById('soundList');

const sounds = window.PhotoSounds?.getSuccessSounds?.() || [];

function renderSounds() {
  soundList.innerHTML = '';
  sounds.forEach((sound) => {
    const row = document.createElement('div');
    row.className = 'sound-row';

    const info = document.createElement('div');
    info.className = 'sound-info';

    const name = document.createElement('strong');
    name.textContent = sound.name;

    const description = document.createElement('span');
    description.className = 'muted';
    description.textContent = sound.description;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary sound-play-btn';
    button.textContent = '▶ 鳴らす';
    button.addEventListener('click', async () => {
      await window.PhotoSounds?.playSuccess?.(sound.id);
      lastSound.textContent = `いま鳴った音：${sound.name}`;
    });

    info.append(name, description);
    row.append(info, button);
    soundList.appendChild(row);
  });
}

randomSoundBtn.addEventListener('click', async () => {
  const id = await window.PhotoSounds?.playRandomSuccess?.();
  const sound = sounds.find((item) => item.id === id);
  lastSound.textContent = sound ? `いま鳴った音：${sound.name}` : '音を再生しました';
});

['pointerdown', 'touchstart', 'click'].forEach((eventName) => {
  document.addEventListener(eventName, () => window.PhotoSounds?.unlock?.(), { once: true, passive: true });
});

renderSounds();
