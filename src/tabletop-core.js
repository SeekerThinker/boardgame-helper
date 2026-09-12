export const TABLE_OS_SCHEMA_VERSION = 2;
export const TABLE_OS_STORAGE_KEY = 'board-game-assistant-table-os-v1';
export const MAX_TABLE_OS_PARTICIPANTS = 32;
export const MAX_TRACKERS = 24;
export const MAX_PHASES = 20;
export const MAX_TEAMS = 8;
export const MAX_SCORE_FIELDS = 16;
export const MAX_CAMPAIGN_FLAGS = 40;

const DEFAULT_COLORS = [
  '#f97316', '#14b8a6', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6',
  '#22c55e', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'
];

function text(value, max = 40) {
  return String(value ?? '').trim().slice(0, max);
}

function identifier(value, prefix = 'id_') {
  const raw = String(value ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return raw || uid(prefix);
}

function number(value, fallback = 0, min = -999999, max = 999999) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function integer(value, fallback = 0, min = -999999, max = 999999) {
  return Math.round(number(value, fallback, min, max));
}

function color(value, index = 0) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''))
    ? String(value)
    : DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

export function uid(prefix = '') {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11);
  return `${prefix}${random}`;
}

function scoreKey(value, index = 0) {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return cleaned || `field_${index + 1}`;
}

function uniqueKey(candidate, used) {
  let next = candidate;
  let suffix = 2;
  while (used.has(next)) {
    next = `${candidate}_${suffix}`.slice(0, 24);
    suffix += 1;
  }
  used.add(next);
  return next;
}

function participantTemplate(name, index, sourcePlayerId = null, sourceColor = null) {
  return {
    id: uid('tp_'),
    sourcePlayerId: sourcePlayerId == null ? null : identifier(sourcePlayerId, 'src_'),
    name: text(name || `Player ${index + 1}`, 32),
    color: color(sourceColor, index)
  };
}

export const ASSISTANT_TEMPLATES = [
  {
    id: 'universal',
    names: { zh: '通用桌游', en: 'Universal Table' },
    descriptions: { zh: '最少假设的通用桌面：流程、公共计数与自由记分。', en: 'A minimal shared table with phases, counters and free scoring.' },
    phases: ['准备', '行动', '结算'],
    trackers: [
      { name: '公共资源', scope: 'global', value: 0, min: 0, max: 999, step: 1 }
    ],
    scoreFields: [
      { key: 'points', name: '得分', kind: 'manual', step: 1, effect: 1, includeInTotal: true }
    ],
    teams: 0,
    campaign: false
  },
  {
    id: 'engine-score',
    names: { zh: '引擎构筑 / 终局计分', en: 'Engine / End-game Scoring' },
    descriptions: { zh: '适合 Wingspan、Ark Nova 等多栏目终局计分型游戏。', en: 'For multi-category end-game scoring such as Wingspan or Ark Nova.' },
    phases: ['回合开始', '行动', '维护', '回合结束'],
    trackers: [
      { name: '回合', scope: 'global', value: 1, min: 1, max: 99, step: 1 }
    ],
    scoreFields: [
      { key: 'base', name: '基础分', kind: 'manual', step: 1, effect: 1, includeInTotal: true },
      { key: 'bonus', name: '奖励', kind: 'manual', step: 1, effect: 1, includeInTotal: true },
      { key: 'objective', name: '目标', kind: 'manual', step: 1, effect: 1, includeInTotal: true },
      { key: 'penalty', name: '惩罚', kind: 'manual', step: 1, effect: -1, includeInTotal: true },
      { key: 'net', name: '净分', kind: 'formula', formula: 'base + bonus + objective - penalty', step: 1, effect: 1, includeInTotal: false }
    ],
    teams: 0,
    campaign: false
  },
  {
    id: 'trade-network',
    names: { zh: '交易 / 网络 / 经济', en: 'Trade / Network / Economy' },
    descriptions: { zh: '适合资源交易、金币、收入轨与公共市场压力较高的游戏。', en: 'For games with resources, money, income tracks and shared markets.' },
    phases: ['收入', '行动', '交易', '维护'],
    trackers: [
      { name: '公共供应', scope: 'global', value: 0, min: 0, max: 999, step: 1 },
      { name: '金币', scope: 'participant', value: 0, min: 0, max: 999, step: 1 },
      { name: '资源', scope: 'participant', value: 0, min: 0, max: 999, step: 1 }
    ],
    scoreFields: [
      { key: 'points', name: '胜利点', kind: 'manual', step: 1, effect: 1, includeInTotal: true }
    ],
    teams: 0,
    campaign: false
  },
  {
    id: 'coop-crisis',
    names: { zh: '合作 / 危机管理', en: 'Co-op / Crisis' },
    descriptions: { zh: '共享威胁、生命、目标和阶段流程，适合 Spirit Island、Pandemic 类协作体验。', en: 'Shared threat, health, objectives and phases for co-operative games.' },
    phases: ['玩家阶段', '快速行动', '危机阶段', '慢速行动', '清理'],
    trackers: [
      { name: '威胁', scope: 'global', value: 0, min: 0, max: 99, step: 1 },
      { name: '公共生命', scope: 'global', value: 10, min: 0, max: 99, step: 1 },
      { name: '个人生命', scope: 'participant', value: 10, min: 0, max: 99, step: 1 }
    ],
    scoreFields: [
      { key: 'objectives', name: '目标完成', kind: 'manual', step: 1, effect: 1, includeInTotal: true },
      { key: 'damage', name: '损伤', kind: 'manual', step: 1, effect: -1, includeInTotal: true }
    ],
    teams: 1,
    campaign: false
  },
  {
    id: 'asymmetric-conflict',
    names: { zh: '非对称阵营 / 冲突', en: 'Asymmetric Conflict' },
    descriptions: { zh: '不同阵营、不同资源轨、不同阶段目标的冲突型游戏。', en: 'For factions with different tracks, resources and objectives.' },
    phases: ['开始', '行动', '冲突', '维护', '结束'],
    trackers: [
      { name: '影响力', scope: 'participant', value: 0, min: 0, max: 99, step: 1 },
      { name: '资源', scope: 'participant', value: 0, min: 0, max: 99, step: 1 },
      { name: '声望', scope: 'participant', value: 0, min: 0, max: 99, step: 1 }
    ],
    scoreFields: [
      { key: 'vp', name: '胜利点', kind: 'manual', step: 1, effect: 1, includeInTotal: true }
    ],
    teams: 0,
    campaign: false
  },
  {
    id: 'hidden-role',
    names: { zh: '隐藏身份 / 主持', en: 'Hidden Roles / Moderator' },
    descriptions: { zh: '支持分队、私密身份、主持备注与白天/夜晚等阶段推进。', en: 'Teams, private roles, moderator notes and day/night style phases.' },
    phases: ['准备', '公开讨论', '私密阶段', '投票 / 决议', '结算'],
    trackers: [
      { name: '存活人数', scope: 'team', value: 0, min: 0, max: 32, step: 1 }
    ],
    scoreFields: [
      { key: 'wins', name: '胜局', kind: 'manual', step: 1, effect: 1, includeInTotal: true }
    ],
    teams: 2,
    campaign: false
  },
  {
    id: 'card-battle',
    names: { zh: '卡牌战斗 / 生命状态', en: 'Card Battle / Health' },
    descriptions: { zh: '生命、资源、状态标记和轮次流程，适合对战或合作卡牌游戏。', en: 'Health, resources, status counters and round flow for card games.' },
    phases: ['准备', '主要阶段', '战斗', '结束'],
    trackers: [
      { name: '生命', scope: 'participant', value: 20, min: 0, max: 999, step: 1 },
      { name: '资源', scope: 'participant', value: 0, min: 0, max: 999, step: 1 },
      { name: '状态', scope: 'participant', value: 0, min: 0, max: 99, step: 1 }
    ],
    scoreFields: [
      { key: 'wins', name: '胜局', kind: 'manual', step: 1, effect: 1, includeInTotal: true }
    ],
    teams: 0,
    campaign: false
  },
  {
    id: 'campaign',
    names: { zh: '战役 / Legacy', en: 'Campaign / Legacy' },
    descriptions: { zh: '跨局保存章节、检查点、解锁项、共享状态与角色状态。', en: 'Persist chapters, checkpoints, unlocks and character/shared state.' },
    phases: ['场景准备', '行动', '遭遇', '场景结算', '战役记录'],
    trackers: [
      { name: '团队资源', scope: 'global', value: 0, min: 0, max: 999, step: 1, persistence: 'campaign' },
      { name: '生命', scope: 'participant', value: 10, min: 0, max: 999, step: 1, persistence: 'session' },
      { name: '经验', scope: 'participant', value: 0, min: 0, max: 9999, step: 1, persistence: 'campaign' }
    ],
    scoreFields: [
      { key: 'scenario', name: '场景得分', kind: 'manual', step: 1, effect: 1, includeInTotal: true }
    ],
    teams: 1,
    campaign: true
  },
  {
    id: 'party-teams',
    names: { zh: '聚会 / 分队 / 竞猜', en: 'Party / Teams / Guessing' },
    descriptions: { zh: '快速分队、团队分数、短阶段和主持辅助。', en: 'Fast teams, team scores, short phases and moderator support.' },
    phases: ['出题', '作答', '判定', '换边'],
    trackers: [
      { name: '团队得分', scope: 'team', value: 0, min: 0, max: 999, step: 1 }
    ],
    scoreFields: [
      { key: 'points', name: '个人得分', kind: 'manual', step: 1, effect: 1, includeInTotal: true }
    ],
    teams: 2,
    campaign: false
  }
];

export function templateById(id) {
  return ASSISTANT_TEMPLATES.find(template => template.id === id) || ASSISTANT_TEMPLATES[0];
}

function trackerFromTemplate(input, index = 0) {
  const tracker = input && typeof input === 'object' ? input : {};
  const scope = ['global', 'participant', 'team'].includes(tracker.scope) ? tracker.scope : 'global';
  const min = integer(tracker.min, 0, -999999, 999999);
  const max = integer(tracker.max, 999999, min, 999999);
  const initial = integer(tracker.value, 0, min, max);
  return {
    id: identifier(tracker.id, 'trk_'),
    name: text(tracker.name || `Tracker ${index + 1}`, 32),
    scope,
    persistence: tracker.persistence === 'campaign' ? 'campaign' : 'session',
    min,
    max,
    step: Math.max(1, integer(tracker.step, 1, 1, 9999)),
    initial,
    values: tracker.values && typeof tracker.values === 'object' ? { ...tracker.values } : {}
  };
}

function scoreFieldFromTemplate(input, index = 0, usedKeys = null) {
  const field = input && typeof input === 'object' ? input : {};
  const candidate = scoreKey(field.key || field.name, index);
  const key = usedKeys ? uniqueKey(candidate, usedKeys) : candidate;
  return {
    id: identifier(field.id, 'sf_'),
    key,
    name: text(field.name || `Field ${index + 1}`, 28),
    kind: field.kind === 'formula' ? 'formula' : 'manual',
    formula: text(field.formula, 120),
    step: Math.max(1, integer(field.step, 1, 1, 9999)),
    effect: Number(field.effect) === -1 ? -1 : 1,
    includeInTotal: field.includeInTotal !== false
  };
}

function normalizeParticipants(value) {
  if (!Array.isArray(value)) return [];
  const used = new Set();
  return value.slice(0, MAX_TABLE_OS_PARTICIPANTS).map((participant, index) => {
    let id = identifier(participant?.id, 'tp_');
    while (used.has(id)) id = uid('tp_');
    used.add(id);
    return {
      id,
      sourcePlayerId: participant?.sourcePlayerId == null ? null : identifier(participant.sourcePlayerId, 'src_'),
      name: text(participant?.name || `Player ${index + 1}`, 32),
      color: color(participant?.color, index)
    };
  });
}

function normalizeTrackers(value) {
  if (!Array.isArray(value)) return [];
  const used = new Set();
  return value.slice(0, MAX_TRACKERS).map((tracker, index) => {
    const normalized = trackerFromTemplate(tracker, index);
    while (used.has(normalized.id)) normalized.id = uid('trk_');
    used.add(normalized.id);
    const values = {};
    Object.entries(normalized.values || {}).forEach(([entityId, raw]) => {
      values[identifier(entityId, 'entity_')] = integer(raw, normalized.initial, normalized.min, normalized.max);
    });
    normalized.values = values;
    return normalized;
  });
}

function normalizePhases(value) {
  const source = value && typeof value === 'object' ? value : {};
  const used = new Set();
  const items = (Array.isArray(source.items) ? source.items : [])
    .slice(0, MAX_PHASES)
    .map((phase, index) => {
      let id = identifier(phase?.id, 'phase_');
      while (used.has(id)) id = uid('phase_');
      used.add(id);
      return {
        id,
        name: text(phase?.name || `Phase ${index + 1}`, 32),
        note: text(phase?.note, 120)
      };
    });
  return {
    items,
    activeIndex: items.length ? integer(source.activeIndex, 0, 0, items.length - 1) : 0,
    cycle: Math.max(1, integer(source.cycle, 1, 1, 9999))
  };
}

function normalizeTeams(value, validParticipantIds = new Set()) {
  if (!Array.isArray(value)) return [];
  const used = new Set();
  return value.slice(0, MAX_TEAMS).map((team, index) => {
    let id = identifier(team?.id, 'team_');
    while (used.has(id)) id = uid('team_');
    used.add(id);
    return {
      id,
      name: text(team?.name || `Team ${index + 1}`, 28),
      color: color(team?.color, index),
      memberIds: [...new Set(Array.isArray(team?.memberIds) ? team.memberIds.map(item => identifier(item, 'tp_')) : [])]
        .filter(idValue => validParticipantIds.has(idValue))
    };
  });
}

function normalizeRoles(value, validParticipantIds = new Set()) {
  if (!Array.isArray(value)) return [];
  const byParticipant = new Map();
  value.forEach(role => {
    const participantId = identifier(role?.participantId, 'tp_');
    if (!validParticipantIds.has(participantId) || byParticipant.has(participantId)) return;
    byParticipant.set(participantId, {
      participantId,
      role: text(role?.role, 40),
      faction: text(role?.faction, 32),
      note: text(role?.note, 160),
      secret: role?.secret !== false
    });
  });
  return [...byParticipant.values()];
}

function normalizeScoreSheet(value, validParticipantIds = new Set()) {
  const source = value && typeof value === 'object' ? value : {};
  const usedIds = new Set();
  const usedKeys = new Set();
  const fields = (Array.isArray(source.fields) ? source.fields : [])
    .slice(0, MAX_SCORE_FIELDS)
    .map((field, index) => {
      const normalized = scoreFieldFromTemplate(field, index, usedKeys);
      while (usedIds.has(normalized.id)) normalized.id = uid('sf_');
      usedIds.add(normalized.id);
      return normalized;
    });
  const validFieldIds = new Set(fields.map(field => field.id));
  const values = {};
  if (source.values && typeof source.values === 'object') {
    Object.entries(source.values).forEach(([rawParticipantId, rawFields]) => {
      const participantId = identifier(rawParticipantId, 'tp_');
      if (!validParticipantIds.has(participantId) || !rawFields || typeof rawFields !== 'object') return;
      values[participantId] = {};
      Object.entries(rawFields).forEach(([rawFieldId, rawValue]) => {
        const fieldId = identifier(rawFieldId, 'sf_');
        if (!validFieldIds.has(fieldId)) return;
        values[participantId][fieldId] = number(rawValue, 0);
      });
    });
  }
  return { fields, values };
}

function normalizeCampaign(value) {
  const source = value && typeof value === 'object' ? value : {};
  const used = new Set();
  const flags = (Array.isArray(source.flags) ? source.flags : [])
    .slice(0, MAX_CAMPAIGN_FLAGS)
    .map((flag, index) => {
      let id = identifier(flag?.id, 'flag_');
      while (used.has(id)) id = uid('flag_');
      used.add(id);
      return {
        id,
        name: text(flag?.name || `Checkpoint ${index + 1}`, 50),
        checked: Boolean(flag?.checked)
      };
    });
  return {
    enabled: Boolean(source.enabled),
    name: text(source.name, 60),
    chapter: text(source.chapter, 60),
    sessionNumber: Math.max(1, integer(source.sessionNumber, 1, 1, 9999)),
    notes: text(source.notes, 4000),
    flags
  };
}

export function createDefaultTableOsState() {
  return {
    schemaVersion: TABLE_OS_SCHEMA_VERSION,
    appliedTemplateId: 'universal',
    participants: [],
    trackers: [],
    phases: { items: [], activeIndex: 0, cycle: 1 },
    teams: [],
    roles: [],
    scoreSheet: { fields: [], values: {} },
    campaign: { enabled: false, name: '', chapter: '', sessionNumber: 1, notes: '', flags: [] },
    ui: { activeSection: 'overview', mode: 'play' },
    updatedAt: new Date().toISOString()
  };
}

export function normalizeTableOsState(input) {
  const base = createDefaultTableOsState();
  if (!input || typeof input !== 'object') return base;
  const participants = normalizeParticipants(input.participants);
  const participantIds = new Set(participants.map(participant => participant.id));
  return {
    schemaVersion: TABLE_OS_SCHEMA_VERSION,
    appliedTemplateId: templateById(input.appliedTemplateId).id,
    participants,
    trackers: normalizeTrackers(input.trackers),
    phases: normalizePhases(input.phases),
    teams: normalizeTeams(input.teams, participantIds),
    roles: normalizeRoles(input.roles, participantIds),
    scoreSheet: normalizeScoreSheet(input.scoreSheet, participantIds),
    campaign: normalizeCampaign(input.campaign),
    ui: {
      activeSection: ['overview', 'trackers', 'phases', 'teams', 'score', 'campaign'].includes(input.ui?.activeSection)
        ? input.ui.activeSection
        : 'overview',
      mode: input.ui?.mode === 'edit' ? 'edit' : 'play'
    },
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : base.updatedAt
  };
}

export function touch(state) {
  state.updatedAt = new Date().toISOString();
  return state;
}

export function syncParticipantsFromGame(state, basePlayers = []) {
  const gamePlayers = Array.isArray(basePlayers) ? basePlayers.slice(0, MAX_TABLE_OS_PARTICIPANTS) : [];
  const existingBySource = new Map(
    state.participants.filter(participant => participant.sourcePlayerId).map(participant => [participant.sourcePlayerId, participant])
  );
  const synced = gamePlayers.map((player, index) => {
    const sourcePlayerId = identifier(player?.id ?? `player_${index + 1}`, 'src_');
    const current = existingBySource.get(sourcePlayerId);
    return current
      ? { ...current, name: text(player?.name || current.name || `Player ${index + 1}`, 32), color: color(player?.color || current.color, index) }
      : participantTemplate(player?.name || `Player ${index + 1}`, index, sourcePlayerId, player?.color);
  });
  const extras = state.participants.filter(participant => !participant.sourcePlayerId);
  state.participants = [...synced, ...extras].slice(0, MAX_TABLE_OS_PARTICIPANTS);
  pruneParticipantReferences(state);
  return touch(state);
}

export function addParticipant(state, name = '') {
  if (state.participants.length >= MAX_TABLE_OS_PARTICIPANTS) return null;
  const participant = participantTemplate(name || `Player ${state.participants.length + 1}`, state.participants.length);
  state.participants.push(participant);
  touch(state);
  return participant;
}

export function renameParticipant(state, participantId, name) {
  const participant = state.participants.find(item => item.id === participantId);
  if (!participant) return false;
  participant.name = text(name || participant.name, 32);
  touch(state);
  return true;
}

export function removeParticipant(state, participantId) {
  const index = state.participants.findIndex(item => item.id === participantId);
  if (index < 0) return false;
  state.participants.splice(index, 1);
  pruneParticipantReferences(state);
  touch(state);
  return true;
}

function pruneParticipantReferences(state) {
  const valid = new Set(state.participants.map(participant => participant.id));
  state.teams.forEach(team => { team.memberIds = team.memberIds.filter(id => valid.has(id)); });
  state.roles = state.roles.filter(role => valid.has(role.participantId));
  Object.keys(state.scoreSheet.values || {}).forEach(id => { if (!valid.has(id)) delete state.scoreSheet.values[id]; });
  state.trackers.forEach(tracker => {
    if (tracker.scope !== 'participant') return;
    Object.keys(tracker.values || {}).forEach(id => { if (!valid.has(id)) delete tracker.values[id]; });
  });
}

export function addTracker(state, { name = 'Tracker', scope = 'global', initial = 0, min = 0, max = 999, step = 1, persistence = 'session' } = {}) {
  if (state.trackers.length >= MAX_TRACKERS) return null;
  const tracker = trackerFromTemplate({ name, scope, value: initial, min, max, step, persistence }, state.trackers.length);
  state.trackers.push(tracker);
  touch(state);
  return tracker;
}

export function setTrackerPersistence(state, trackerId, persistence = 'session') {
  const tracker = state.trackers.find(item => item.id === trackerId);
  if (!tracker) return false;
  tracker.persistence = persistence === 'campaign' ? 'campaign' : 'session';
  touch(state);
  return true;
}

export function removeTracker(state, trackerId) {
  const index = state.trackers.findIndex(tracker => tracker.id === trackerId);
  if (index < 0) return false;
  state.trackers.splice(index, 1);
  touch(state);
  return true;
}

export function trackerEntityIds(state, tracker) {
  if (!tracker) return [];
  if (tracker.scope === 'participant') return state.participants.map(participant => participant.id);
  if (tracker.scope === 'team') return state.teams.map(team => team.id);
  return ['global'];
}

export function trackerValue(tracker, entityId = 'global') {
  if (!tracker) return 0;
  return number(tracker.values?.[entityId], tracker.initial, tracker.min, tracker.max);
}

export function setTrackerValue(state, trackerId, entityId, value) {
  const tracker = state.trackers.find(item => item.id === trackerId);
  if (!tracker) return false;
  const validEntities = new Set(trackerEntityIds(state, tracker));
  const target = tracker.scope === 'global' ? 'global' : entityId;
  if (!validEntities.has(target)) return false;
  tracker.values[target] = integer(value, tracker.initial, tracker.min, tracker.max);
  touch(state);
  return true;
}

export function adjustTracker(state, trackerId, entityId, delta) {
  const tracker = state.trackers.find(item => item.id === trackerId);
  if (!tracker) return false;
  const target = tracker.scope === 'global' ? 'global' : entityId;
  return setTrackerValue(state, trackerId, target, trackerValue(tracker, target) + Number(delta || 0));
}

export function addPhase(state, name = '') {
  if (state.phases.items.length >= MAX_PHASES) return null;
  const phase = { id: uid('phase_'), name: text(name || `Phase ${state.phases.items.length + 1}`, 32), note: '' };
  state.phases.items.push(phase);
  touch(state);
  return phase;
}

export function removePhase(state, phaseId) {
  const index = state.phases.items.findIndex(item => item.id === phaseId);
  if (index < 0) return false;
  state.phases.items.splice(index, 1);
  if (!state.phases.items.length) state.phases.activeIndex = 0;
  else state.phases.activeIndex = Math.min(state.phases.activeIndex, state.phases.items.length - 1);
  touch(state);
  return true;
}

export function setActivePhase(state, index) {
  if (!state.phases.items.length) return false;
  const next = integer(index, 0, 0, state.phases.items.length - 1);
  state.phases.activeIndex = next;
  touch(state);
  return true;
}

export function advancePhase(state, direction = 1) {
  const count = state.phases.items.length;
  if (!count) return null;
  const forward = Number(direction) >= 0;
  let next = state.phases.activeIndex + (forward ? 1 : -1);
  if (next >= count) {
    next = 0;
    state.phases.cycle = Math.min(9999, state.phases.cycle + 1);
  } else if (next < 0) {
    next = count - 1;
    state.phases.cycle = Math.max(1, state.phases.cycle - 1);
  }
  state.phases.activeIndex = next;
  touch(state);
  return state.phases.items[next];
}

export function addTeam(state, name = '') {
  if (state.teams.length >= MAX_TEAMS) return null;
  const index = state.teams.length;
  const team = { id: uid('team_'), name: text(name || `Team ${index + 1}`, 28), color: DEFAULT_COLORS[index % DEFAULT_COLORS.length], memberIds: [] };
  state.teams.push(team);
  touch(state);
  return team;
}

export function removeTeam(state, teamId) {
  const index = state.teams.findIndex(team => team.id === teamId);
  if (index < 0) return false;
  state.teams.splice(index, 1);
  state.trackers.forEach(tracker => { if (tracker.scope === 'team') delete tracker.values?.[teamId]; });
  touch(state);
  return true;
}

export function toggleTeamMember(state, teamId, participantId) {
  const team = state.teams.find(item => item.id === teamId);
  if (!team || !state.participants.some(participant => participant.id === participantId)) return false;
  const index = team.memberIds.indexOf(participantId);
  if (index >= 0) team.memberIds.splice(index, 1);
  else team.memberIds.push(participantId);
  touch(state);
  return true;
}

export function setRole(state, participantId, { role = '', faction = '', note = '', secret = true } = {}) {
  if (!state.participants.some(participant => participant.id === participantId)) return false;
  const existing = state.roles.find(item => item.participantId === participantId);
  const next = { participantId, role: text(role, 40), faction: text(faction, 32), note: text(note, 160), secret: secret !== false };
  if (existing) Object.assign(existing, next);
  else state.roles.push(next);
  touch(state);
  return true;
}

export function clearRole(state, participantId) {
  const before = state.roles.length;
  state.roles = state.roles.filter(role => role.participantId !== participantId);
  if (state.roles.length === before) return false;
  touch(state);
  return true;
}

export function roleForParticipant(state, participantId) {
  return state.roles.find(role => role.participantId === participantId) || null;
}

export function addScoreSheetField(state, { name = 'Field', key = '', kind = 'manual', formula = '', step = 1, effect = 1, includeInTotal = true } = {}) {
  if (state.scoreSheet.fields.length >= MAX_SCORE_FIELDS) return null;
  const used = new Set(state.scoreSheet.fields.map(field => field.key));
  const field = scoreFieldFromTemplate({ name, key, kind, formula, step, effect, includeInTotal }, state.scoreSheet.fields.length, used);
  state.scoreSheet.fields.push(field);
  touch(state);
  return field;
}

export function removeScoreSheetField(state, fieldId) {
  const index = state.scoreSheet.fields.findIndex(field => field.id === fieldId);
  if (index < 0) return false;
  state.scoreSheet.fields.splice(index, 1);
  Object.values(state.scoreSheet.values).forEach(values => { delete values?.[fieldId]; });
  touch(state);
  return true;
}

export function setScoreSheetValue(state, participantId, fieldId, value) {
  const participant = state.participants.find(item => item.id === participantId);
  const field = state.scoreSheet.fields.find(item => item.id === fieldId);
  if (!participant || !field || field.kind === 'formula') return false;
  state.scoreSheet.values[participantId] ||= {};
  state.scoreSheet.values[participantId][fieldId] = number(value, 0);
  touch(state);
  return true;
}

function tokenizeFormula(expression) {
  const source = String(expression || '').trim();
  if (!source) return [];
  const tokens = source.match(/\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/]/g) || [];
  const compactSource = source.replace(/\s+/g, '');
  if (tokens.join('') !== compactSource) throw new Error('invalid-token');
  return tokens;
}

const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

export function evaluateFormula(expression, variables = {}) {
  let tokens;
  try { tokens = tokenizeFormula(expression); } catch (error) { return { ok: false, value: 0, error: error.message }; }
  if (!tokens.length) return { ok: true, value: 0, error: null };
  const output = [];
  const operators = [];
  let previous = 'start';
  try {
    tokens.forEach(token => {
      if (/^\d/.test(token)) {
        output.push(Number(token));
        previous = 'value';
        return;
      }
      if (/^[A-Za-z_]/.test(token)) {
        output.push(number(variables[token], 0));
        previous = 'value';
        return;
      }
      if (token === '(') {
        operators.push(token);
        previous = 'open';
        return;
      }
      if (token === ')') {
        while (operators.length && operators[operators.length - 1] !== '(') output.push(operators.pop());
        if (!operators.length) throw new Error('unbalanced-parentheses');
        operators.pop();
        previous = 'value';
        return;
      }
      if (!(token in PRECEDENCE)) throw new Error('invalid-operator');
      if (token === '-' && ['start', 'open', 'operator'].includes(previous)) output.push(0);
      while (operators.length && operators[operators.length - 1] in PRECEDENCE && PRECEDENCE[operators[operators.length - 1]] >= PRECEDENCE[token]) {
        output.push(operators.pop());
      }
      operators.push(token);
      previous = 'operator';
    });
    while (operators.length) {
      const operator = operators.pop();
      if (operator === '(') throw new Error('unbalanced-parentheses');
      output.push(operator);
    }
    const stack = [];
    output.forEach(token => {
      if (typeof token === 'number') { stack.push(token); return; }
      if (stack.length < 2) throw new Error('invalid-expression');
      const right = stack.pop();
      const left = stack.pop();
      if (token === '+') stack.push(left + right);
      if (token === '-') stack.push(left - right);
      if (token === '*') stack.push(left * right);
      if (token === '/') {
        if (right === 0) throw new Error('division-by-zero');
        stack.push(left / right);
      }
    });
    if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('invalid-result');
    return { ok: true, value: Math.round(stack[0] * 100) / 100, error: null };
  } catch (error) {
    return { ok: false, value: 0, error: error.message };
  }
}

export function scoreCardForParticipant(state, participantId) {
  const rawValues = state.scoreSheet.values?.[participantId] || {};
  const variables = {};
  const values = {};
  state.scoreSheet.fields.forEach(field => {
    if (field.kind !== 'manual') return;
    const value = number(rawValues[field.id], 0);
    values[field.id] = value;
    variables[field.key] = value;
  });
  for (let pass = 0; pass < state.scoreSheet.fields.length; pass += 1) {
    state.scoreSheet.fields.forEach(field => {
      if (field.kind !== 'formula') return;
      const evaluated = evaluateFormula(field.formula, variables);
      values[field.id] = evaluated.ok ? evaluated.value : 0;
      variables[field.key] = values[field.id];
    });
  }
  const total = state.scoreSheet.fields.reduce((sum, field) => {
    if (!field.includeInTotal) return sum;
    return sum + number(values[field.id], 0) * field.effect;
  }, 0);
  return { values, variables, total: Math.round(total * 100) / 100 };
}

export function addCampaignFlag(state, name = '') {
  if (state.campaign.flags.length >= MAX_CAMPAIGN_FLAGS) return null;
  const flag = { id: uid('flag_'), name: text(name || `Checkpoint ${state.campaign.flags.length + 1}`, 50), checked: false };
  state.campaign.flags.push(flag);
  touch(state);
  return flag;
}

export function toggleCampaignFlag(state, flagId) {
  const flag = state.campaign.flags.find(item => item.id === flagId);
  if (!flag) return false;
  flag.checked = !flag.checked;
  touch(state);
  return true;
}

export function removeCampaignFlag(state, flagId) {
  const index = state.campaign.flags.findIndex(item => item.id === flagId);
  if (index < 0) return false;
  state.campaign.flags.splice(index, 1);
  touch(state);
  return true;
}

function resetTemplateModules(state) {
  state.trackers = [];
  state.phases = { items: [], activeIndex: 0, cycle: 1 };
  state.teams = [];
  state.roles = [];
  state.scoreSheet = { fields: [], values: {} };
  state.campaign = { enabled: false, name: '', chapter: '', sessionNumber: 1, notes: '', flags: [] };
}

export function applyAssistantTemplate(state, templateId, { preserveParticipants = true } = {}) {
  const template = templateById(templateId);
  const participants = preserveParticipants ? state.participants.slice() : [];
  resetTemplateModules(state);
  state.participants = participants;
  state.appliedTemplateId = template.id;
  state.phases.items = template.phases.slice(0, MAX_PHASES).map(name => ({ id: uid('phase_'), name, note: '' }));
  state.trackers = template.trackers.slice(0, MAX_TRACKERS).map((tracker, index) => trackerFromTemplate(tracker, index));
  const usedKeys = new Set();
  state.scoreSheet.fields = template.scoreFields.slice(0, MAX_SCORE_FIELDS).map((field, index) => scoreFieldFromTemplate(field, index, usedKeys));
  for (let index = 0; index < Math.min(MAX_TEAMS, template.teams || 0); index += 1) addTeam(state, `Team ${index + 1}`);
  state.campaign.enabled = Boolean(template.campaign);
  state.ui.activeSection = 'overview';
  state.ui.mode = 'play';
  touch(state);
  return state;
}

export function resetTableOsSession(state) {
  state.trackers.forEach(tracker => {
    if (tracker.persistence !== 'campaign') tracker.values = {};
  });
  state.phases.activeIndex = 0;
  state.phases.cycle = 1;
  state.roles = [];
  state.scoreSheet.values = {};
  state.campaign.sessionNumber = Math.max(1, state.campaign.sessionNumber + 1);
  touch(state);
  return state;
}

export function serializeTableOsState(state) {
  return JSON.stringify(normalizeTableOsState(state), null, 2);
}

export function parseTableOsState(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return normalizeTableOsState(parsed);
}
