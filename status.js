function renderTargetStatus() {
  const card = document.getElementById('targetStatusCard');
  const list = document.getElementById('targetStatusList');
  const summary = document.getElementById('targetStatusSummary');
  if (!card || !list || !summary) return;

  const visible = state.status === 'active' || state.status === 'ended';
  card.hidden = !visible;
  if (!visible) return;

  const groups = allGroups();
  const checkMap = new Map(state.checks.map((item) => [item.code, item]));
  const checkedCount = groups.filter((code) => checkMap.has(code)).length;
  summary.textContent = `${checkedCount} / ${groups.length}班`;

  list.innerHTML = '';
  let currentPrefix = null;
  let groupBlock = null;

  groups.forEach((code) => {
    const prefix = code.split('-')[0];
    if (prefix !== currentPrefix) {
      currentPrefix = prefix;
      const section = document.createElement('section');
      section.className = 'status-class';

      const heading = document.createElement('div');
      heading.className = 'status-class-head';
      heading.textContent = `${prefix}組`;
      section.appendChild(heading);

      groupBlock = document.createElement('div');
      groupBlock.className = 'status-grid';
      section.appendChild(groupBlock);
      list.appendChild(section);
    }

    const item = document.createElement('div');
    const check = checkMap.get(code);
    item.className = `status-item ${check ? 'is-checked' : 'is-unchecked'}`;

    const icon = document.createElement('span');
    icon.className = 'status-icon';
    icon.textContent = check ? '✓' : '—';

    const codeEl = document.createElement('strong');
    codeEl.className = 'status-code';
    codeEl.textContent = code;

    const meta = document.createElement('span');
    meta.className = 'status-meta';
    meta.textContent = check ? `${formatTime(check.checkedAt)} 済` : '未チェック';

    item.append(icon, codeEl, meta);
    groupBlock.appendChild(item);
  });
}

const renderBeforeTargetStatus = render;
render = function renderWithTargetStatus() {
  renderBeforeTargetStatus();
  renderTargetStatus();
};

renderTargetStatus();
