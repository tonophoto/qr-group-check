(function () {
  const effectClasses = [
    'effect-start-badge','effect-start-ring','effect-start-spark',
    'effect-star','effect-rainbow-ring','effect-confetti','effect-flash'
  ];

  function clearEffect(root) {
    if (!root) return;
    root.querySelectorAll(`.${effectClasses.join(',.')}`).forEach((el) => el.remove());
    root.querySelector('.result-panel')?.classList.remove('effect-start','effect-star-pop','effect-rainbow-pop','effect-confetti-pop','effect-flash-pop');
  }

  function addParticles(root, className, vectors, text = '') {
    vectors.forEach(([x, y], index) => {
      const particle = document.createElement('div');
      particle.className = className;
      particle.style.setProperty('--dx', `${x}px`);
      particle.style.setProperty('--dy', `${y}px`);
      particle.style.animationDelay = `${index * 0.018}s`;
      if (text) particle.textContent = text;
      root.appendChild(particle);
    });
  }

  function playStart(root = document.getElementById('resultOverlay')) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-start');

    const badge = document.createElement('div');
    badge.className = 'effect-start-badge';
    badge.textContent = 'START!';
    const ring = document.createElement('div');
    ring.className = 'effect-start-ring';
    root.append(badge, ring);

    addParticles(root, 'effect-start-spark', [
      [-120,-80],[-70,-130],[0,-145],[75,-125],[125,-70],
      [135,10],[95,95],[20,135],[-70,120],[-125,65],[-140,-10],[-95,-75]
    ]);
    setTimeout(() => clearEffect(root), 1150);
  }

  function playStarBurst(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-star-pop');
    addParticles(root, 'effect-star', [
      [-150,-95],[-90,-145],[-25,-160],[55,-150],[125,-110],[155,-30],
      [145,55],[90,125],[20,155],[-60,145],[-130,100],[-160,25]
    ], '★');
    setTimeout(() => clearEffect(root), 1250);
  }

  function playRainbow(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-rainbow-pop');
    [0,1,2].forEach((index) => {
      const ring = document.createElement('div');
      ring.className = 'effect-rainbow-ring';
      ring.style.setProperty('--ring-delay', `${index * 0.12}s`);
      ring.style.setProperty('--ring-index', String(index));
      root.appendChild(ring);
    });
    setTimeout(() => clearEffect(root), 1400);
  }

  function playConfetti(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-confetti-pop');
    const xs = [-150,-120,-90,-60,-30,0,30,60,90,120,150,-135,-75,-15,45,105,135];
    xs.forEach((x, index) => {
      const piece = document.createElement('div');
      piece.className = 'effect-confetti';
      piece.style.setProperty('--cx', `${x}px`);
      piece.style.setProperty('--rot', `${(index % 2 ? 1 : -1) * (180 + index * 21)}deg`);
      piece.style.animationDelay = `${(index % 5) * 0.035}s`;
      root.appendChild(piece);
    });
    setTimeout(() => clearEffect(root), 1450);
  }

  function playFlash(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-flash-pop');
    const flash = document.createElement('div');
    flash.className = 'effect-flash';
    root.appendChild(flash);
    addParticles(root, 'effect-start-spark', [
      [-105,-105],[0,-150],[105,-105],[150,0],[105,105],[0,150],[-105,105],[-150,0]
    ]);
    setTimeout(() => clearEffect(root), 1050);
  }

  const candidates = [
    { id: 'star-burst', name: 'スター爆発', description: '星が中央から一気に飛び出す', play: playStarBurst },
    { id: 'rainbow', name: 'レインボーリング', description: '虹色の輪が3段で広がる', play: playRainbow },
    { id: 'confetti', name: '紙吹雪ポップ', description: '紙吹雪が画面いっぱいに弾ける', play: playConfetti },
    { id: 'flash', name: 'パワーフラッシュ', description: '短い閃光＋放射状の粒', play: playFlash },
  ];

  function getCandidates() {
    return candidates.map(({ id, name, description }) => ({ id, name, description }));
  }

  function playCandidate(id, root = document.getElementById('resultOverlay')) {
    const candidate = candidates.find((item) => item.id === id) || candidates[0];
    candidate?.play(root);
    return candidate?.id || null;
  }

  window.PhotoEffects = { playStart, clearEffect, getCandidates, playCandidate };

  if (typeof record === 'function' && typeof state !== 'undefined') {
    const originalRecord = record;
    record = function recordWithFirstEffect(raw, source) {
      const beforeCount = state.events.length;
      const result = originalRecord(raw, source);
      if (state.events.length > beforeCount) {
        const added = state.events[state.events.length - 1];
        const groupCount = state.events.filter((e) => e.groupCode === added.groupCode).length;
        if (groupCount === 1) {
          setTimeout(() => playStart(document.getElementById('resultOverlay')), 10);
        }
      }
      return result;
    };
  }
})();
