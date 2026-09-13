(function () {
  const effectClasses = [
    'effect-start-badge','effect-start-ring','effect-start-spark',
    'effect-star','effect-rainbow-ring','effect-confetti','effect-flash',
    'effect-star-shower','effect-double-ring','effect-comet','effect-sparkle-rain'
  ];

  function clearEffect(root) {
    if (!root) return;
    root.querySelectorAll(`.${effectClasses.join(',.')}`).forEach((el) => el.remove());
    root.querySelector('.result-panel')?.classList.remove(
      'effect-start','effect-star-pop','effect-rainbow-pop','effect-confetti-pop','effect-flash-pop',
      'effect-star-shower-pop','effect-double-pop','effect-comet-pop','effect-sparkle-pop'
    );
  }

  function addParticles(root, className, vectors, text = '', delayStep = 0.018) {
    vectors.forEach(([x, y], index) => {
      const particle = document.createElement('div');
      particle.className = className;
      particle.style.setProperty('--dx', `${x}px`);
      particle.style.setProperty('--dy', `${y}px`);
      particle.style.animationDelay = `${index * delayStep}s`;
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
    setTimeout(() => clearEffect(root), 1800);
  }

  function playStarBurst(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-star-pop');
    addParticles(root, 'effect-star', [
      [-180,-120],[-125,-175],[-55,-195],[25,-205],[105,-180],[165,-125],
      [195,-45],[190,45],[145,125],[75,180],[-10,195],[-95,175],[-165,115],[-200,30],[-195,-55]
    ], '★', 0.035);
    setTimeout(() => clearEffect(root), 2300);
  }

  function playRainbow(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-rainbow-pop');
    [0,1,2].forEach((index) => {
      const ring = document.createElement('div');
      ring.className = 'effect-rainbow-ring';
      ring.style.setProperty('--ring-delay', `${index * 0.18}s`);
      root.appendChild(ring);
    });
    setTimeout(() => clearEffect(root), 2100);
  }

  function playConfetti(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-confetti-pop');
    const xs = [-170,-145,-120,-95,-70,-45,-20,5,30,55,80,105,130,155,180,-155,-105,-55,-5,45,95,145];
    xs.forEach((x, index) => {
      const piece = document.createElement('div');
      piece.className = 'effect-confetti';
      piece.style.setProperty('--cx', `${x}px`);
      piece.style.setProperty('--rot', `${(index % 2 ? 1 : -1) * (180 + index * 21)}deg`);
      piece.style.animationDelay = `${(index % 7) * 0.055}s`;
      root.appendChild(piece);
    });
    setTimeout(() => clearEffect(root), 2200);
  }

  function playFlash(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-flash-pop');
    const flash = document.createElement('div');
    flash.className = 'effect-flash';
    root.appendChild(flash);
    addParticles(root, 'effect-start-spark', [
      [-140,-140],[0,-200],[140,-140],[200,0],[140,140],[0,200],[-140,140],[-200,0]
    ], '', 0.05);
    setTimeout(() => clearEffect(root), 1900);
  }

  function playStarShower(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-star-shower-pop');
    const xs = [-160,-125,-90,-55,-20,15,50,85,120,155,-145,-75,-5,65,135];
    xs.forEach((x, index) => {
      const star = document.createElement('div');
      star.className = 'effect-star-shower';
      star.textContent = index % 3 === 0 ? '✦' : '★';
      star.style.setProperty('--sx', `${x}px`);
      star.style.animationDelay = `${(index % 8) * 0.11}s`;
      root.appendChild(star);
    });
    setTimeout(() => clearEffect(root), 2450);
  }

  function playDoubleBurst(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-double-pop');
    [0, 1].forEach((index) => {
      const ring = document.createElement('div');
      ring.className = 'effect-double-ring';
      ring.style.animationDelay = `${index * 0.48}s`;
      root.appendChild(ring);
    });
    const vectors = [
      [-170,-70],[-120,-145],[-30,-185],[70,-170],[150,-105],[185,-15],
      [165,85],[90,155],[0,185],[-100,155],[-165,85],[-190,-10]
    ];
    addParticles(root, 'effect-star', vectors, '★', 0.065);
    setTimeout(() => {
      addParticles(root, 'effect-star', vectors.map(([x,y]) => [-x * .72,-y * .72]), '✦', 0.05);
    }, 520);
    setTimeout(() => clearEffect(root), 2500);
  }

  function playCometCross(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-comet-pop');
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sy], index) => {
      const comet = document.createElement('div');
      comet.className = 'effect-comet';
      comet.style.setProperty('--from-x', `${sx * 240}px`);
      comet.style.setProperty('--from-y', `${sy * 230}px`);
      comet.style.setProperty('--to-x', `${-sx * 110}px`);
      comet.style.setProperty('--to-y', `${-sy * 95}px`);
      comet.style.animationDelay = `${index * 0.19}s`;
      root.appendChild(comet);
    });
    setTimeout(() => clearEffect(root), 2350);
  }

  function playSparkleRain(root) {
    if (!root) return;
    clearEffect(root);
    root.querySelector('.result-panel')?.classList.add('effect-sparkle-pop');
    const xs = [-175,-140,-105,-70,-35,0,35,70,105,140,175,-155,-85,-15,55,125];
    xs.forEach((x, index) => {
      const sparkle = document.createElement('div');
      sparkle.className = 'effect-sparkle-rain';
      sparkle.textContent = index % 2 ? '✦' : '✧';
      sparkle.style.setProperty('--rx', `${x}px`);
      sparkle.style.animationDelay = `${(index % 8) * 0.12}s`;
      root.appendChild(sparkle);
    });
    setTimeout(() => clearEffect(root), 2550);
  }

  const candidates = [
    { id: 'star-burst', name: 'スター爆発', description: '採用。2回目系で星が長めに飛び続ける', duration: 2500, play: playStarBurst },
    { id: 'star-shower', name: 'スターシャワー', description: '上から星が次々に降ってくる', duration: 2650, play: playStarShower },
    { id: 'double-burst', name: 'ダブルスター爆発', description: '採用。3回目系で時間差の星が2回弾ける', duration: 2700, play: playDoubleBurst },
    { id: 'comet-cross', name: '流星クロス', description: '四隅から流星が交差して走る', duration: 2550, play: playCometCross },
    { id: 'sparkle-rain', name: 'キラキラ雨', description: '細かな光が長めに降り続ける', duration: 2750, play: playSparkleRain },
    { id: 'rainbow', name: 'レインボーリング', description: '虹色の輪がゆっくり3段で広がる', duration: 2300, play: playRainbow },
    { id: 'confetti', name: '紙吹雪ポップ', description: '紙吹雪が少し長めに舞う', duration: 2400, play: playConfetti },
    { id: 'flash', name: 'パワーフラッシュ', description: '閃光と放射状の粒を長めに残す', duration: 2100, play: playFlash },
  ];

  function getCandidates() {
    return candidates.map(({ id, name, description, duration }) => ({ id, name, description, duration }));
  }

  function getCandidateDuration(id) {
    return candidates.find((item) => item.id === id)?.duration || 2400;
  }

  function playCandidate(id, root = document.getElementById('resultOverlay')) {
    const candidate = candidates.find((item) => item.id === id) || candidates[0];
    candidate?.play(root);
    return candidate?.id || null;
  }

  function encounterStage(count) {
    return ((Math.max(1, count) - 1) % 3) + 1;
  }

  function holdOverlay(root, duration) {
    if (!root) return;
    try {
      if (typeof overlayTimer !== 'undefined') clearTimeout(overlayTimer);
      overlayTimer = setTimeout(() => {
        root.classList.remove('show');
        root.setAttribute('aria-hidden', 'true');
        clearEffect(root);
      }, duration);
    } catch {
      setTimeout(() => {
        root.classList.remove('show');
        root.setAttribute('aria-hidden', 'true');
        clearEffect(root);
      }, duration);
    }
  }

  function playEncounterEffect(count, root = document.getElementById('resultOverlay')) {
    const stage = encounterStage(count);
    if (stage === 1) {
      playStart(root);
      holdOverlay(root, 2400);
      return 'start';
    }
    if (stage === 2) {
      playStarBurst(root);
      holdOverlay(root, 2800);
      return 'star-burst';
    }
    playDoubleBurst(root);
    holdOverlay(root, 3000);
    return 'double-burst';
  }

  window.PhotoEffects = {
    playStart,
    clearEffect,
    getCandidates,
    getCandidateDuration,
    playCandidate,
    playEncounterEffect,
  };

  if (typeof record === 'function' && typeof state !== 'undefined') {
    const originalRecord = record;
    record = function recordWithEncounterEffect(raw, source) {
      const beforeCount = state.events.length;
      const result = originalRecord(raw, source);
      if (state.events.length > beforeCount) {
        const added = state.events[state.events.length - 1];
        const groupCount = state.events.filter((e) => e.groupCode === added.groupCode).length;
        setTimeout(() => playEncounterEffect(groupCount, document.getElementById('resultOverlay')), 10);
      }
      return result;
    };
  }
})();
