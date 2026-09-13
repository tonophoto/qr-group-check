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
      id: 'powerup',
      name: 'パワーアップ',
      description: '勢いよく駆け上がる5音',
      play() {
        [440, 554, 659, 831, 1109].forEach((frequency, index) => {
          tone({ frequency, type: 'square', duration: index === 4 ? 0.20 : 0.075, gain: 0.17, delay: index * 0.055 });
        });
      },
    },
    {
      id: 'bonus',
      name: 'ボーナス',
      description: '明るい高音が3段で上がる',
      play() {
        tone({ frequency: 659, type: 'triangle', duration: 0.10, gain: 0.25 });
        tone({ frequency: 988, type: 'triangle', duration: 0.11, gain: 0.27, delay: 0.08 });
        tone({ frequency: 1319, type: 'sine', duration: 0.24, gain: 0.30, delay: 0.16 });
      },
    },
    {
      id: 'comet',
      name: '流れ星',
      description: 'きらきら音が一気に上昇',
      play() {
        [880, 1047, 1319, 1568, 1976].forEach((frequency, index) => {
          tone({ frequency, type: 'sine', duration: 0.11, gain: 0.20, delay: index * 0.045 });
        });
      },
    },
    {
      id: 'rainbow',
      name: 'レインボー',
      description: 'やわらかい上昇音＋きらめき',
      play() {
        tone({ frequency: 523, type: 'triangle', duration: 0.11, gain: 0.22 });
        tone({ frequency: 659, type: 'triangle', duration: 0.11, gain: 0.22, delay: 0.075 });
        tone({ frequency: 784, type: 'triangle', duration: 0.11, gain: 0.22, delay: 0.15 });
        tone({ frequency: 1047, type: 'sine', duration: 0.22, gain: 0.27, delay: 0.225 });
        tone({ frequency: 1568, type: 'sine', duration: 0.13, gain: 0.14, delay: 0.30 });
      },
    },
    {
      id: 'jackpot',
      name: 'ジャックポット',
      description: '当たり感のある軽快な連続音',
      play() {
        tone({ frequency: 784, type: 'square', duration: 0.075, gain: 0.16 });
        tone({ frequency: 988, type: 'square', duration: 0.075, gain: 0.16, delay: 0.065 });
        tone({ frequency: 1175, type: 'square', duration: 0.075, gain: 0.16, delay: 0.13 });
        tone({ frequency: 1568, type: 'triangle', duration: 0.22, gain: 0.28, delay: 0.195 });
      },
    },
    {
      id: 'rocket',
      name: 'ロケット',
      description: '低めから一気に飛び出す上昇音',
      play() {
        [392, 494, 622, 784, 1245].forEach((frequency, index) => {
          tone({ frequency, type: index < 3 ? 'square' : 'triangle', duration: index === 4 ? 0.21 : 0.08, gain: 0.18, delay: index * 0.06 });
        });
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
