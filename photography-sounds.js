(function () {
  let ctx = null;
  let lastSuccessIndex = -1;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;

  function getContext() {
    if (!AudioCtor) return null;
    if (!ctx) ctx = new AudioCtor();
    return ctx;
  }

  async function unlock() {
    try {
      const audio = getContext();
      if (audio && audio.state === 'suspended') await audio.resume();
      return !!audio;
    } catch {
      return false;
    }
  }

  function tone({ frequency, type = 'sine', duration = 0.12, gain = 0.32, delay = 0 }) {
    try {
      const audio = getContext();
      if (!audio || audio.state !== 'running') return;
      const start = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.linearRampToValueAtTime(gain, start + 0.012);
      amp.gain.setValueAtTime(gain, Math.max(start + 0.018, start + duration - 0.035));
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(amp);
      amp.connect(audio.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {}
  }

  const successSounds = [
    {
      id: 'kirarin',
      name: 'キラリン',
      description: '明るく上がる3音',
      play() {
        tone({ frequency: 784, type: 'sine', duration: 0.13, gain: 0.32 });
        tone({ frequency: 988, type: 'sine', duration: 0.13, gain: 0.32, delay: 0.09 });
        tone({ frequency: 1319, type: 'triangle', duration: 0.24, gain: 0.34, delay: 0.18 });
      },
    },
    {
      id: 'levelup',
      name: 'レベルアップ',
      description: 'ゲームっぽい上昇4音',
      play() {
        [523, 659, 784, 1047].forEach((frequency, index) => {
          tone({ frequency, type: 'square', duration: index === 3 ? 0.22 : 0.09, gain: 0.18, delay: index * 0.075 });
        });
      },
    },
    {
      id: 'pocopoco',
      name: 'ポコポコ',
      description: '軽快な2音＋高音',
      play() {
        tone({ frequency: 440, type: 'triangle', duration: 0.10, gain: 0.30 });
        tone({ frequency: 587, type: 'triangle', duration: 0.10, gain: 0.30, delay: 0.10 });
        tone({ frequency: 880, type: 'sine', duration: 0.20, gain: 0.30, delay: 0.20 });
      },
    },
    {
      id: 'ta-da',
      name: 'タラッタ',
      description: '短いミニファンファーレ',
      play() {
        tone({ frequency: 659, type: 'triangle', duration: 0.11, gain: 0.28 });
        tone({ frequency: 784, type: 'triangle', duration: 0.11, gain: 0.28, delay: 0.10 });
        tone({ frequency: 988, type: 'triangle', duration: 0.28, gain: 0.34, delay: 0.20 });
      },
    },
    {
      id: 'star',
      name: 'スター',
      description: '高音がきらっと跳ねる',
      play() {
        tone({ frequency: 1047, type: 'sine', duration: 0.10, gain: 0.27 });
        tone({ frequency: 1319, type: 'sine', duration: 0.10, gain: 0.27, delay: 0.07 });
        tone({ frequency: 1568, type: 'sine', duration: 0.18, gain: 0.25, delay: 0.14 });
        tone({ frequency: 2093, type: 'sine', duration: 0.16, gain: 0.18, delay: 0.23 });
      },
    },
    {
      id: 'bounce',
      name: 'ぴょこん',
      description: '上下に跳ねるコミカル音',
      play() {
        tone({ frequency: 698, type: 'triangle', duration: 0.11, gain: 0.29 });
        tone({ frequency: 1047, type: 'triangle', duration: 0.11, gain: 0.29, delay: 0.09 });
        tone({ frequency: 880, type: 'triangle', duration: 0.19, gain: 0.30, delay: 0.18 });
      },
    },
  ];

  function getSuccessSounds() {
    return successSounds.map(({ id, name, description }) => ({ id, name, description }));
  }

  async function playSuccess(id) {
    await unlock();
    const sound = successSounds.find((item) => item.id === id) || successSounds[0];
    sound.play();
    return sound.id;
  }

  async function playRandomSuccess() {
    await unlock();
    if (!successSounds.length) return null;
    let index = Math.floor(Math.random() * successSounds.length);
    if (successSounds.length > 1 && index === lastSuccessIndex) {
      index = (index + 1 + Math.floor(Math.random() * (successSounds.length - 1))) % successSounds.length;
    }
    lastSuccessIndex = index;
    successSounds[index].play();
    return successSounds[index].id;
  }

  async function playError() {
    await unlock();
    tone({ frequency: 240, type: 'square', duration: 0.28, gain: 0.34 });
    tone({ frequency: 240, type: 'square', duration: 0.28, gain: 0.34, delay: 0.34 });
  }

  window.PhotoSounds = {
    unlock,
    getSuccessSounds,
    playSuccess,
    playRandomSuccess,
    playError,
  };
})();
