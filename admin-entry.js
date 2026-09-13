(function () {
  const trigger = document.getElementById('adminTapTrigger');
  if (!trigger) return;

  let taps = 0;
  let resetTimer = null;

  trigger.addEventListener('click', () => {
    taps += 1;
    clearTimeout(resetTimer);

    if (taps >= 10) {
      taps = 0;
      window.location.href = './admin-check.html';
      return;
    }

    resetTimer = setTimeout(() => {
      taps = 0;
    }, 4000);
  });
})();
