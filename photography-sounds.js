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
      id: 'powerup-a',
      name: 'パワーアップ A',
      description: '駆け上がって最後にキラッと決まる長めの王道型',
      play() {
        [392, 494, 587, 698, 831, 988].forEach((frequency, index) => {
          tone({ frequency, type: index < 3 ? 'square' : 'triangle', duration: 0.10, gain: 0.17, delay: index * 0.075 });
        });
        tone({ frequency: 1319, type: 'sine', duration: 0.30, gain: 0.28, delay: 0.45 });
        tone({ frequency: 1976, type: 'sine', duration: 0.16, gain: 0.16, delay: 0.57 });
      },
    },
    {
      id: 'powerup-b',
      name: 'パワーアップ B',
      description: '低音から一気に上昇して二段階で決まる派手めタイプ',
      play() {
        [330, 392, 494, 587, 698, 880].forEach((frequency, index) => {
          tone({ frequency, type: 'square', duration: 0.085, gain: 0.16, delay: index * 0.065 });
        });
        tone({ frequency: 1047, type: 'triangle', duration: 0.18, gain: 0.25, delay: 0.39 });
        tone({ frequency: 1319, type: 'triangle', duration: 0.18, gain: 0.25, delay: 0.51 });
        tone({ frequency: 1760, type: 'sine', duration: 0.28, gain: 0.22, delay: 0.63 });
      },
    },
    {
      id: 'powerup-c',
      name: 'パワーアップ C',
      description: '上昇アルペジオにキラキラを重ねたリッチタイプ',
      play() {
        [523, 659, 784, 988, 1175, 1397].forEach((frequency, index) => {
          tone({ frequency, type: 'triangle', duration: 0.11, gain: 0.20, delay: index * 0.085 });
        });
        tone({ frequency: 1568, type: 'sine', duration: 0.18, gain: 0.18, delay: 0.34 });
        tone({ frequency: 2093, type: 'sine', duration: 0.16, gain: 0.14, delay: 0.49 });
        tone({ frequency: 1319, type: 'triangle', duration: 0.32, gain: 0.24, delay: 0.58 });
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
