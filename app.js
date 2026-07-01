import { store } from './store.js';

const main = document.getElementById('main-content');
const navBtns = document.querySelectorAll('.nav-btn');

const CATEGORIES = ['Body', 'Mind', 'Heart', 'Exploration'];

let currentView = 'log';
let manageTab = 'skills';
let promotingSkillId = null; // skill awaiting promotion confirmation

// Log view state
let logSearch = '';
let logSelected = null;   // { type: 'activity'|'new', activity? }
let logXpSplits = {};     // { categoryName: xpValue }
let logTimestamp = null;  // ms, null = now

function setView(view) {
  currentView = view;
  navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  render();
}

function render() {
  switch (currentView) {
    case 'log':      main.innerHTML = renderLog();      break;
    case 'progress': main.innerHTML = renderProgress(); break;
    case 'report':   main.innerHTML = renderReport();   break;
    case 'manage':   main.innerHTML = renderManage();   break;
  }
  attachHandlers();
}

// ── Log ──────────────────────────────────────────────────────────────────────

function renderSearchDropdown(query, activities) {
  if (!query) return '';
  const { skills } = store.getState();
  const skillMap = Object.fromEntries(skills.map(s => [s.id, s.name]));
  const matches = activities.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));
  return `
    <ul class="autocomplete-list" id="log-dropdown">
      ${matches.map(a => {
        const linkedNames = (a.skillIds || []).map(id => skillMap[id]).filter(Boolean);
        const meta = linkedNames.length > 0 ? linkedNames.join(', ') : 'No skills linked';
        return `
        <li class="autocomplete-item" data-action="select-activity" data-id="${a.id}">
          <span class="ac-name">${esc(a.name)}</span>
          <span class="ac-meta">${meta} &middot; ${a.defaultXp} XP</span>
        </li>
      `}).join('')}
      <li class="autocomplete-item autocomplete-new" data-action="select-new" data-name="${esc(query)}">
        <span class="ac-name">+ Add "${esc(query)}"</span>
        <span class="ac-meta">New activity</span>
      </li>
    </ul>
  `;
}

function renderLog() {
  const { activities, accomplishments, skills } = store.getState();
  const skillMap = Object.fromEntries(skills.map(s => [s.id, s.name]));
  const unclaimedAccomplishments = accomplishments.filter(a => !a.claimed);

  return `
    <h2 class="view-title">Log Activity</h2>

    ${logSelected ? renderLogForm() : `
      <div class="log-search-wrap">
        <input
          class="text-input"
          id="log-search"
          placeholder="Search activities..."
          autocomplete="off"
          value="${esc(logSearch)}"
        />
        ${renderSearchDropdown(logSearch, activities)}
      </div>
    `}

    ${unclaimedAccomplishments.length > 0 ? `
      <div class="section-divider">
        <span>Achievements</span>
      </div>
      <ul class="item-list">
        ${unclaimedAccomplishments.map(a => {
          const linkedNames = (a.skillIds || []).map(id => skillMap[id]).filter(Boolean);
          const meta = linkedNames.length > 0 ? linkedNames.join(', ') : 'No skills linked';
          return `
          <li class="item-row accomplishment-claimable" data-action="claim-accomplishment" data-id="${a.id}">
            <div class="item-info">
              <span class="item-name">${esc(a.name)}</span>
              <span class="item-meta">${meta} &middot; ${a.xp} XP</span>
            </div>
            <button class="btn-claim" data-action="claim-accomplishment" data-id="${a.id}">Claim</button>
          </li>
        `}).join('')}
      </ul>
    ` : ''}
  `;
}

function renderLogForm() {
  const sel = logSelected;
  const isNew = sel.type === 'new';
  const activity = sel.activity;
  const linkedSkillIds = activity ? (activity.skillIds || []) : [];
  const defaultXp = activity ? activity.defaultXp : 5;

  const totalXp = Object.values(logXpSplits).reduce((s, v) => s + v, 0);

  const now = new Date();
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
  const timestampVal = logTimestamp
    ? new Date(new Date(logTimestamp).getTime() - new Date(logTimestamp).getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16)
    : localIso;

  return `
    <div class="log-form-header">
      <button class="btn-back" data-action="log-back">&#8592;</button>
      <span class="log-form-title">${isNew ? `New: "${esc(sel.name)}"` : esc(activity.name)}</span>
    </div>

    ${isNew ? `
      <div class="add-form" style="margin-bottom:16px;">
        <label class="field-label" style="flex-direction:column;align-items:flex-start;gap:6px;">
          <span>Skills for this new activity</span>
          <div class="cat-group">${renderLogSkillPicker()}</div>
        </label>
        <label class="field-label">Save as recurring activity?
          <input type="checkbox" id="save-activity" style="width:18px;height:18px;accent-color:var(--accent);">
        </label>
      </div>
    ` : ''}

    <div class="add-form">
      <p class="split-label">XP per skill</p>
      <div class="xp-split-rows" id="xp-split-rows">
        ${isNew ? renderNewActivitySkillRows() : renderSkillSplitRows(linkedSkillIds, defaultXp)}
      </div>
      <div class="xp-total">Total: <strong>${totalXp} XP</strong></div>

      <label class="field-label">When
        <input type="datetime-local" class="select-input" id="log-timestamp" value="${timestampVal}" />
      </label>

      <button class="btn-primary" id="log-submit" ${totalXp === 0 ? 'disabled' : ''}>Log Entry</button>
    </div>
  `;
}

function renderLogSkillPicker() {
  const { skills } = store.getState();
  if (skills.length === 0) {
    return `<p class="placeholder" style="margin:0;font-size:0.85rem;">Add skills first to link them here.</p>`;
  }
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  return sorted.map(s => `
    <label class="cat-check">
      <input type="checkbox" class="split-skill-check" data-skillid="${s.id}" ${logXpSplits[s.id] != null ? 'checked' : ''}>
      <span>${esc(s.name)}</span>
    </label>
  `).join('');
}

function renderNewActivitySkillRows() {
  // Renders XP chip rows for skills already checked in logXpSplits (new-activity flow)
  const { skills } = store.getState();
  const selectedIds = Object.keys(logXpSplits);
  if (selectedIds.length === 0) {
    return `<p class="placeholder" style="margin:0;font-size:0.85rem;">Select skills above to assign XP.</p>`;
  }
  return selectedIds.map(skillId => {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) return '';
    const xpVal = logXpSplits[skillId] ?? 5;
    return `
      <div class="xp-split-row" id="xp-row-${skillId}">
        <span class="xp-split-skill-name">${esc(skill.name)}</span>
        <div class="xp-split-controls" data-skillid="${skillId}">
          ${[1, 2, 5, 10, 50, 100].map(v => `
            <button class="xp-chip ${xpVal === v ? 'active' : ''}" data-action="set-xp" data-skillid="${skillId}" data-val="${v}">${v}</button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderSkillSplitRows(linkedSkillIds = [], defaultXp = 5) {
  const { skills } = store.getState();
  if (linkedSkillIds.length === 0) {
    return `<p class="placeholder" style="margin:0;font-size:0.85rem;">No skills linked to this activity.</p>`;
  }
  const linkedSkills = linkedSkillIds.map(id => skills.find(s => s.id === id)).filter(Boolean);
  return linkedSkills.map(skill => {
    const xpVal = logXpSplits[skill.id] ?? defaultXp;
    return `
      <div class="xp-split-row">
        <span class="xp-split-skill-name">${esc(skill.name)}</span>
        <div class="xp-split-controls" data-skillid="${skill.id}">
          ${[1, 2, 5, 10, 50, 100].map(v => `
            <button class="xp-chip ${xpVal === v ? 'active' : ''}" data-action="set-xp" data-skillid="${skill.id}" data-val="${v}">${v}</button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ── Progress ─────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 100;

const TIER_CAP = { Beginner: 5, Intermediate: 10, Advanced: Infinity };

function skillXpFromLogs(skill, logs) {
  let total = 0;
  for (const log of logs) {
    const xp = (log.xpSplits || {})[skill.id];
    if (xp != null) total += xp;
  }
  return total;
}

function xpInCurrentTier(skill, totalXp) {
  // XP earned before this tier started is stored as promotedXpOffset on the skill
  return totalXp - (skill.promotedXpOffset || 0);
}

function levelFromXp(xpInTier) {
  return Math.floor(xpInTier / XP_PER_LEVEL) + 1;
}

function xpProgress(xpInTier) {
  return xpInTier % XP_PER_LEVEL;
}

function renderProgress() {
  const { skills, logs } = store.getState();

  if (promotingSkillId) {
    return renderPromotionScreen(skills.find(s => s.id === promotingSkillId));
  }

  if (skills.length === 0) {
    return `
      <h2 class="view-title">Progress</h2>
      <p class="placeholder">Add skills in Manage to start tracking progress.</p>
    `;
  }

  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));

  return `
    <h2 class="view-title">Progress</h2>
    ${sorted.map(skill => renderSkillCard(skill, logs)).join('')}
  `;
}

function renderSkillCard(skill, logs) {
  const totalXp = skillXpFromLogs(skill, logs);
  const xpThisTier = xpInCurrentTier(skill, totalXp);
  const computedLevel = levelFromXp(xpThisTier);
  const cap = TIER_CAP[skill.tier];
  const level = Math.min(computedLevel, cap);
  const atCap = computedLevel >= cap && skill.tier !== 'Advanced';
  const xpInLevel = xpProgress(xpThisTier);
  const pct = atCap ? 100 : Math.round((xpInLevel / XP_PER_LEVEL) * 100);

  const label = `${skill.tier} ${level}`;
  const nextLabel = atCap
    ? (skill.tier === 'Beginner' ? 'Intermediate 1' : 'Advanced 1')
    : `${skill.tier} ${level + 1}`;

  return `
    <div class="skill-card">
      <div class="skill-card-top">
        <span class="skill-card-name">${esc(skill.name)}</span>
        <span class="skill-card-tier ${atCap ? 'tier-ready' : ''}">${label}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill ${atCap ? 'bar-ready' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="skill-card-bottom">
        <span class="skill-card-xp">${atCap ? 'Ready to promote!' : `${xpInLevel} / ${XP_PER_LEVEL} XP`}</span>
      </div>
      ${atCap ? `
        <button class="btn-promote" data-action="promote-skill" data-id="${skill.id}">
          Promote to ${nextLabel}
        </button>
      ` : ''}
    </div>
  `;
}

function renderPromotionScreen(skill) {
  if (!skill) return '';
  const { tier } = skill;
  const nextTier = tier === 'Beginner' ? 'Intermediate' : 'Advanced';
  return `
    <div class="promotion-screen">
      <div class="promotion-icon">&#9733;</div>
      <h2 class="promotion-title">Tier Up!</h2>
      <p class="promotion-skill-name">${esc(skill.name)}</p>
      <p class="promotion-message">
        You've mastered <strong>${tier}</strong> level.<br>
        Ready to advance to <strong>${nextTier}</strong>?
      </p>
      <button class="btn-primary" data-action="confirm-promote" data-id="${skill.id}">
        Advance to ${nextTier}
      </button>
      <button class="btn-back-plain" data-action="cancel-promote">Not yet</button>
    </div>
  `;
}

// ── Report ───────────────────────────────────────────────────────────────────

let reportPeriod = 'week'; // 'week' | 'month'

function periodRange(period) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(end);
  if (period === 'week') {
    start.setDate(end.getDate() - 6);
  } else {
    start.setDate(end.getDate() - 29);
  }
  start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}

function logsInPeriod(logs, start, end) {
  return logs.filter(l => l.timestamp >= start && l.timestamp <= end);
}

function categoryXpForPeriod(skills, logs) {
  const catXp = {};
  for (const cat of CATEGORIES) catXp[cat] = 0;
  for (const skill of skills) {
    const skillXp = skillXpFromLogs(skill, logs);
    for (const cat of (skill.categories || [])) {
      if (cat in catXp) catXp[cat] += skillXp;
    }
  }
  return catXp;
}

function renderReport() {
  const { skills, logs } = store.getState();
  const { start, end } = periodRange(reportPeriod);
  const periodLogs = logsInPeriod(logs, start, end);

  const totalXp = periodLogs.reduce((sum, l) => {
    return sum + Object.values(l.xpSplits || {}).reduce((s, v) => s + v, 0);
  }, 0);

  // Which skills got XP in this period?
  const activeSkillIds = new Set();
  for (const log of periodLogs) {
    for (const [sid, xp] of Object.entries(log.xpSplits || {})) {
      if (xp > 0) activeSkillIds.add(sid);
    }
  }
  const workedSkills = skills.filter(s => activeSkillIds.has(s.id));
  const neglectedSkills = skills.filter(s => !activeSkillIds.has(s.id));

  const catXp = categoryXpForPeriod(skills, periodLogs);
  const maxCatXp = Math.max(...Object.values(catXp), 1);

  return `
    <h2 class="view-title">Report Card</h2>

    <div class="report-toggle">
      <button class="toggle-btn ${reportPeriod === 'week' ? 'active' : ''}" data-action="report-period" data-period="week">This Week</button>
      <button class="toggle-btn ${reportPeriod === 'month' ? 'active' : ''}" data-action="report-period" data-period="month">This Month</button>
    </div>

    <div class="report-section">
      <div class="report-stat-row">
        <div class="report-stat">
          <span class="report-stat-value">${totalXp}</span>
          <span class="report-stat-label">Total XP</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-value">${workedSkills.length}</span>
          <span class="report-stat-label">Skills trained</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-value">${periodLogs.length}</span>
          <span class="report-stat-label">Entries logged</span>
        </div>
      </div>
    </div>

    ${totalXp === 0 ? `
      <p class="placeholder" style="margin-top:32px;">No activity logged ${reportPeriod === 'week' ? 'this week' : 'this month'}.</p>
    ` : `
      <div class="report-section">
        <p class="report-section-title">XP by Category</p>
        ${renderRadarChart(catXp)}
        <div class="report-cat-bars">
          ${CATEGORIES.map(cat => {
            const pct = Math.round((catXp[cat] / maxCatXp) * 100);
            return `
              <div class="report-cat-row">
                <span class="report-cat-name">${cat}</span>
                <div class="report-cat-bar-wrap">
                  <div class="report-cat-bar-fill" style="width:${pct}%"></div>
                </div>
                <span class="report-cat-xp">${catXp[cat]}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="report-section">
        <p class="report-section-title">XP Trend</p>
        ${renderTrendChart(periodLogs, start, end, reportPeriod)}
      </div>

      <div class="report-section">
        <p class="report-section-title">Skills Trained</p>
        ${workedSkills.length === 0
          ? `<p class="report-empty">None yet.</p>`
          : `<div class="report-skill-chips">${workedSkills.map(s => `<span class="report-chip active">${esc(s.name)}</span>`).join('')}</div>`
        }
      </div>

      ${neglectedSkills.length > 0 ? `
        <div class="report-section">
          <p class="report-section-title">Skills Neglected</p>
          <div class="report-skill-chips">${neglectedSkills.map(s => `<span class="report-chip">${esc(s.name)}</span>`).join('')}</div>
        </div>
      ` : ''}
    `}
  `;
}

function renderRadarChart(catXp) {
  const cats = CATEGORIES;
  const n = cats.length;
  const cx = 120, cy = 120, r = 90;
  const maxVal = Math.max(...Object.values(catXp), 1);

  function point(i, fraction) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + r * fraction * Math.cos(angle),
      y: cy + r * fraction * Math.sin(angle),
    };
  }

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1].map(f => {
    const pts = cats.map((_, i) => point(i, f));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
  });

  // Axes
  const axes = cats.map((_, i) => {
    const p = point(i, 1);
    return `M${cx},${cy} L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  });

  // Data polygon
  const dataFraction = cats.map(c => Math.min(catXp[c] / maxVal, 1));
  const dataPts = cats.map((_, i) => point(i, dataFraction[i]));
  const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  // Labels
  const labels = cats.map((cat, i) => {
    const p = point(i, 1.2);
    return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="radar-label" text-anchor="middle" dominant-baseline="middle">${cat}</text>`;
  });

  return `
    <svg class="radar-chart" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      ${rings.map(d => `<path d="${d}" class="radar-ring" />`).join('')}
      ${axes.map(d => `<path d="${d}" class="radar-axis" />`).join('')}
      <path d="${dataPath}" class="radar-data" />
      ${labels.join('')}
    </svg>
  `;
}

function renderTrendChart(periodLogs, start, end, period) {
  const days = period === 'week' ? 7 : 30;
  const buckets = [];
  for (let i = 0; i < days; i++) {
    const bucketStart = start + i * 86400000;
    const bucketEnd = bucketStart + 86399999;
    const xp = periodLogs
      .filter(l => l.timestamp >= bucketStart && l.timestamp <= bucketEnd)
      .reduce((sum, l) => sum + Object.values(l.xpSplits || {}).reduce((s, v) => s + v, 0), 0);
    buckets.push(xp);
  }

  const maxXp = Math.max(...buckets, 1);
  const W = 280, H = 100, pad = { l: 8, r: 8, t: 8, b: 24 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const barW = Math.max(1, (chartW / days) - 2);
  const gap = (chartW - barW * days) / (days - 1 || 1);

  const bars = buckets.map((xp, i) => {
    const barH = xp === 0 ? 2 : Math.max(4, (xp / maxXp) * chartH);
    const x = pad.l + i * (barW + gap);
    const y = pad.t + chartH - barH;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" class="trend-bar ${xp > 0 ? 'has-xp' : ''}" rx="2" />`;
  });

  // Day labels: for week show Mon-Sun abbreviations; for month show week markers
  const labelIndices = period === 'week' ? [0,1,2,3,4,5,6] : [0, 6, 13, 20, 27];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const labelEls = labelIndices.map(i => {
    const date = new Date(start + i * 86400000);
    const label = period === 'week' ? dayNames[date.getDay()] : `${date.getMonth()+1}/${date.getDate()}`;
    const x = pad.l + i * (barW + gap) + barW / 2;
    return `<text x="${x.toFixed(1)}" y="${H - 4}" class="trend-label" text-anchor="middle">${label}</text>`;
  });

  return `
    <svg class="trend-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${bars.join('')}
      ${labelEls.join('')}
    </svg>
  `;
}

// ── Manage ───────────────────────────────────────────────────────────────────

function renderManage() {
  return `
    <h2 class="view-title">Manage</h2>
    <div class="tab-bar">
      <button class="tab-btn ${manageTab === 'skills' ? 'active' : ''}" data-tab="skills">Skills</button>
      <button class="tab-btn ${manageTab === 'activities' ? 'active' : ''}" data-tab="activities">Activities</button>
      <button class="tab-btn ${manageTab === 'accomplishments' ? 'active' : ''}" data-tab="accomplishments">Achievements</button>
    </div>
    <div class="tab-content">
      ${manageTab === 'skills' ? renderSkillsTab() : ''}
      ${manageTab === 'activities' ? renderActivitiesTab() : ''}
      ${manageTab === 'accomplishments' ? renderAccomplishmentsTab() : ''}
    </div>
  `;
}

function categoryCheckboxes(selected = []) {
  return CATEGORIES.map(cat => `
    <label class="cat-check">
      <input type="checkbox" name="categories" value="${cat}" ${selected.includes(cat) ? 'checked' : ''}>
      <span>${cat}</span>
    </label>
  `).join('');
}

function skillCheckboxes(selectedIds = []) {
  const { skills } = store.getState();
  if (skills.length === 0) {
    return `<p class="placeholder" style="margin:0;font-size:0.85rem;">Add skills first to link activities to them.</p>`;
  }
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  return sorted.map(s => `
    <label class="cat-check">
      <input type="checkbox" name="skillIds" value="${s.id}" ${selectedIds.includes(s.id) ? 'checked' : ''}>
      <span>${esc(s.name)}</span>
    </label>
  `).join('');
}

// ── Skills tab ───────────────────────────────────────────────────────────────

function renderSkillsTab() {
  const { skills } = store.getState();
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  return `
    <form class="add-form" id="skill-form">
      <input class="text-input" name="name" placeholder="Skill name" required autocomplete="off" />
      <div class="cat-group">${categoryCheckboxes()}</div>
      <button class="btn-primary" type="submit">Add Skill</button>
    </form>
    <ul class="item-list" id="skill-list">
      ${sorted.length === 0 ? '<li class="empty-msg">No skills yet.</li>' : sorted.map(s => `
        <li class="item-row" data-id="${s.id}">
          <div class="item-info">
            <span class="item-name">${esc(s.name)}</span>
            <span class="item-meta">${(s.categories || []).join(', ') || 'No category'} &middot; ${tierLabel(s.tier, s.level)}</span>
          </div>
          <button class="btn-delete" data-action="delete-skill" data-id="${s.id}" aria-label="Delete">&#x2715;</button>
        </li>
      `).join('')}
    </ul>
  `;
}

// ── Activities tab ───────────────────────────────────────────────────────────

function renderActivitiesTab() {
  const { activities, skills } = store.getState();
  const skillMap = Object.fromEntries(skills.map(s => [s.id, s.name]));
  return `
    <form class="add-form" id="activity-form">
      <input class="text-input" name="name" placeholder="Activity name" required autocomplete="off" />
      <label class="field-label">Default XP
        <select class="select-input" name="defaultXp">
          ${[1, 2, 5, 10, 50, 100].map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
      </label>
      <div class="cat-group">${skillCheckboxes()}</div>
      <button class="btn-primary" type="submit">Add Activity</button>
    </form>
    <ul class="item-list" id="activity-list">
      ${activities.length === 0 ? '<li class="empty-msg">No activities yet.</li>' : activities.map(a => {
        const linkedNames = (a.skillIds || []).map(id => skillMap[id]).filter(Boolean);
        const meta = linkedNames.length > 0 ? linkedNames.join(', ') : 'No skills linked';
        return `
        <li class="item-row" data-id="${a.id}">
          <div class="item-info">
            <span class="item-name">${esc(a.name)}</span>
            <span class="item-meta">${meta} &middot; ${a.defaultXp} XP</span>
          </div>
          <button class="btn-delete" data-action="delete-activity" data-id="${a.id}" aria-label="Delete">&#x2715;</button>
        </li>
      `}).join('')}
    </ul>
  `;
}

// ── Accomplishments tab ───────────────────────────────────────────────────────

function renderAccomplishmentsTab() {
  const { accomplishments, skills } = store.getState();
  const skillMap = Object.fromEntries(skills.map(s => [s.id, s.name]));
  return `
    <form class="add-form" id="accomplishment-form">
      <input class="text-input" name="name" placeholder="Achievement name" required autocomplete="off" />
      <label class="field-label">XP reward
        <select class="select-input" name="xp">
          ${[1, 2, 5, 10, 50, 100].map(v => `<option value="${v}" ${v === 50 ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>
      <div class="cat-group">${skillCheckboxes()}</div>
      <button class="btn-primary" type="submit">Add Achievement</button>
    </form>
    <ul class="item-list" id="accomplishment-list">
      ${accomplishments.length === 0 ? '<li class="empty-msg">No achievements yet.</li>' : accomplishments.map(a => {
        const linkedNames = (a.skillIds || []).map(id => skillMap[id]).filter(Boolean);
        const meta = linkedNames.length > 0 ? linkedNames.join(', ') : 'No skills linked';
        return `
        <li class="item-row ${a.claimed ? 'claimed' : ''}" data-id="${a.id}">
          <div class="item-info">
            <span class="item-name">${esc(a.name)}${a.claimed ? ' <span class="claimed-badge">claimed</span>' : ''}</span>
            <span class="item-meta">${meta} &middot; ${a.xp} XP</span>
          </div>
          <button class="btn-delete" data-action="delete-accomplishment" data-id="${a.id}" aria-label="Delete">&#x2715;</button>
        </li>
      `}).join('')}
    </ul>
  `;
}

// ── Event delegation ──────────────────────────────────────────────────────────

function attachDropdownHandlers() {
  document.querySelectorAll('[data-action="select-activity"]').forEach(el => {
    el.addEventListener('click', () => {
      const { activities } = store.getState();
      const activity = activities.find(a => a.id === el.dataset.id);
      if (!activity) return;
      logSelected = { type: 'activity', activity };
      logXpSplits = {};
      (activity.skillIds || []).forEach(skillId => {
        logXpSplits[skillId] = activity.defaultXp;
      });
      logSearch = '';
      render();
    });
  });

  const selectNewEl = document.querySelector('[data-action="select-new"]');
  if (selectNewEl) {
    selectNewEl.addEventListener('click', () => {
      logSelected = { type: 'new', name: selectNewEl.dataset.name };
      logXpSplits = {};
      logSearch = '';
      render();
    });
  }
}

function attachHandlers() {
  // ── Manage: tab switching ──
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      manageTab = btn.dataset.tab;
      render();
    });
  });

  // ── Manage: skill form ──
  const skillForm = document.getElementById('skill-form');
  if (skillForm) {
    skillForm.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(skillForm);
      const name = fd.get('name').trim();
      const categories = fd.getAll('categories');
      if (!name) return;
      store.addSkill({ name, categories, tier: 'Beginner', level: 1, xp: 0 });
      render();
    });
  }

  // ── Manage: activity form ──
  const activityForm = document.getElementById('activity-form');
  if (activityForm) {
    activityForm.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(activityForm);
      const name = fd.get('name').trim();
      const skillIds = fd.getAll('skillIds');
      const defaultXp = Number(fd.get('defaultXp'));
      if (!name) return;
      store.addActivity({ name, skillIds, defaultXp });
      render();
    });
  }

  // ── Manage: accomplishment form ──
  const accomplishmentForm = document.getElementById('accomplishment-form');
  if (accomplishmentForm) {
    accomplishmentForm.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(accomplishmentForm);
      const name = fd.get('name').trim();
      const skillIds = fd.getAll('skillIds');
      const xp = Number(fd.get('xp'));
      if (!name) return;
      store.addAccomplishment({ name, skillIds, xp });
      render();
    });
  }

  // ── Manage: delete buttons ──
  document.querySelectorAll('[data-action^="delete-"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset;
      if (action === 'delete-skill') store.deleteSkill(id);
      else if (action === 'delete-activity') store.deleteActivity(id);
      else if (action === 'delete-accomplishment') store.deleteAccomplishment(id);
      render();
    });
  });

  // ── Log: search input ──
  const logSearchEl = document.getElementById('log-search');
  if (logSearchEl) {
    logSearchEl.addEventListener('input', e => {
      logSearch = e.target.value;
      const { activities } = store.getState();
      const wrap = document.querySelector('.log-search-wrap');
      const existing = document.getElementById('log-dropdown');
      if (existing) existing.remove();
      const html = renderSearchDropdown(logSearch, activities);
      if (html) wrap.insertAdjacentHTML('beforeend', html);
      attachDropdownHandlers();
    });
  }

  attachDropdownHandlers();

  // ── Log: back button ──
  const backBtn = document.querySelector('[data-action="log-back"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      logSelected = null;
      logXpSplits = {};
      render();
    });
  }

  // ── Log: skill toggles in XP split (new-activity flow) ──
  document.querySelectorAll('.split-skill-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const skillId = chk.dataset.skillid;
      if (chk.checked) {
        logXpSplits[skillId] = logXpSplits[skillId] ?? 5;
      } else {
        delete logXpSplits[skillId];
      }
      // re-render the XP rows section to add/remove the row for this skill
      const rowsEl = document.getElementById('xp-split-rows');
      if (rowsEl) {
        rowsEl.innerHTML = renderNewActivitySkillRows();
        attachHandlers();
      }
      updateXpTotal();
    });
  });

  // ── Log: XP chip buttons ──
  document.querySelectorAll('[data-action="set-xp"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { skillid, val } = btn.dataset;
      logXpSplits[skillid] = Number(val);
      document.querySelectorAll(`.xp-chip[data-skillid="${skillid}"]`).forEach(c => {
        c.classList.toggle('active', Number(c.dataset.val) === Number(val));
      });
      updateXpTotal();
    });
  });

  // ── Log: timestamp change ──
  const tsEl = document.getElementById('log-timestamp');
  if (tsEl) {
    tsEl.addEventListener('change', () => {
      logTimestamp = tsEl.value ? new Date(tsEl.value).getTime() : null;
    });
  }

  // ── Log: submit entry ──
  const logSubmit = document.getElementById('log-submit');
  if (logSubmit) {
    logSubmit.addEventListener('click', () => {
      const sel = logSelected;
      if (!sel) return;
      const totalXp = Object.values(logXpSplits).reduce((s, v) => s + v, 0);
      if (totalXp === 0) return;

      const ts = logTimestamp ?? Date.now();
      let activityId = sel.type === 'activity' ? sel.activity.id : null;
      let activityName = sel.type === 'activity' ? sel.activity.name : sel.name;

      // optionally save as a new activity
      if (sel.type === 'new') {
        const saveChk = document.getElementById('save-activity');
        if (saveChk && saveChk.checked) {
          const skillIds = Object.keys(logXpSplits);
          const topXp = Object.entries(logXpSplits).sort((a, b) => b[1] - a[1])[0];
          store.addActivity({ name: sel.name, skillIds, defaultXp: topXp ? topXp[1] : 5 });
          activityId = store.getState().activities.at(-1).id;
        }
      }

      store.addLog({
        activityId,
        activityName,
        xpSplits: { ...logXpSplits },
        timestamp: ts,
      });

      // reset log state
      logSelected = null;
      logXpSplits = {};
      logTimestamp = null;
      render();
    });
  }

  // ── Log: claim accomplishment ──
  document.querySelectorAll('[data-action="claim-accomplishment"]').forEach(el => {
    el.addEventListener('click', () => {
      const { accomplishments } = store.getState();
      const acc = accomplishments.find(a => a.id === el.dataset.id);
      if (!acc) return;
      const xpSplits = Object.fromEntries((acc.skillIds || []).map(id => [id, acc.xp]));
      store.addLog({ activityName: acc.name, xpSplits, timestamp: Date.now() });
      store.claimAccomplishment(acc.id);
      render();
    });
  });

  // ── Report: period toggle ──
  document.querySelectorAll('[data-action="report-period"]').forEach(btn => {
    btn.addEventListener('click', () => {
      reportPeriod = btn.dataset.period;
      render();
    });
  });

  // ── Progress: promote button ──
  document.querySelectorAll('[data-action="promote-skill"]').forEach(btn => {
    btn.addEventListener('click', () => {
      promotingSkillId = btn.dataset.id;
      render();
    });
  });

  // ── Progress: confirm promotion ──
  const confirmBtn = document.querySelector('[data-action="confirm-promote"]');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const id = confirmBtn.dataset.id;
      const { skills, logs } = store.getState();
      const skill = skills.find(s => s.id === id);
      if (skill) {
        const totalXp = skillXpFromLogs(skill, logs);
        // Record how much XP has been spent so far so the new tier starts at 0
        store.promoteSkill(id, totalXp);
      }
      promotingSkillId = null;
      render();
    });
  }

  // ── Progress: cancel promotion ──
  const cancelBtn = document.querySelector('[data-action="cancel-promote"]');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      promotingSkillId = null;
      render();
    });
  }
}

function updateXpTotal() {
  const total = Object.values(logXpSplits).reduce((s, v) => s + v, 0);
  const totalEl = document.querySelector('.xp-total strong');
  if (totalEl) totalEl.textContent = `${total} XP`;
  const submitBtn = document.getElementById('log-submit');
  if (submitBtn) submitBtn.disabled = total === 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tierLabel(tier = 'Beginner', level = 1) {
  return `${tier} ${level}`;
}

// ── Nav ───────────────────────────────────────────────────────────────────────

navBtns.forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

render();
