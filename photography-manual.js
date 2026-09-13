const manualToggleBtn = document.getElementById('manualToggleBtn');
const manualGroupPanel = document.getElementById('manualGroupPanel');
const manualGroupButtons = document.getElementById('manualGroupButtons');

function closeManualGroupPanel() {
  if (!manualToggleBtn || !manualGroupPanel) return;
  manualGroupPanel.hidden = true;
  manualToggleBtn.setAttribute('aria-expanded', 'false');
  manualToggleBtn.textContent = 'QRが読めないとき：手動入力';
}

function renderManualGroupButtons() {
  if (!manualGroupButtons) return;
  manualGroupButtons.innerHTML = '';

  const groups = configuredGroups();
  groups.forEach((code) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'manual-group-button';
    button.textContent = code;
    button.addEventListener('click', () => {
      const beforeCount = state.events.length;
      record(code, 'manual-button');
      if (state.events.length > beforeCount) closeManualGroupPanel();
    });
    manualGroupButtons.appendChild(button);
  });
}

if (manualToggleBtn && manualGroupPanel) {
  manualToggleBtn.addEventListener('click', () => {
    const willOpen = manualGroupPanel.hidden;
    manualGroupPanel.hidden = !willOpen;
    manualToggleBtn.setAttribute('aria-expanded', String(willOpen));
    manualToggleBtn.textContent = willOpen ? '手動入力を閉じる' : 'QRが読めないとき：手動入力';
    if (willOpen) renderManualGroupButtons();
  });
}

renderManualGroupButtons();
