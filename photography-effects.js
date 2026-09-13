(function () {
  function clearEffect(root) {
    if (!root) return;
    root.querySelectorAll('.effect-start-badge,.effect-start-ring,.effect-start-spark').forEach((el) => el.remove());
    root.querySelector('.result-panel')?.classList.remove('effect-start');
  }

  function playStart(root = document.getElementById('resultOverlay')) {
    if (!root) return;
    clearEffect(root);
    const panel = root.querySelector('.result-panel');
    if (panel) panel.classList.add('effect-start');

    const badge = document.createElement('div');
    badge.className = 'effect-start-badge';
    badge.textContent = 'START!';

    const ring = document.createElement('div');
    ring.className = 'effect-start-ring';

    root.append(badge, ring);

    const vectors = [
      [-120,-80],[-70,-130],[0,-145],[75,-125],[125,-70],
      [135,10],[95,95],[20,135],[-70,120],[-125,65],[-140,-10],[-95,-75]
    ];
    vectors.forEach(([x,y], index) => {
      const spark = document.createElement('div');
      spark.className = 'effect-start-spark';
      spark.style.setProperty('--dx', `${x}px`);
      spark.style.setProperty('--dy', `${y}px`);
      spark.style.animationDelay = `${index * 0.018}s`;
      root.appendChild(spark);
    });

    setTimeout(() => clearEffect(root), 1150);
  }

  window.PhotoEffects = { playStart, clearEffect };

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
