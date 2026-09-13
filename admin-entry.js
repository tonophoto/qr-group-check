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
      if (window.QRAccess?.role !== 'admin') return;
      const url = new URL('./admin-check.html', window.location.href);
      if (window.QRAccess?.tripId) url.searchParams.set('trip', window.QRAccess.tripId);
      window.location.href = url.toString();
      return;
    }

    resetTimer = setTimeout(() => {
      taps = 0;
    }, 4000);
  });
})();
