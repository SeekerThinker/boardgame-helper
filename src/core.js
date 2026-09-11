export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'board-game-assistant-state-v2';
export const LEGACY_STORAGE_KEY = 'board-game-assistant-state-v1';
export const MAX_PLAYERS = 16;
export const PLAYER_COLORS = [
  '#f97316', '#14b8a6', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6',
  '#22c55e', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'
];

export const FLOW_TEMPLATES = [
  { id: 'strategy', timerMode: 'turn', seconds: 90, scorePreset: 'victory', pain: ['turnTimer', 'switchPlayer', 'roundScore'] },
  { id: 'party', timerMode: 'round', seconds: 45, scorePreset: 'party', pain: ['phaseTimer', 'quickScore', 'nextRound'] },
  { id: 'card', timerMode: 'turn', seconds: 30, scorePreset: 'penalty', pain: ['turnTimer', 'lowWins', 'editableHistory'] },
  { id: 'social', timerMode: 'round', seconds: 180, scorePreset: 'victory', pain: ['sharedStage', 'stageScore', 'roundReview'] },
  { id: 'coop', timerMode: 'pool', seconds: 600, scorePreset: 'coop', pain: ['sharedPool', 'teamScore', 'stageProgress'] },
  { id: 'abstract', timerMode: 'chess', seconds: 300, scorePreset: 'match', pain: ['personalPool', 'switchPlayer', 'matchRecord'] }
];

export const SCORE_PRESETS = [
  {
    id: 'victory', rule: 'highest', target: 20,
    fields: [
      { id: 'vp', nameKey: 'field.vp', step: 1, effect: 1 },
      { id: 'bonus', nameKey: 'field.bonus', step: 1, effect: 1 },
      { id: 'penalty', nameKey: 'field.penalty', step: 1, effect: -1 }
    ]
  },
  {
    id: 'party', rule: 'highest', target: 30,
    fields: [
      { id: 'score', nameKey: 'field.score', step: 1, effect: 1 },
      { id: 'bonus', nameKey: 'field.bonus', step: 1, effect: 1 },
      { id: 'penalty', nameKey: 'field.punishment', step: 1, effect: -1 }
    ]
  },
  {
    id: 'penalty', rule: 'lowest', target: 50,
    fields: [
      { id: 'penalty', nameKey: 'field.penaltyPoints', step: 1, effect: 1 },
      { id: 'cards', nameKey: 'field.cards', step: 1, effect: 1 },
      { id: 'debt', nameKey: 'field.debt', step: 1, effect: 1 }
    ]
  },
  {
    id: 'coop', rule: 'highest', target: 100,
    fields: [
      { id: 'objective', nameKey: 'field.objective', step: 5, effect: 1 },
      { id: 'resource', nameKey: 'field.resource', step: 1, effect: 1 },
      { id: 'damage', nameKey: 'field.damage', step: 1, effect: -1 }
    ]
  },
  {
    id: 'match', rule: 'highest', target: 3,
    fields: [
      { id: 'win', nameKey: 'field.win', step: 1, effect: 1 },
      { id: 'draw', nameKey: 'field.draw', step: 1, effect: 1 },
      { id: 'bonus', nameKey: 'field.bonus', step: 1, effect: 1 }
    ]
  }
];

export function uid(prefix = '') {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11);
  return `${prefix}${random}`;
}

export function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function presetById(id) {
  return SCORE_PRESETS.find(item => item.id === id) || SCORE_PRESETS[0];
}

export function templateById(id) {
  return FLOW_TEMPLATES.find(item => item.id === id) || FLOW_TEMPLATES[0];
}

export function createFieldsFromPreset(id) {
  return presetById(id).fields.map(field => ({
    id: field.id,
    nameKey: field.nameKey,
    customName: '',
    step: field.step,
    effect: field.effect
  }));
}

export function createDefaultState(locale = 'zh') {
  const baseSeconds = 90;
  const players = ['1', '2', '3', '4'].map((suffix, index) => ({
    id: uid('p_'),
    name: '',
    defaultNameIndex: Number(suffix),
    color: PLAYER_COLORS[index],
    poolSeconds: 300,
    score: 0,
    scoreBreakdown: {}
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    screen: 'setup',
    activeTool: 'flow',
    templateId: 'strategy',
    locale,
    session: {
      name: '',
      status: 'active',
      startedAt: null,
      finishedAt: null
    },
    players,
    timer: {
      mode: 'turn',
      baseSeconds,
      remainingSeconds: baseSeconds,
      sharedRemainingSeconds: 600,
      running: false,
      deadlineMs: null,
      activePlayerId: players[0].id,
      round: 1,
      timeoutHandled: false
    },
    score: {
      presetId: 'victory',
      rule: 'highest',
      target: 20,
      fields: createFieldsFromPreset('victory'),
      rounds: [],
      history: [],
      undoStack: []
    },
    tools: {
      history: [],
      lastFirstPlayerId: null,
      shuffledPlayerIds: [],
      teams: []
    },
    settings: {
      soundOn: true,
      keepScreenOn: true,
      backgroundAlerts: true,
      notificationPermission: 'prompt'
    }
  };
}

function normalizePlayer(player, index, baseSeconds) {
  return {
    id: String(player?.id || uid('p_')),
    name: typeof player?.name === 'string' ? player.name.slice(0, 24) : '',
    defaultNameIndex: clamp(player?.defaultNameIndex || index + 1, 1, 999),
    color: /^#[0-9a-f]{6}$/i.test(player?.color || '') ? player.color : PLAYER_COLORS[index % PLAYER_COLORS.length],
    poolSeconds: clamp(player?.poolSeconds ?? player?.pool ?? baseSeconds, 0, 86400),
    score: Number(player?.score || 0),
    scoreBreakdown: { ...(player?.scoreBreakdown || {}) }
  };
}

function normalizeField(field, index) {
  const fallbackId = `field_${index + 1}`;
  return {
    id: String(field?.id || fallbackId).replace(/[^a-zA-Z0-9_-]/g, '_'),
    nameKey: typeof field?.nameKey === 'string' ? field.nameKey : '',
    customName: typeof field?.customName === 'string'
      ? field.customName.slice(0, 20)
      : (typeof field?.name === 'string' ? field.name.slice(0, 20) : ''),
    step: clamp(field?.step ?? 1, 1, 1000),
    effect: Number(field?.effect) === -1 ? -1 : 1
  };
}

export function normalizeState(input, locale = 'zh') {
  const base = createDefaultState(locale);
  if (!input || typeof input !== 'object') return base;
  const baseSeconds = clamp(input.timer?.baseSeconds ?? input.timer?.seconds ?? base.timer.baseSeconds, 5, 86400);
  const rawPlayers = Array.isArray(input.players) && input.players.length ? input.players : base.players;
  const playerIds = new Set();
  const players = rawPlayers.slice(0, MAX_PLAYERS).map((player, index) => {
    const normalized = normalizePlayer(player, index, baseSeconds);
    if (playerIds.has(normalized.id)) normalized.id = uid('p_');
    playerIds.add(normalized.id);
    return normalized;
  });
  const rawFields = Array.isArray(input.score?.fields) && input.score.fields.length
    ? input.score.fields
    : createFieldsFromPreset(input.score?.presetId || base.score.presetId);
  const fieldIds = new Set();
  const fields = rawFields.slice(0, 12).map((field, index) => {
    const normalized = normalizeField(field, index);
    if (fieldIds.has(normalized.id)) normalized.id = `field_${index + 1}_${uid()}`;
    fieldIds.add(normalized.id);
    return normalized;
  });
  const requestedActiveId = input.timer?.activePlayerId == null ? null : String(input.timer.activePlayerId);
  const activeId = players.some(player => player.id === requestedActiveId)
    ? requestedActiveId
    : players[clamp(input.timer?.activePlayer ?? 0, 0, players.length - 1)]?.id;
  const deadlineMs = Number(input.timer?.deadlineMs);
  const state = {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    screen: ['setup', 'workspace'].includes(input.screen) ? input.screen : base.screen,
    activeTool: ['flow', 'score', 'tools', 'summary'].includes(input.activeTool) ? input.activeTool : base.activeTool,
    templateId: FLOW_TEMPLATES.some(item => item.id === input.templateId) ? input.templateId : base.templateId,
    locale: input.locale === 'en' || input.lang === 'en'
      ? 'en'
      : (input.locale === 'zh' || input.lang === 'zh' ? 'zh' : (locale === 'en' ? 'en' : 'zh')),
    session: {
      ...base.session,
      ...(input.session || {}),
      name: String(input.session?.name ?? input.sessionName ?? '').slice(0, 40),
      status: input.session?.status === 'finished' ? 'finished' : 'active'
    },
    players,
    timer: {
      ...base.timer,
      ...(input.timer || {}),
      mode: ['turn', 'chess', 'pool', 'round'].includes(input.timer?.mode) ? input.timer.mode : base.timer.mode,
      baseSeconds,
      remainingSeconds: clamp(input.timer?.remainingSeconds ?? input.timer?.remaining ?? baseSeconds, 0, 86400),
      sharedRemainingSeconds: clamp(input.timer?.sharedRemainingSeconds ?? input.timer?.sharedPool ?? baseSeconds, 0, 86400),
      running: Boolean(input.timer?.running) && Number.isFinite(deadlineMs) && deadlineMs > 0,
      deadlineMs: Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : null,
      activePlayerId: activeId,
      round: clamp(input.timer?.round ?? 1, 1, 9999),
      timeoutHandled: Boolean(input.timer?.timeoutHandled)
    },
    score: {
      ...base.score,
      ...(input.score || {}),
      presetId: SCORE_PRESETS.some(item => item.id === input.score?.presetId) ? input.score.presetId : base.score.presetId,
      rule: input.score?.rule === 'lowest' ? 'lowest' : 'highest',
      target: clamp(input.score?.target ?? base.score.target, 1, 999999),
      fields,
      rounds: Array.isArray(input.score?.rounds) ? input.score.rounds.map(normalizeRound) : [],
      history: Array.isArray(input.score?.history) ? input.score.history.slice(-200) : [],
      undoStack: Array.isArray(input.score?.undoStack) ? input.score.undoStack.slice(-50) : []
    },
    tools: {
      ...base.tools,
      ...(input.tools || {}),
      history: Array.isArray(input.tools?.history) ? input.tools.history.slice(-20).map(normalizeToolHistory) : [],
      lastFirstPlayerId: input.tools?.lastFirstPlayerId != null
        && players.some(player => player.id === String(input.tools.lastFirstPlayerId))
        ? String(input.tools.lastFirstPlayerId)
        : null,
      shuffledPlayerIds: normalizePlayerIdList(input.tools?.shuffledPlayerIds, playerIds),
      teams: normalizeTeams(input.tools?.teams, playerIds)
    },
    settings: {
      ...base.settings,
      ...(input.settings || {}),
      soundOn: input.settings?.soundOn ?? input.soundOn ?? base.settings.soundOn,
      keepScreenOn: input.settings?.keepScreenOn ?? base.settings.keepScreenOn,
      backgroundAlerts: input.settings?.backgroundAlerts ?? base.settings.backgroundAlerts,
      notificationPermission: ['prompt', 'granted', 'denied'].includes(input.settings?.notificationPermission)
        ? input.settings.notificationPermission
        : 'prompt'
    }
  };

  migrateLegacyScores(state, input);
  recalculateScores(state);
  reconcileTimer(state, Date.now());
  return state;
}

function normalizePlayerIdList(value, validIds) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(id => validIds.has(id)))];
}

function normalizeTeams(value, validIds) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((team, index) => ({
    index,
    playerIds: normalizePlayerIdList(team?.playerIds, validIds)
  })).filter(team => team.playerIds.length);
}

function normalizeToolHistory(entry) {
  if (!entry || typeof entry !== 'object') return { type: 'unknown', at: null };
  return {
    ...entry,
    type: typeof entry.type === 'string' ? entry.type : 'unknown',
    playerId: entry.playerId == null ? null : String(entry.playerId),
    playerIds: Array.isArray(entry.playerIds) ? entry.playerIds.map(String) : []
  };
}

function normalizeRound(round) {
  const scores = {};
  if (round?.scores && typeof round.scores === 'object') {
    Object.entries(round.scores).forEach(([playerId, values]) => {
      scores[playerId] = {};
      if (values && typeof values === 'object') {
        Object.entries(values).forEach(([fieldId, value]) => {
          scores[playerId][fieldId] = clamp(value, 0, 999999);
        });
      }
    });
  }
  return {
    round: clamp(round?.round ?? 1, 1, 9999),
    scores,
    createdAt: round?.createdAt || null,
    updatedAt: round?.updatedAt || round?.time || null
  };
}

function migrateLegacyScores(state, input) {
  if (state.score.rounds.length) return;
  const legacyHasScores = state.players.some(player => Object.values(player.scoreBreakdown || {}).some(value => Number(value) !== 0));
  if (!legacyHasScores) return;
  const round = ensureRound(state, Number(input.timer?.round || 1));
  state.players.forEach(player => {
    state.score.fields.forEach(field => {
      const raw = Number(player.scoreBreakdown?.[field.id] || 0);
      round.scores[player.id][field.id] = Math.max(0, field.effect === -1 ? Math.abs(raw) : raw);
    });
  });
  round.updatedAt = new Date().toISOString();
}

export function applyPreset(state, presetId, { clearScores = true } = {}) {
  const preset = presetById(presetId);
  state.score.presetId = preset.id;
  state.score.rule = preset.rule;
  state.score.target = preset.target;
  state.score.fields = createFieldsFromPreset(preset.id);
  if (clearScores) {
    state.score.rounds = [];
    state.score.history = [];
    state.score.undoStack = [];
  }
  recalculateScores(state);
}

export function applyTemplate(state, templateId, { clearScores = true } = {}) {
  const template = templateById(templateId);
  state.templateId = template.id;
  state.timer.mode = template.timerMode;
  state.timer.baseSeconds = template.seconds;
  state.timer.remainingSeconds = template.seconds;
  state.timer.sharedRemainingSeconds = template.seconds;
  state.timer.running = false;
  state.timer.deadlineMs = null;
  state.players.forEach(player => { player.poolSeconds = template.seconds; });
  applyPreset(state, template.scorePreset, { clearScores });
}

// Starts a fresh game with the same group: keeps the roster, names, colors,
// template, scoring fields, rule/target and durations, but clears all points,
// history, tool results and returns to round 1.
export function prepareRematch(state) {
  pauseTimer(state);
  state.session.status = 'active';
  state.session.startedAt = null;
  state.session.finishedAt = null;
  state.screen = 'workspace';
  state.activeTool = 'flow';
  state.timer.round = 1;
  state.timer.remainingSeconds = state.timer.baseSeconds;
  state.timer.sharedRemainingSeconds = state.timer.baseSeconds;
  state.timer.running = false;
  state.timer.deadlineMs = null;
  state.timer.timeoutHandled = false;
  state.timer.activePlayerId = state.players[0]?.id || null;
  state.players.forEach(player => {
    player.poolSeconds = state.timer.baseSeconds;
    player.scoreBreakdown = {};
  });
  state.score.rounds = [];
  state.score.history = [];
  state.score.undoStack = [];
  state.tools.history = [];
  state.tools.lastFirstPlayerId = null;
  state.tools.shuffledPlayerIds = [];
  state.tools.teams = [];
  ensureRound(state, state.timer.round);
  recalculateScores(state);
  return state;
}

export function activePlayer(state) {
  return state.players.find(player => player.id === state.timer.activePlayerId) || state.players[0] || null;
}

export function currentTimerSeconds(state, now = Date.now()) {
  if (state.timer.running && state.timer.deadlineMs) {
    return Math.max(0, Math.ceil((state.timer.deadlineMs - now) / 1000));
  }
  if (state.timer.mode === 'chess') return activePlayer(state)?.poolSeconds || 0;
  if (state.timer.mode === 'pool') return state.timer.sharedRemainingSeconds;
  return state.timer.remainingSeconds;
}

function writeTimerSeconds(state, seconds) {
  const safe = clamp(seconds, 0, 86400);
  if (state.timer.mode === 'chess') {
    const player = activePlayer(state);
    if (player) player.poolSeconds = safe;
  } else if (state.timer.mode === 'pool') {
    state.timer.sharedRemainingSeconds = safe;
  } else {
    state.timer.remainingSeconds = safe;
  }
  return safe;
}

export function reconcileTimer(state, now = Date.now()) {
  if (!state.timer.running || !state.timer.deadlineMs) return { expired: false, remaining: currentTimerSeconds(state, now) };
  const remaining = writeTimerSeconds(state, Math.max(0, Math.ceil((state.timer.deadlineMs - now) / 1000)));
  const expired = remaining <= 0;
  if (expired) {
    state.timer.running = false;
    state.timer.deadlineMs = null;
  }
  return { expired, remaining };
}

export function startTimer(state, now = Date.now()) {
  if (state.session.status === 'finished') return false;
  const seconds = currentTimerSeconds(state, now);
  if (seconds <= 0) return false;
  state.timer.running = true;
  state.timer.timeoutHandled = false;
  state.timer.deadlineMs = now + seconds * 1000;
  return true;
}

export function pauseTimer(state, now = Date.now()) {
  reconcileTimer(state, now);
  state.timer.running = false;
  state.timer.deadlineMs = null;
}

export function adjustTimer(state, deltaSeconds, now = Date.now()) {
  const wasRunning = state.timer.running;
  reconcileTimer(state, now);
  const next = writeTimerSeconds(state, currentTimerSeconds(state, now) + Number(deltaSeconds || 0));
  state.timer.timeoutHandled = false;
  state.timer.running = wasRunning && next > 0;
  state.timer.deadlineMs = state.timer.running ? now + next * 1000 : null;
  return next;
}

export function resetTimer(state) {
  state.timer.running = false;
  state.timer.deadlineMs = null;
  state.timer.timeoutHandled = false;
  writeTimerSeconds(state, state.timer.baseSeconds);
}

export function setActivePlayer(state, playerId, { resetTurn = true } = {}) {
  if (!state.players.some(player => player.id === playerId)) return false;
  pauseTimer(state);
  state.timer.activePlayerId = playerId;
  if (state.timer.mode === 'turn' && resetTurn) state.timer.remainingSeconds = state.timer.baseSeconds;
  state.timer.timeoutHandled = false;
  return true;
}

export function nextPlayer(state) {
  if (!state.players.length) return null;
  const currentIndex = Math.max(0, state.players.findIndex(player => player.id === state.timer.activePlayerId));
  const next = state.players[(currentIndex + 1) % state.players.length];
  setActivePlayer(state, next.id);
  return next;
}

export function nextRound(state) {
  pauseTimer(state);
  state.timer.round += 1;
  state.timer.activePlayerId = state.players[0]?.id || null;
  if (state.timer.mode === 'turn' || state.timer.mode === 'round') state.timer.remainingSeconds = state.timer.baseSeconds;
  state.timer.timeoutHandled = false;
  return ensureRound(state, state.timer.round);
}

export function ensureRound(state, roundNumber = state.timer.round) {
  const number = clamp(roundNumber, 1, 9999);
  let round = state.score.rounds.find(item => Number(item.round) === number);
  if (!round) {
    round = { round: number, scores: {}, createdAt: new Date().toISOString(), updatedAt: null };
    state.score.rounds.push(round);
    state.score.rounds.sort((a, b) => a.round - b.round);
  }
  state.players.forEach(player => {
    round.scores[player.id] ||= {};
    state.score.fields.forEach(field => {
      if (round.scores[player.id][field.id] == null) round.scores[player.id][field.id] = 0;
    });
  });
  return round;
}

export function roundScoreValue(round, playerId, fieldId) {
  return Number(round?.scores?.[playerId]?.[fieldId] || 0);
}

export function setRoundScore(state, roundNumber, playerId, fieldId, value, { recordUndo = true, label = 'score.edit' } = {}) {
  const field = state.score.fields.find(item => item.id === fieldId);
  if (!field || !state.players.some(player => player.id === playerId)) return false;
  const round = ensureRound(state, roundNumber);
  const previous = roundScoreValue(round, playerId, fieldId);
  const next = clamp(value, 0, 999999);
  if (previous === next) return false;
  round.scores[playerId][fieldId] = next;
  round.updatedAt = new Date().toISOString();
  if (recordUndo) pushUndo(state, { kind: 'score', round: round.round, playerId, fieldId, previous, next, label });
  recalculateScores(state);
  return true;
}

export function addRoundScore(state, roundNumber, playerId, fieldId, delta, label = 'score.adjust') {
  const round = ensureRound(state, roundNumber);
  return setRoundScore(
    state,
    roundNumber,
    playerId,
    fieldId,
    roundScoreValue(round, playerId, fieldId) + Number(delta || 0),
    { recordUndo: true, label }
  );
}

function pushUndo(state, change) {
  state.score.undoStack.push(change);
  state.score.undoStack = state.score.undoStack.slice(-50);
}

export function undoScore(state) {
  const change = state.score.undoStack.pop();
  if (!change || change.kind !== 'score') return null;
  setRoundScore(state, change.round, change.playerId, change.fieldId, change.previous, { recordUndo: false });
  return change;
}

export function recalculateScores(state) {
  state.players.forEach(player => {
    const breakdown = {};
    state.score.fields.forEach(field => { breakdown[field.id] = 0; });
    state.score.rounds.forEach(round => {
      state.score.fields.forEach(field => {
        breakdown[field.id] += roundScoreValue(round, player.id, field.id);
      });
    });
    player.scoreBreakdown = breakdown;
    player.score = state.score.fields.reduce((sum, field) => sum + breakdown[field.id] * field.effect, 0);
  });
}

export function totalScore(state, player) {
  return Number(player?.score || 0);
}

export function rankedPlayers(state) {
  const sorted = state.players.slice().sort((a, b) => {
    const delta = state.score.rule === 'highest' ? totalScore(state, b) - totalScore(state, a) : totalScore(state, a) - totalScore(state, b);
    return delta || state.players.indexOf(a) - state.players.indexOf(b);
  });
  let priorScore = null;
  let priorRank = 0;
  return sorted.map((player, index) => {
    const score = totalScore(state, player);
    const rank = priorScore === score ? priorRank : index + 1;
    priorScore = score;
    priorRank = rank;
    return { player, score, rank };
  });
}

export function targetReached(state) {
  return state.players.some(player => totalScore(state, player) >= state.score.target);
}

export function roundTotal(state, round) {
  return state.players.reduce((sum, player) => sum + state.score.fields.reduce((fieldSum, field) => {
    return fieldSum + roundScoreValue(round, player.id, field.id) * field.effect;
  }, 0), 0);
}

export function removePlayer(state, playerId) {
  if (state.players.length <= 1) return false;
  const index = state.players.findIndex(player => player.id === playerId);
  if (index < 0) return false;
  state.players.splice(index, 1);
  state.score.rounds.forEach(round => { delete round.scores[playerId]; });
  state.tools.shuffledPlayerIds = [];
  state.tools.teams = [];
  if (state.tools.lastFirstPlayerId === playerId) state.tools.lastFirstPlayerId = null;
  if (state.timer.activePlayerId === playerId) state.timer.activePlayerId = state.players[Math.min(index, state.players.length - 1)]?.id || null;
  recalculateScores(state);
  return true;
}

export function addPlayer(state) {
  if (state.players.length >= MAX_PLAYERS) return null;
  const index = state.players.length;
  const player = {
    id: uid('p_'), name: '', defaultNameIndex: index + 1,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    poolSeconds: state.timer.baseSeconds, score: 0, scoreBreakdown: {}
  };
  state.players.push(player);
  state.tools.shuffledPlayerIds = [];
  state.tools.teams = [];
  state.score.rounds.forEach(round => {
    round.scores[player.id] = Object.fromEntries(state.score.fields.map(field => [field.id, 0]));
  });
  recalculateScores(state);
  return player;
}

export function movePlayer(state, playerId, direction) {
  const index = state.players.findIndex(player => player.id === playerId);
  const target = index + (Number(direction) >= 0 ? 1 : -1);
  if (index < 0 || target < 0 || target >= state.players.length) return false;
  const [moved] = state.players.splice(index, 1);
  state.players.splice(target, 0, moved);
  state.tools.shuffledPlayerIds = [];
  state.tools.teams = [];
  return true;
}

export function setPlayerColor(state, playerId, color) {
  const player = state.players.find(item => item.id === playerId);
  if (!player || !PLAYER_COLORS.includes(color)) return false;
  player.color = color;
  return true;
}

export function addScoreField(state, name = '') {
  if (state.score.fields.length >= 12) return null;
  const field = { id: uid('field_'), nameKey: '', customName: String(name).slice(0, 20), step: 1, effect: 1 };
  state.score.fields.push(field);
  state.score.rounds.forEach(round => state.players.forEach(player => {
    round.scores[player.id] ||= {};
    round.scores[player.id][field.id] = 0;
  }));
  recalculateScores(state);
  return field;
}

export function removeScoreField(state, fieldId) {
  if (state.score.fields.length <= 1) return false;
  const index = state.score.fields.findIndex(field => field.id === fieldId);
  if (index < 0) return false;
  state.score.fields.splice(index, 1);
  state.score.rounds.forEach(round => state.players.forEach(player => { delete round.scores[player.id]?.[fieldId]; }));
  state.score.undoStack = [];
  recalculateScores(state);
  return true;
}

function randomUint32(randomSource = globalThis.crypto) {
  if (randomSource?.getRandomValues) {
    const value = new Uint32Array(1);
    randomSource.getRandomValues(value);
    return value[0];
  }
  return Math.floor(Math.random() * 0x100000000);
}

export function randomInt(max, randomSource = globalThis.crypto) {
  const limit = Math.floor(Number(max));
  if (limit <= 0) return 0;
  const ceiling = 0x100000000 - (0x100000000 % limit);
  let value;
  do { value = randomUint32(randomSource); } while (value >= ceiling);
  return value % limit;
}

export function shuffle(items, randomSource = globalThis.crypto) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1, randomSource);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function rollDice({ sides = 6, count = 1, modifier = 0 } = {}, randomSource = globalThis.crypto) {
  const safeSides = clamp(sides, 2, 1000);
  const safeCount = clamp(count, 1, 10);
  const safeModifier = clamp(modifier, -99, 99);
  const rolls = Array.from({ length: safeCount }, () => randomInt(safeSides, randomSource) + 1);
  return { sides: safeSides, count: safeCount, modifier: safeModifier, rolls, total: rolls.reduce((sum, value) => sum + value, 0) + safeModifier };
}

export function flipCoin(randomSource = globalThis.crypto) {
  return randomInt(2, randomSource) === 0 ? 'heads' : 'tails';
}

export function chooseFirstPlayer(state, randomSource = globalThis.crypto) {
  if (!state.players.length) return null;
  const player = state.players[randomInt(state.players.length, randomSource)];
  state.tools.lastFirstPlayerId = player.id;
  return player;
}

export function shufflePlayerOrder(state, randomSource = globalThis.crypto) {
  const ids = shuffle(state.players.map(player => player.id), randomSource);
  state.tools.shuffledPlayerIds = ids;
  return ids;
}

export function applyShuffledOrder(state) {
  const ids = state.tools.shuffledPlayerIds;
  if (ids.length !== state.players.length || ids.some(id => !state.players.some(player => player.id === id))) return false;
  const byId = new Map(state.players.map(player => [player.id, player]));
  state.players = ids.map(id => byId.get(id));
  state.timer.activePlayerId = state.players[0]?.id || null;
  pauseTimer(state);
  return true;
}

export function makeTeams(state, teamCount = 2, randomSource = globalThis.crypto) {
  const safeCount = clamp(teamCount, 2, Math.min(4, state.players.length));
  if (state.players.length < 2) return [];
  const ids = shuffle(state.players.map(player => player.id), randomSource);
  const teams = Array.from({ length: safeCount }, (_, index) => ({ index, playerIds: [] }));
  ids.forEach((id, index) => teams[index % safeCount].playerIds.push(id));
  state.tools.teams = teams;
  return teams;
}

export function addToolHistory(state, entry) {
  state.tools.history.push({ id: uid('tool_'), at: new Date().toISOString(), ...entry });
  state.tools.history = state.tools.history.slice(-20);
}
