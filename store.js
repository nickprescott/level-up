const STORAGE_KEY = 'level-up-data';
const SCHEMA_VERSION = 1;

const DEFAULT_STATE = {
  schemaVersion: SCHEMA_VERSION,
  skills: [],
  activities: [],
  logs: [],
  accomplishments: [],
};

function runMigrations(data) {
  const v = data.schemaVersion ?? 0;

  // v0 → v1: no structural changes; just stamp the version
  // Add future migrations here as: if (v < N) { ... }

  data.schemaVersion = SCHEMA_VERSION;
  return data;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const data = { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
    return runMigrations(data);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }));
}

let _state = load();

export const store = {
  getState() {
    return _state;
  },

  addSkill(skill) {
    _state.skills.push({ id: crypto.randomUUID(), createdAt: Date.now(), ...skill });
    save(_state);
  },

  updateSkill(id, updates) {
    const idx = _state.skills.findIndex(s => s.id === id);
    if (idx !== -1) {
      _state.skills[idx] = { ..._state.skills[idx], ...updates };
      save(_state);
    }
  },

  addActivity(activity) {
    _state.activities.push({ id: crypto.randomUUID(), createdAt: Date.now(), ...activity });
    save(_state);
  },

  addAccomplishment(accomplishment) {
    _state.accomplishments.push({ id: crypto.randomUUID(), createdAt: Date.now(), claimed: false, ...accomplishment });
    save(_state);
  },

  claimAccomplishment(id) {
    const idx = _state.accomplishments.findIndex(a => a.id === id);
    if (idx !== -1) {
      _state.accomplishments[idx].claimed = true;
      _state.accomplishments[idx].claimedAt = Date.now();
      save(_state);
    }
  },

  deleteSkill(id) {
    _state.skills = _state.skills.filter(s => s.id !== id);
    save(_state);
  },

  deleteActivity(id) {
    _state.activities = _state.activities.filter(a => a.id !== id);
    save(_state);
  },

  deleteAccomplishment(id) {
    _state.accomplishments = _state.accomplishments.filter(a => a.id !== id);
    save(_state);
  },

  addLog(entry) {
    _state.logs.push({ id: crypto.randomUUID(), timestamp: Date.now(), ...entry });
    save(_state);
  },

  promoteSkill(id, currentTotalXp = 0) {
    const idx = _state.skills.findIndex(s => s.id === id);
    if (idx === -1) return;
    const skill = _state.skills[idx];
    let { tier } = skill;
    if (tier === 'Beginner') tier = 'Intermediate';
    else if (tier === 'Intermediate') tier = 'Advanced';
    _state.skills[idx] = {
      ...skill,
      tier,
      level: 1,
      promotedAt: Date.now(),
      promotedXpOffset: currentTotalXp,
    };
    save(_state);
  },

  exportJSON() {
    return JSON.stringify(_state, null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    _state = { ...structuredClone(DEFAULT_STATE), ...parsed };
    save(_state);
  },
};

window.__store = store;
