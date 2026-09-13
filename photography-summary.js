// 撮影チェック一覧の横並び表示を上書きする。
// 左: 班コード / チェック回数、右: 古い時刻 -> 最新時刻。
// 班の並び順は configuredGroups() の順番をそのまま使い、撮影回数では並べ替えない。
renderSummary = function renderPhotographySummary(groups) {
  const by = new Map(groups.map((g) => [g, []]));
  for (const event of state.events) {
    if (by.has(event.groupCode)) by.get(event.groupCode).push(event);
  }

  els.totalEvents.textContent = `${state.events.length}件`;
  els.groupSummaryList.innerHTML = '';

  [...by.entries()].forEach(([groupCode, events]) => {
    const row = document.createElement('div');
    row.className = 'group-row group-row-timeline';

    const identity = document.createElement('div');
    identity.className = 'group-identity';

    const code = document.createElement('span');
    code.className = 'group-code';
    code.textContent = groupCode;

    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = `${events.length}回`;

    identity.append(code, count);

    const timeline = document.createElement('div');
    timeline.className = 'group-times';

    if (!events.length) {
      const empty = document.createElement('span');
      empty.className = 'group-time-empty';
      empty.textContent = '未撮影';
      timeline.appendChild(empty);
    } else {
      events.forEach((event, index) => {
        const item = document.createElement('span');
        item.className = 'group-time-item';
        if (index === events.length - 1) item.classList.add('latest');
        item.textContent = `${time(event.capturedAt)} ${event.photographerName}`;
        item.title = `${index + 1}回目 / ${event.photographerName}`;
        timeline.appendChild(item);
      });
    }

    row.append(identity, timeline);
    els.groupSummaryList.appendChild(row);
  });
};

render();
