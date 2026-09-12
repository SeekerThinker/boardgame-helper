import { STORAGE_KEY } from './core.js';

const I18N = {
  zh: {
    mainGame: '主对局', round: '第 {value} 轮', running: '进行中', paused: '已暂停', openFlow: '主计时器',
    undo: '撤销上一步', undone: '已撤销上一步。', undoUnavailable: '这一步已经无法撤销。',
    trackerAction: '状态调整', phaseAction: '阶段切换', scoreAction: '计分修改', flagAction: '检查点修改',
    increase: '增加', decrease: '减少', setValue: '设置', switchPhase: '切换到阶段'
  },
  en: {
    mainGame: 'Main game', round: 'Round {value}', running: 'Running', paused: 'Paused', openFlow: 'Main timer',
    undo: 'Undo last action', undone: 'Last action undone.', undoUnavailable: 'That action can no longer be undone.',
    trackerAction: 'Tracker adjustment', phaseAction: 'Phase change', scoreAction: 'Score edit', flagAction: 'Checkpoint change',
    increase: 'Increase', decrease: 'Decrease', setValue: 'Set', switchPhase: 'Switch to phase'
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

function readGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
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

function mainGameContext() {
  const game = readGameState();
  if (!game || game.screen !== 'workspace') return null;
  const players = Array.isArray(game.players) ? game.players : [];
  const active = players.find(player => player.id === game.timer?.activePlayerId) || players[0] || null;
  return {
    session: String(game.session?.name || '').trim() || tr('mainGame'),
    round: Math.max(1, Number(game.timer?.round) || 1),
    player: displayPlayer(game, active),
    seconds: currentTimerSeconds(game),
    running: Boolean(game.timer?.running)
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
  const opposite = `${parts[0]}|${parts[1]}|${-delta}`;
  return () => {
    const target = document.querySelector(dataSelector('data-os-tracker-delta', opposite));
    if (!(target instanceof HTMLElement)) return false;
    target.click();
    return true;
  };
}

function phaseUndoFromButton(button) {
  if (button.dataset.osAction === 'next-phase') {
    return () => { const target = document.querySelector('[data-os-action="prev-phase"]'); if (!(target instanceof HTMLElement)) return false; target.click(); return true; };
  }
  if (button.dataset.osAction === 'prev-phase') {
    return () => { const target = document.querySelector('[data-os-action="next-phase"]'); if (!(target instanceof HTMLElement)) return false; target.click(); return true; };
  }
  if (button.dataset.osPhaseActive !== undefined) {
    const previous = document.querySelector('.tableos-phase.active [data-os-phase-active]')?.dataset.osPhaseActive;
    if (previous == null || previous === button.dataset.osPhaseActive) return null;
    return () => {
      const target = document.querySelector(dataSelector('data-os-phase-active', previous));
      if (!(target instanceof HTMLElement)) return false;
      target.click();
      return true;
    };
  }
  return null;
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
  const contextMarkup = context ? `<div class="tableos-companion-main" data-tableos-main-context>
      <span>${esc(tr('mainGame'))}</span><strong>${esc(context.session)}</strong>
      <small>${esc(tr('round', { value: context.round }))} · ${esc(context.player)} · <b data-tableos-main-time>${esc(formatClock(context.seconds))}</b> · ${esc(context.running ? tr('running') : tr('paused'))}</small>
    </div>` : '';
  const actions = `${lastUndo ? `<button type="button" class="tableos-btn" data-tableos-companion-action="undo" title="${esc(lastUndo.label)}">↶ ${esc(tr('undo'))}</button>` : ''}${context ? `<button type="button" class="tableos-btn" data-tableos-companion-action="flow">${esc(tr('openFlow'))}</button>` : ''}`;
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
    if (companionAction.dataset.tableosCompanionAction === 'undo') executeUndo();
    if (companionAction.dataset.tableosCompanionAction === 'flow') openMainFlow();
    return;
  }
  if (suppressCapture) return;
  if (element.closest(BARRIER_SELECTOR)) { clearUndo(); return; }
  if (!inPlayMode()) return;

  const tracker = element.closest('[data-os-tracker-delta]');
  if (tracker) {
    const run = trackerUndoFromButton(tracker);
    if (run) captureUndo(tr('trackerAction'), () => { let ok = false; runInSection('trackers', () => { ok = run() !== false; }); return ok; });
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
  const context = mainGameContext();
  if (time && context) time.textContent = formatClock(context.seconds);
  if (document.querySelector('.tableos-sheet')) queueRefresh();
}, 1000);

queueRefresh();
