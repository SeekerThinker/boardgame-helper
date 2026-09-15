import { STORAGE_KEY } from './core.js';
import { TABLE_OS_STORAGE_KEY } from './tabletop-core.js';

const COMPANION_STORAGE_KEY = 'board-game-assistant-table-os-companion-v1';

const I18N = {
  zh: {
    mainGame: '主对局', round: '第 {value} 轮', running: '进行中', paused: '已暂停', openFlow: '主计时器',
    undo: '撤销上一步', undone: '已撤销上一步。', undoUnavailable: '这一步已经无法撤销。',
    trackerAction: '状态调整', statusAction: '状态开关', phaseAction: '阶段切换', scoreAction: '计分修改', flagAction: '检查点修改',
    increase: '增加', decrease: '减少', setValue: '设置', switchPhase: '切换到阶段',
    rosterChanged: '主对局玩家已变更', syncRoster: '同步玩家', rosterSynced: '已同步主对局玩家。',
    newSessionDetected: '检测到新的主牌局', startNewSession: '开始新一局', keepTableState: '保留当前桌面',
    newSessionStarted: '已为新牌局重置本局状态。', tableStateKept: '已保留当前桌面状态。'
  },
  en: {
    mainGame: 'Main game', round: 'Round {value}', running: 'Running', paused: 'Paused', openFlow: 'Main timer',
    undo: 'Undo last action', undone: 'Last action undone.', undoUnavailable: 'That action can no longer be undone.',
    trackerAction: 'Tracker adjustment', statusAction: 'Status toggle', phaseAction: 'Phase change', scoreAction: 'Score edit', flagAction: 'Checkpoint change',
    increase: 'Increase', decrease: 'Decrease', setValue: 'Set', switchPhase: 'Switch to phase',
    rosterChanged: 'Main-game players changed', syncRoster: 'Sync players', rosterSynced: 'Main-game players synced.',
    newSessionDetected: 'New main game detected', startNewSession: 'Start new table', keepTableState: 'Keep table state',
    newSessionStarted: 'Session state reset for the new game.', tableStateKept: 'Current table state kept.'
  }
};

let lastUndo = null;
let notice = '';
let noticeTimer = null;
let suppressCapture = false;
let refreshQueued = false;
let wasOpen = false;
const inputSnapshots = new WeakMap();

function locale() {
  return document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function tr(key, values = {}) {
  let text = I18N[locale()][key] ?? I18N.zh[key] ?? key;
  Object.entries(values).forEach(([name, value]) => { text = text.replace(`{${name}}`, String(value)); });
  return text;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function readStoredState(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function readGameState() {
  return readStoredState(STORAGE_KEY);
}

function readTableOsState() {
  return readStoredState(TABLE_OS_STORAGE_KEY);
}

function readCompanionState() {
  const stored = readStoredState(COMPANION_STORAGE_KEY);
  return {
    associatedMainSessionId: typeof stored?.associatedMainSessionId === 'string' ? stored.associatedMainSessionId : ''
  };
}

function writeCompanionState(next) {
  try { localStorage.setItem(COMPANION_STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
}

function displayPlayer(game, player) {
  if (!player) return '—';
  const name = String(player.name || '').trim();
  if (name) return name;
  const index = Number(player.defaultNameIndex) || Math.max(1, (game.players || []).indexOf(player) + 1);
  return locale() === 'en' ? `Player ${index}` : `玩家 ${index}`;
}

function currentTimerSeconds(game) {
  const timer = game?.timer || {};
  if (timer.running && Number(timer.deadlineMs) > 0) {
    return Math.max(0, Math.ceil((Number(timer.deadlineMs) - Date.now()) / 1000));
  }
  if (timer.mode === 'chess') {
    return Math.max(0, Number((game.players || []).find(player => player.id === timer.activePlayerId)?.poolSeconds) || 0);
  }
  if (timer.mode === 'pool') return Math.max(0, Number(timer.sharedRemainingSeconds) || 0);
  return Math.max(0, Number(timer.remainingSeconds) || 0);
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function mainSessionIdentity(game) {
  const rounds = Array.isArray(game?.score?.rounds) ? game.score.rounds : [];
  const firstRound = rounds.find(round => Number(round?.round) === 1);
  const createdAt = typeof firstRound?.createdAt === 'string' ? firstRound.createdAt.trim() : '';
  if (createdAt) return `round:${createdAt}`;
  const startedAt = typeof game?.session?.startedAt === 'string' ? game.session.startedAt.trim() : '';
  return startedAt ? `start:${startedAt}` : '';
}

function tableHasSessionState(table) {
  if (!table || typeof table !== 'object') return false;
  const trackers = Array.isArray(table.trackers) ? table.trackers : [];
  const sessionTrackerValues = trackers.some(tracker => tracker?.persistence !== 'campaign'
    && tracker?.values && typeof tracker.values === 'object' && Object.keys(tracker.values).length > 0);
  const statuses = Array.isArray(table.statuses) ? table.statuses : [];
  const statusChanged = statuses.some(status => {
    const values = status?.values && typeof status.values === 'object' ? status.values : {};
    const initial = Boolean(status?.initial);
    return Object.values(values).some(value => Boolean(value) !== initial);
  });
  const phases = table.phases && typeof table.phases === 'object' ? table.phases : {};
  const phaseMoved = Number(phases.activeIndex || 0) !== 0 || Math.max(1, Number(phases.cycle) || 1) !== 1;
  const checklistProgress = (Array.isArray(phases.items) ? phases.items : []).some(phase =>
    (Array.isArray(phase?.checklist) ? phase.checklist : []).some(item => Boolean(item?.done))
  );
  const rolesAssigned = Array.isArray(table.roles) && table.roles.length > 0;
  const scoreRows = table.scoreSheet?.values && typeof table.scoreSheet.values === 'object'
    ? Object.values(table.scoreSheet.values) : [];
  const scoresEntered = scoreRows.some(values => values && typeof values === 'object' && Object.keys(values).length > 0);
  return Boolean(sessionTrackerValues || statusChanged || phaseMoved || checklistProgress || rolesAssigned || scoresEntered || table.campaign?.enabled);
}

function mainSessionLifecycle(game) {
  const currentId = mainSessionIdentity(game);
  if (!currentId) return { id: '', changed: false };
  const stored = readCompanionState();
  if (!stored.associatedMainSessionId) {
    writeCompanionState({ associatedMainSessionId: currentId });
    return { id: currentId, changed: false };
  }
  if (stored.associatedMainSessionId === currentId) return { id: currentId, changed: false };
  if (!tableHasSessionState(readTableOsState())) {
    writeCompanionState({ associatedMainSessionId: currentId });
    return { id: currentId, changed: false };
  }
  return { id: currentId, changed: true };
}

function associateMainSession(sessionId) {
  if (!sessionId) return false;
  writeCompanionState({ associatedMainSessionId: sessionId });
  return true;
}

function rosterNeedsSync(game) {
  const table = readTableOsState();
  const gamePlayers = Array.isArray(game?.players) ? game.players : [];
  const participants = Array.isArray(table?.participants) ? table.participants : [];
  const sourced = participants.filter(participant => participant?.sourcePlayerId);
  if (sourced.length !== gamePlayers.length) return true;
  return gamePlayers.some((player, index) => {
    const participant = sourced[index];
    if (!participant || String(participant.sourcePlayerId) !== String(player?.id ?? '')) return true;
    const gameName = String(player?.name || '').trim();
    if (gameName && String(participant.name || '').trim() !== gameName) return true;
    const gameColor = String(player?.color || '');
    if (/^#[0-9a-f]{6}$/i.test(gameColor) && String(participant.color || '').toLowerCase() !== gameColor.toLowerCase()) return true;
    return false;
  });
}

function mainGameContext() {
  const game = readGameState();
  if (!game || game.screen !== 'workspace') return null;
  const players = Array.isArray(game.players) ? game.players : [];
  const active = players.find(player => player.id === game.timer?.activePlayerId) || players[0] || null;
  const lifecycle = mainSessionLifecycle(game);
  return {
    session: String(game.session?.name || '').trim() || tr('mainGame'),
    round: Math.max(1, Number(game.timer?.round) || 1),
    player: displayPlayer(game, active),
    seconds: currentTimerSeconds(game),
    running: Boolean(game.timer?.running),
    rosterDrift: rosterNeedsSync(game),
    sessionId: lifecycle.id,
    newSession: lifecycle.changed
  };
}

function activeSection() {
  return document.querySelector('.tableos-nav [data-os-section].active')?.dataset.osSection || 'overview';
}

function dataSelector(attribute, value) {
  return `[${attribute}="${CSS.escape(String(value))}"]`;
}

function inPlayMode() {
  return Boolean(document.querySelector('.tableos-sheet.is-playing'));
}

function activateSection(section) {
  const button = document.querySelector(dataSelector('data-os-section', section));
  if (button instanceof HTMLElement && !button.classList.contains('active')) button.click();
}

function runInSection(section, action) {
  activateSection(section);
  action();
}

function captureUndo(label, run) {
  if (suppressCapture || !inPlayMode()) return;
  lastUndo = { label, run };
  notice = '';
  refreshCompanion();
}

function clearUndo() {
  lastUndo = null;
  refreshCompanion();
}

function showNotice(message) {
  notice = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice = ''; refreshCompanion(); }, 2200);
  refreshCompanion();
}

function executeUndo() {
  const action = lastUndo;
  if (!action) return;
  suppressCapture = true;
  try {
    const restored = action.run();
    lastUndo = null;
    showNotice(restored === false ? tr('undoUnavailable') : tr('undone'));
  } finally {
    queueMicrotask(() => { suppressCapture = false; });
  }
}

function valueUndoFromInput(input, previous) {
  const attribute = input.dataset.osTrackerValue !== undefined ? 'data-os-tracker-value' : 'data-os-score-value';
  const value = input.dataset.osTrackerValue ?? input.dataset.osScoreValue;
  if (value == null) return null;
  const section = input.dataset.osTrackerValue !== undefined ? 'trackers' : 'score';
  return () => {
    let restored = false;
    runInSection(section, () => {
      const target = document.querySelector(dataSelector(attribute, value));
      if (!(target instanceof HTMLInputElement)) return;
      target.value = previous;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      restored = true;
    });
    return restored;
  };
}

function statusUndoFromButton(button) {
  const value = button.dataset.osStatusToggle;
  if (!value) return null;
  return () => {
    let restored = false;
    runInSection('statuses', () => {
      const target = document.querySelector(dataSelector('data-os-status-toggle', value));
      if (!(target instanceof HTMLElement)) return;
      target.click();
      restored = true;
    });
    return restored;
  };
}

function trackerUndoFromButton(button) {
  const raw = button.dataset.osTrackerDelta;
  if (!raw) return null;
  const parts = raw.split('|');
  if (parts.length !== 3) return null;
  const delta = Number(parts[2]);
  const counter = button.closest('.tableos-counter');
  const input = counter?.querySelector('[data-os-tracker-value]');
  if (!(input instanceof HTMLInputElement) || !Number.isFinite(delta)) return null;
  const current = Number(input.value);
  const min = input.min === '' ? -Infinity : Number(input.min);
  const max = input.max === '' ? Infinity : Number(input.max);
  const next = Math.min(max, Math.max(min, current + delta));
  if (next === current) return null;
  return valueUndoFromInput(input, input.value);
}


function scoreUndoFromButton(button) {
  const raw = button.dataset.osScoreDelta;
  if (!raw) return null;
  const parts = raw.split('|');
  if (parts.length !== 3) return null;
  const delta = Number(parts[2]);
  const stepper = button.closest('.tableos-score-stepper');
  const input = stepper?.querySelector('[data-os-score-value]');
  if (!(input instanceof HTMLInputElement) || !Number.isFinite(delta)) return null;
  const current = Number(input.value);
  if (!Number.isFinite(current)) return null;
  const next = Math.min(999999, Math.max(-999999, current + delta));
  if (next === current) return null;
  return valueUndoFromInput(input, input.value);
}

function phaseSnapshot() {
  const phases = readTableOsState()?.phases;
  if (!phases || !Array.isArray(phases.items) || !phases.items.length) return null;
  return {
    activeIndex: Math.max(0, Number(phases.activeIndex) || 0),
    cycle: Math.max(1, Number(phases.cycle) || 1),
    count: phases.items.length
  };
}

function restorePhaseSnapshot(snapshot) {
  let current = phaseSnapshot();
  if (!snapshot || !current || current.count !== snapshot.count) return false;

  if (current.cycle > snapshot.cycle) {
    const previous = document.querySelector('[data-os-action="prev-phase"]');
    if (!(previous instanceof HTMLElement)) return false;
    previous.click();
  } else if (current.cycle < snapshot.cycle) {
    const next = document.querySelector('[data-os-action="next-phase"]');
    if (!(next instanceof HTMLElement)) return false;
    next.click();
  }

  current = phaseSnapshot();
  if (!current) return false;
  if (current.activeIndex !== snapshot.activeIndex) {
    const target = document.querySelector(dataSelector('data-os-phase-active', snapshot.activeIndex));
    if (!(target instanceof HTMLElement)) return false;
    target.click();
  }

  current = phaseSnapshot();
  return Boolean(current && current.activeIndex === snapshot.activeIndex && current.cycle === snapshot.cycle);
}

function phaseUndoFromButton(button) {
  const before = phaseSnapshot();
  if (!before) return null;
  if (button.dataset.osPhaseActive !== undefined && Number(button.dataset.osPhaseActive) === before.activeIndex) return null;
  return () => restorePhaseSnapshot(before);
}

function flagUndoFromButton(button) {
  const id = button.dataset.osFlagToggle;
  if (!id) return null;
  return () => {
    const target = document.querySelector(dataSelector('data-os-flag-toggle', id));
    if (!(target instanceof HTMLElement)) return false;
    target.click();
    return true;
  };
}

function syncRosterFromMain() {
  const section = activeSection();
  lastUndo = null;
  const edit = document.querySelector('[data-os-mode="edit"]');
  if (!(edit instanceof HTMLElement)) return false;
  edit.click();
  const sync = document.querySelector('[data-os-action="sync"]');
  if (!(sync instanceof HTMLElement)) return false;
  sync.click();
  const play = document.querySelector('[data-os-mode="play"]');
  if (play instanceof HTMLElement) play.click();
  queueMicrotask(() => activateSection(section));
  showNotice(tr('rosterSynced'));
  return true;
}

function keepCurrentTableState() {
  const game = readGameState();
  const sessionId = mainSessionIdentity(game);
  if (!associateMainSession(sessionId)) return false;
  lastUndo = null;
  showNotice(tr('tableStateKept'));
  return true;
}

function startNewTableSession() {
  const game = readGameState();
  const sessionId = mainSessionIdentity(game);
  const reset = document.querySelector('[data-os-action="reset"]');
  if (!sessionId || !(reset instanceof HTMLElement)) return false;
  const before = localStorage.getItem(TABLE_OS_STORAGE_KEY);
  reset.click();
  const after = localStorage.getItem(TABLE_OS_STORAGE_KEY);
  if (!after || after === before) return false;
  associateMainSession(sessionId);
  lastUndo = null;
  if (rosterNeedsSync(game)) syncRosterFromMain();
  showNotice(tr('newSessionStarted'));
  return true;
}

function openMainFlow() {
  document.querySelector('.tableos-sheet [data-os-action="close"]')?.click();
  queueMicrotask(() => document.querySelector('[data-tab="flow"]')?.click());
}

function enhanceAccessibility(sheet) {
  sheet.querySelectorAll('.tableos-module').forEach(module => {
    const trackerName = module.querySelector('.tableos-live-head strong')?.textContent?.trim()
      || module.querySelector('[data-os-tracker-name]')?.value?.trim() || '';
    module.querySelectorAll('.tableos-counter').forEach(counter => {
      const entity = counter.querySelector(':scope > span')?.textContent?.trim() || '';
      const valueInput = counter.querySelector('[data-os-tracker-value]');
      if (valueInput instanceof HTMLElement && trackerName) valueInput.setAttribute('aria-label', `${trackerName} · ${entity}`);
      counter.querySelectorAll('[data-os-tracker-delta]').forEach(button => {
        const delta = Number(button.dataset.osTrackerDelta?.split('|').at(-1) || 0);
        const verb = delta >= 0 ? tr('increase') : tr('decrease');
        button.setAttribute('aria-label', `${verb} ${entity} · ${trackerName}`);
      });
    });
  });

  sheet.querySelectorAll('[data-os-phase-active]').forEach(button => {
    const phase = button.closest('.tableos-phase');
    const name = phase?.querySelector('strong')?.textContent?.trim() || phase?.querySelector('[data-os-phase-name]')?.value?.trim();
    if (name) button.setAttribute('aria-label', `${tr('switchPhase')} ${name}`);
  });

  sheet.querySelectorAll('.tableos-score-table > article').forEach(card => {
    const participant = card.querySelector('header strong')?.textContent?.trim() || '';
    card.querySelectorAll('.tableos-score-values label').forEach(label => {
      const field = label.querySelector('span')?.textContent?.trim() || '';
      const input = label.querySelector('[data-os-score-value]');
      if (input instanceof HTMLElement) input.setAttribute('aria-label', `${participant} · ${field}`);
    });
  });
}

function companionMarkup(context) {
  const alert = context?.newSession ? tr('newSessionDetected') : (context?.rosterDrift ? tr('rosterChanged') : '');
  const contextMarkup = context ? `<div class="tableos-companion-main" data-tableos-main-context>
      <span>${esc(tr('mainGame'))}</span><strong>${esc(context.session)}</strong>
      <small>${esc(tr('round', { value: context.round }))} · ${esc(context.player)} · <b data-tableos-main-time>${esc(formatClock(context.seconds))}</b> · ${esc(context.running ? tr('running') : tr('paused'))}${alert ? ` · <em>${esc(alert)}</em>` : ''}</small>
    </div>` : '';
  const sessionActions = context?.newSession
    ? `<button type="button" class="tableos-btn primary" data-tableos-companion-action="new-session">${esc(tr('startNewSession'))}</button><button type="button" class="tableos-btn" data-tableos-companion-action="keep-session">${esc(tr('keepTableState'))}</button>`
    : (context?.rosterDrift ? `<button type="button" class="tableos-btn" data-tableos-companion-action="sync">${esc(tr('syncRoster'))}</button>` : '');
  const actions = `${lastUndo ? `<button type="button" class="tableos-btn" data-tableos-companion-action="undo" title="${esc(lastUndo.label)}">↶ ${esc(tr('undo'))}</button>` : ''}${sessionActions}${context ? `<button type="button" class="tableos-btn" data-tableos-companion-action="flow">${esc(tr('openFlow'))}</button>` : ''}`;
  return `${contextMarkup}<div class="tableos-companion-actions">${actions}</div>${notice ? `<span class="tableos-companion-notice" role="status">${esc(notice)}</span>` : ''}`;
}

function refreshCompanion() {
  refreshQueued = false;
  const sheet = document.querySelector('.tableos-sheet');
  if (!(sheet instanceof HTMLElement)) {
    if (wasOpen) lastUndo = null;
    wasOpen = false;
    return;
  }
  wasOpen = true;
  enhanceAccessibility(sheet);
  const context = mainGameContext();
  if (context?.newSession) lastUndo = null;
  let bar = sheet.querySelector('.tableos-companion');
  if (!context && !lastUndo && !notice) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('aside');
    bar.className = 'tableos-companion';
    const nav = sheet.querySelector('.tableos-nav');
    if (nav) nav.before(bar); else sheet.querySelector('.tableos-content')?.before(bar);
  }
  const signature = JSON.stringify({ context, undo: lastUndo?.label || '', notice, lang: locale(), playing: inPlayMode() });
  if (bar.dataset.signature !== signature) {
    bar.dataset.signature = signature;
    bar.innerHTML = companionMarkup(context);
  }
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(refreshCompanion);
}

const BARRIER_SELECTOR = [
  '[data-os-action="reset"]', '[data-os-action="apply-template"]', '[data-os-action="sync"]',
  '[data-os-action="adopt-teams"]', '[data-os-action="import"]', '[data-os-quick-template]', '[data-os-mode="edit"]',
  '[data-os-remove-participant]', '[data-os-remove-tracker]', '[data-os-remove-phase]', '[data-os-remove-team]', '[data-os-remove-score]'
].join(',');

document.addEventListener('focusin', event => {
  const input = event.target;
  if (!inPlayMode() || !(input instanceof HTMLInputElement)) return;
  if (input.matches('[data-os-tracker-value],[data-os-score-value]')) inputSnapshots.set(input, input.value);
}, true);

document.addEventListener('change', event => {
  const input = event.target;
  if (suppressCapture || !inPlayMode() || !(input instanceof HTMLInputElement)) return;
  if (!input.matches('[data-os-tracker-value],[data-os-score-value]')) return;
  const previous = inputSnapshots.get(input);
  if (previous == null || previous === input.value) return;
  const run = valueUndoFromInput(input, previous);
  if (!run) return;
  captureUndo(input.dataset.osTrackerValue !== undefined ? tr('trackerAction') : tr('scoreAction'), run);
}, true);

document.addEventListener('click', event => {
  const element = event.target instanceof Element ? event.target : null;
  if (!element) return;
  const companionAction = element.closest('[data-tableos-companion-action]');
  if (companionAction) {
    event.preventDefault();
    event.stopPropagation();
    const action = companionAction.dataset.tableosCompanionAction;
    if (action === 'undo') executeUndo();
    if (action === 'sync') syncRosterFromMain();
    if (action === 'new-session') startNewTableSession();
    if (action === 'keep-session') keepCurrentTableState();
    if (action === 'flow') openMainFlow();
    return;
  }
  if (suppressCapture) return;
  if (element.closest(BARRIER_SELECTOR)) { clearUndo(); return; }
  if (!inPlayMode()) return;

  const status = element.closest('[data-os-status-toggle]');
  if (status) {
    const run = statusUndoFromButton(status);
    if (run) captureUndo(tr('statusAction'), run);
    return;
  }

  const tracker = element.closest('[data-os-tracker-delta]');
  if (tracker) {
    const run = trackerUndoFromButton(tracker);
    if (run) captureUndo(tr('trackerAction'), () => { let ok = false; runInSection('trackers', () => { ok = run() !== false; }); return ok; });
    return;
  }

  const score = element.closest('[data-os-score-delta]');
  if (score) {
    const run = scoreUndoFromButton(score);
    if (run) captureUndo(tr('scoreAction'), () => { let ok = false; runInSection('score', () => { ok = run() !== false; }); return ok; });
    return;
  }

  const phase = element.closest('[data-os-action="next-phase"],[data-os-action="prev-phase"],[data-os-phase-active]');
  if (phase) {
    const run = phaseUndoFromButton(phase);
    if (run) captureUndo(tr('phaseAction'), () => { let ok = false; runInSection('phases', () => { ok = run() !== false; }); return ok; });
    return;
  }

  const flag = element.closest('[data-os-flag-toggle]');
  if (flag) {
    const run = flagUndoFromButton(flag);
    if (run) captureUndo(tr('flagAction'), () => { let ok = false; runInSection('campaign', () => { ok = run() !== false; }); return ok; });
  }
}, true);

const observer = new MutationObserver(queueRefresh);
observer.observe(document.body, { childList: true, subtree: true });

setInterval(() => {
  const time = document.querySelector('[data-tableos-main-time]');
  const sheet = document.querySelector('.tableos-sheet');
  if (!time && !sheet) return;
  const context = mainGameContext();
  if (time && context) time.textContent = formatClock(context.seconds);
  if (sheet) queueRefresh();
}, 1000);

queueRefresh();