import {
  STORAGE_KEY, LEGACY_STORAGE_KEY, MAX_PLAYERS, FLOW_TEMPLATES, SCORE_PRESETS,
  PLAYER_COLORS, createDefaultState, normalizeState, applyPreset, applyTemplate, templateById, uid,
  activePlayer, currentTimerSeconds, reconcileTimer, startTimer, pauseTimer,
  adjustTimer, resetTimer, setActivePlayer, nextPlayer, nextRound, ensureRound,
  roundScoreValue, setRoundScore, addRoundScore, undoScore, recalculateScores,
  rankedPlayers, totalScore, targetReached, roundTotal, removePlayer, addPlayer,
  addScoreField, removeScoreField, rollDice, flipCoin, chooseFirstPlayer,
  shufflePlayerOrder, applyShuffledOrder, makeTeams, setDrawBagFromText, drawFromBag, resetDrawBag, addToolHistory, clamp, prepareRematch,
  movePlayer, setPlayerColor
} from './core.js';
import { t, fieldName, playerName, formatClock, formatDateTime, signedNumber } from './i18n.js';
import {
  checkNotificationPermission, requestNotificationPermission, scheduleTimerNotification,
  cancelTimerNotification, initializeNotifications, observeAppState, copyText, isNativePlatform,
  setKeepScreenOn, shareText
} from './native.js';
import {
  sTick, sWarn, sFinish, sElim, sRoundDone, sOver, speakNumber,
  setSoundOn, setAudioLocale
} from './audio.js';
import {
  loadArchive, saveGameToArchive, deleteArchiveEntry, clearArchive
} from './archive.js';
import { buildTableOsArchiveSummary } from './tabletop-archive-bridge.js';

let state = loadState();
let settingsOpen = false;
let toastMessage = '';
let toastTimer = null;
let lastAnnouncedSecond = null;
let diceConfig = { sides: 6, count: 1, modifier: 0 };
let teamCount = 2;
let lastRandomResult = null;
let archivedGames = loadArchive();
let colorPickerPlayerId = null;
const nativeRuntime = isNativePlatform();

function loadState() {
  const preferredLocale = navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeState(JSON.parse(current), preferredLocale);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const migrated = normalizeState(legacy ? JSON.parse(legacy) : null, preferredLocale);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (_) {
    return createDefaultState(preferredLocale);
  }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

function tr(key, values) {
  return t(state.locale, key, values);
}

function displayPlayer(player) {
  return playerName(state.locale, player);
}

function displayField(field) {
  return fieldName(state.locale, field);
}

function sessionName() {
  return state.session.name.trim() || tr('app.defaultSession');
}

function notificationDisclosure() {
  return tr(nativeRuntime ? 'settings.notificationDisclosureNative' : 'settings.notificationDisclosureWeb');
}

function addHistory(key, values = {}) {
  state.score.history.push({ key, values, at: new Date().toISOString() });
  state.score.history = state.score.history.slice(-200);
}

function historyText(item) {
  return item?.key ? tr(item.key, item.values || {}) : String(item?.text || '');
}

function showToast(key, values) {
  toastMessage = tr(key, values);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage = '';
    document.querySelector('.toast')?.remove();
  }, 2600);
}

function render() {
  const focusedAction = document.activeElement?.dataset?.action || null;
  recalculateScores(state);
  persist();
  document.documentElement.lang = state.locale === 'en' ? 'en' : 'zh-CN';
  document.title = tr('app.title');
  setSoundOn(state.settings.soundOn);
  setAudioLocale(state.locale);
  const app = document.getElementById('app');
  app.innerHTML = `${state.screen === 'setup' ? renderSetup() : renderWorkspace()}${renderSettings()}${toastMessage ? `<div class="toast" role="status">${escapeHtml(toastMessage)}</div>` : ''}`;
  updateTimerView();
  applyKeepAwake();
  if (settingsOpen) queueMicrotask(() => {
    const sheet = document.querySelector('.settings-sheet');
    const target = focusedAction ? sheet?.querySelector(`[data-action="${focusedAction}"]`) : null;
    (target || sheet?.querySelector('[data-action="close-settings"]'))?.focus({ preventScroll: true });
  });
}

function renderSetup() {
  const selected = templateById(state.templateId);
  const activePreset = SCORE_PRESETS.find(item => item.id === state.score.presetId) || SCORE_PRESETS[0];
  const durationMinutes = Math.floor(state.timer.baseSeconds / 60);
  const durationSeconds = state.timer.baseSeconds % 60;
  return `
    <main class="setup-shell">
      <header class="setup-header">
        <div class="hero">
          <p class="eyebrow">${tr('app.eyebrow')}</p>
          <h1>${tr('app.title')}</h1>
          <p class="hero-copy">${tr('app.hero')}</p>
        </div>
        <div class="top-actions">
          <button class="icon-btn" type="button" data-action="lang" aria-label="${tr('settings.language')}">${state.locale === 'zh' ? 'EN' : '中'}</button>
          <button class="icon-btn" type="button" data-action="open-settings" aria-label="${tr('action.settings')}">⚙</button>
        </div>
      </header>

      <section class="panel setup-name">
        <label>
          <span class="label-text">${tr('setup.sessionName')}</span>
          <input data-session-name maxlength="40" value="${escapeAttr(state.session.name)}" placeholder="${escapeAttr(tr('app.defaultSession'))}">
        </label>
      </section>

      <section class="panel">
        <div class="section-head"><div><h2>${tr('setup.scorePreset')}</h2><p>${tr(`preset.${activePreset.id}.desc`)}</p></div></div>
        <details class="collapsible">
          <summary>${tr('action.change')} · ${tr(`preset.${activePreset.id}.name`)}</summary>
          <div class="collapsible-body"><div class="preset-grid">
            ${SCORE_PRESETS.map(preset => `
              <button type="button" class="template-card ${preset.id === state.score.presetId ? 'selected' : ''}" data-score-preset="${preset.id}" aria-pressed="${preset.id === state.score.presetId}">
                <strong>${tr(`preset.${preset.id}.name`)}</strong><span>${tr(`preset.${preset.id}.desc`)}</span>
              </button>`).join('')}
          </div></div>
        </details>
      </section>

      <section class="panel">
        <div class="section-head">
          <div><h2>${tr('setup.flowTemplate')}</h2><p>${tr(`template.${selected.id}.desc`)}</p></div>
          <button class="icon-btn danger-soft" type="button" data-action="reset-all" aria-label="${tr('action.reset')}">↺</button>
        </div>
        <div class="template-grid">
          ${FLOW_TEMPLATES.map(template => `
            <button type="button" class="template-card ${template.id === state.templateId ? 'selected' : ''}" data-template="${template.id}" aria-pressed="${template.id === state.templateId}">
              <strong>${tr(`template.${template.id}.name`)}</strong><span>${tr(`template.${template.id}.desc`)}</span>
            </button>`).join('')}
        </div>
        <div class="pain-list">${selected.pain.map(key => `<span>${tr(`pain.${key}`)}</span>`).join('')}</div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div><h2>${tr('setup.players')}</h2><p>${tr('setup.playersHelp', { max: MAX_PLAYERS })}</p></div>
          <button class="text-btn" type="button" data-action="add-player" ${state.players.length >= MAX_PLAYERS ? 'disabled' : ''}>${tr('action.add')}</button>
        </div>
        <div class="player-editor">
          ${state.players.map((player, index) => `
            <div class="player-row">
              <button type="button" class="color-dot" data-color-picker="${player.id}" style="--player:${player.color}" aria-label="${escapeAttr(tr('a11y.playerColor', { name: displayPlayer(player) }))}"></button>
              <input data-player-name="${player.id}" maxlength="24" value="${escapeAttr(player.name)}" placeholder="${escapeAttr(displayPlayer(player))}" aria-label="${escapeAttr(displayPlayer(player))}">
              <span class="row-tools">
                <button class="icon-btn mini" type="button" data-move-player="${player.id}:-1" aria-label="${escapeAttr(tr('a11y.moveUp', { name: displayPlayer(player) }))}" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="icon-btn mini" type="button" data-move-player="${player.id}:1" aria-label="${escapeAttr(tr('a11y.moveDown', { name: displayPlayer(player) }))}" ${index === state.players.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="icon-btn danger" type="button" data-remove-player="${player.id}" aria-label="${tr('action.remove')}" ${state.players.length <= 1 ? 'disabled' : ''}>×</button>
              </span>
              ${colorPickerPlayerId === player.id ? `
                <div class="color-popover">
                  ${PLAYER_COLORS.map(color => `
                    <button type="button" class="color-dot chip ${player.color === color ? 'selected' : ''}" data-player-color="${player.id}:${color}" style="--player:${color}" aria-label="${color}"></button>`).join('')}
                  <button class="text-btn small" type="button" data-action="close-color-picker" aria-label="${tr('action.close')}">×</button>
                </div>` : ''}
            </div>`).join('')}
        </div>
      </section>

      <section class="panel setup-grid">
        <label><span class="label-text">${tr('setup.timerMode')}</span>
          <select data-setup-field="timer-mode">${timerModeOptions()}</select>
        </label>
        <div>
          <span class="label-text">${tr('setup.duration')}</span>
          <div class="duration-inputs">
            <label><input type="number" min="0" max="1440" value="${durationMinutes}" data-duration="minutes"><small>${tr('setup.minutes')}</small></label>
            <label><input type="number" min="0" max="59" value="${durationSeconds}" data-duration="seconds"><small>${tr('setup.seconds')}</small></label>
          </div>
        </div>
        <label><span class="label-text">${tr('setup.target')}</span><input type="number" min="1" max="999999" value="${state.score.target}" data-setup-field="score-target"></label>
        <label><span class="label-text">${tr('setup.rule')}</span>
          <select data-setup-field="score-rule"><option value="highest" ${state.score.rule === 'highest' ? 'selected' : ''}>${tr('setup.highest')}</option><option value="lowest" ${state.score.rule === 'lowest' ? 'selected' : ''}>${tr('setup.lowest')}</option></select>
        </label>
      </section>

      <section class="panel">
        <div class="section-head"><div><h2>${tr('settings.title')}</h2></div></div>
        <label class="opt-row"><span><strong>${tr('setup.notifications')}</strong><small>${tr(nativeRuntime ? 'setup.notificationsHelpNative' : 'setup.notificationsHelpWeb')}</small></span>
          <span class="switch"><input type="checkbox" data-background-alerts aria-label="${tr('a11y.backgroundAlerts')}" ${state.settings.backgroundAlerts ? 'checked' : ''}><span></span></span></label>
        <label class="opt-row"><span><strong>${tr('settings.keepScreenOn')}</strong><small>${tr('settings.keepScreenOnHelp')}</small></span>
          <span class="switch"><input type="checkbox" data-setting-keepawake aria-label="${tr('settings.keepScreenOn')}" ${state.settings.keepScreenOn ? 'checked' : ''}><span></span></span></label>
        <label class="opt-row"><span><strong>${tr('settings.sound')}</strong></span>
          <span class="switch"><input type="checkbox" data-setting-sound aria-label="${tr('settings.sound')}" ${state.settings.soundOn ? 'checked' : ''}><span></span></span></label>
      </section>

      <div class="sticky-cta">
        <button class="primary-action" type="button" data-action="start-session">${state.session.startedAt ? tr('setup.continueSession') : tr('setup.startSession')}</button>
      </div>
    </main>`;
}

function renderWorkspace() {
  const remaining = currentTimerSeconds(state);
  return `
    <main class="workspace">
      ${state.timer.running ? `<button type="button" class="running-badge ${remaining <= 10 ? 'danger' : ''}" id="runningBadge" data-action="goto-flow" aria-label="${escapeAttr(tr('a11y.runningBadge', { time: formatClock(remaining) }))}"><span id="runningBadgeTime">${formatClock(remaining)}</span></button>` : ''}
      <header class="topbar">
        <div><p class="eyebrow">${tr(`template.${state.templateId}.name`)}</p><h1>${escapeHtml(sessionName())}</h1></div>
        <div class="top-actions">
          <button class="icon-btn" type="button" data-action="lang" aria-label="${tr('settings.language')}">${state.locale === 'zh' ? 'EN' : '中'}</button>
          <button class="icon-btn ${state.settings.soundOn ? 'active' : ''}" type="button" data-action="sound" aria-label="${tr('settings.sound')}" aria-pressed="${state.settings.soundOn}">${state.settings.soundOn ? '🔔' : '🔕'}</button>
          <button class="icon-btn" type="button" data-action="open-settings" aria-label="${tr('action.settings')}">⚙</button>
        </div>
      </header>
      <nav class="tabs" role="tablist" aria-label="${tr('app.title')}">
        ${tabButton('flow')}${tabButton('score')}${tabButton('tools')}${tabButton('summary')}
      </nav>
      ${targetReached(state) && state.session.status === 'active' ? `<div class="target-banner" role="status">🎯 ${tr('score.targetReached', { target: state.score.target })}</div>` : ''}
      ${state.activeTool === 'flow' ? renderFlow() : ''}
      ${state.activeTool === 'score' ? renderScore() : ''}
      ${state.activeTool === 'tools' ? renderTools() : ''}
      ${state.activeTool === 'summary' ? renderSummary() : ''}
    </main>`;
}

function tabButton(id) {
  return `<button type="button" role="tab" class="${state.activeTool === id ? 'active' : ''}" data-tab="${id}" aria-selected="${state.activeTool === id}" aria-current="${state.activeTool === id ? 'page' : 'false'}">${tr(`nav.${id}`)}</button>`;
}

function renderFlow() {
  const active = activePlayer(state);
  const round = ensureRound(state, state.timer.round);
  const leader = rankedPlayers(state)[0];
  const locked = state.session.status === 'finished';
  return `
    <div class="flow-layout">
      <div class="flow-primary">
        <section class="timer-stage" style="--player:${active?.color || '#14b8a6'}">
          <div class="timer-meta"><span>${tr('timer.roundLabel', { round: state.timer.round })}</span><span>${tr(`timer.${state.timer.mode}`)}</span></div>
          <button type="button" class="active-player" data-action="next-player" aria-label="${escapeAttr(tr('a11y.nextPlayer', { name: displayPlayer(active) }))}" ${locked ? 'disabled' : ''}>${escapeHtml(displayPlayer(active))}</button>
          <div class="timer-display" id="timerDisplay" role="timer" aria-live="off">${formatClock(currentTimerSeconds(state))}</div>
          <div class="timer-progress" aria-hidden="true"><div class="timer-progress-fill" id="timerProgressFill" style="width:${timerProgressPercent(state)}%"></div></div>
          <div class="flow-glance">
            <span>${tr('timer.leader', { name: displayPlayer(leader?.player) })}</span>
            <strong>${leader?.score ?? 0}</strong><span>${tr('timer.roundScore', { score: roundTotal(state, round) })}</span>
          </div>
          <div class="timer-controls">
            <button class="control-btn" type="button" data-action="timer-minus" ${locked ? 'disabled' : ''}>${tr('timer.minus')}</button>
            <button class="control-main" type="button" data-action="timer-toggle" ${locked ? 'disabled' : ''}>${state.timer.running ? tr('action.pause') : tr('action.start')}</button>
            <button class="control-btn" type="button" data-action="timer-plus" ${locked ? 'disabled' : ''}>${tr('timer.plus')}</button>
          </div>
          <div class="timer-controls secondary">
            <button class="text-btn" type="button" data-action="timer-reset" ${locked ? 'disabled' : ''}>${tr('action.reset')}</button>
            <button class="text-btn" type="button" data-action="finish-turn" ${locked ? 'disabled' : ''}>${tr('timer.finishTurn')}</button>
            <button class="text-btn" type="button" data-action="next-round" ${locked ? 'disabled' : ''}>${tr('timer.nextRound')}</button>
          </div>
        </section>
        <section class="panel">
          <div class="section-head"><div><h2>${tr('timer.order')}</h2><p>${tr('timer.orderHelp')}</p></div></div>
          <div class="player-strip">
            ${state.players.map(player => `
              <div class="player-chip ${player.id === state.timer.activePlayerId ? 'active' : ''}" style="--player:${player.color}">
                <button type="button" class="chip-main" data-set-active="${player.id}" aria-label="${escapeAttr(tr('a11y.makeActive', { name: displayPlayer(player) }))}" aria-pressed="${player.id === state.timer.activePlayerId}" ${locked ? 'disabled' : ''}>
                  <span>${escapeHtml(displayPlayer(player))}</span>
                  <strong>${state.timer.mode === 'chess' ? tr('timer.playerPool', { time: formatClock(player.poolSeconds) }) : `${totalScore(state, player)} ${tr('common.points')}`}</strong>
                </button>
                ${state.timer.mode !== 'chess' ? `
                  <span class="chip-score">
                    <button type="button" data-score-delta="${player.id}:-1" aria-label="${escapeAttr(tr('a11y.adjustQuickScore', { name: displayPlayer(player), field: displayField(state.score.fields[0]), delta: '−1' }))}" ${locked ? 'disabled' : ''}>−</button>
                    <button type="button" data-score-delta="${player.id}:1" aria-label="${escapeAttr(tr('a11y.adjustQuickScore', { name: displayPlayer(player), field: displayField(state.score.fields[0]), delta: '+1' }))}" ${locked ? 'disabled' : ''}>+</button>
                  </span>` : ''}
              </div>`).join('')}
          </div>
        </section>
      </div>
      <section class="panel flow-score">
        <div class="section-head"><div><h2>${tr('score.roundHeading', { round: round.round })}</h2><p>${tr('score.roundHelp')}</p></div><button class="text-btn" type="button" data-action="record-round" ${locked ? 'disabled' : ''}>${tr('score.recordRound')}</button></div>
        ${renderRoundScoreTable(round, locked)}
      </section>
    </div>`;
}

function renderScore() {
  const locked = state.session.status === 'finished';
  const primary = state.score.fields[0];
  const rounds = state.score.rounds.slice().sort((a, b) => b.round - a.round);
  return `
    <div class="score-layout">
      <div>
        <section class="panel">
          <div class="section-head"><div><h2>${tr('score.board')}</h2><p>${tr('score.ruleTarget', { rule: tr(state.score.rule === 'highest' ? 'common.highest' : 'common.lowest'), target: state.score.target, round: state.timer.round })}</p></div><button class="text-btn" type="button" data-action="undo-score" ${locked || !state.score.undoStack.length ? 'disabled' : ''}>${tr('action.undo')}</button></div>
          <p class="inline-note">${tr('score.quickField', { field: displayField(primary) })}</p>
          <div class="scoreboard">
            ${rankedPlayers(state).map(({ player, rank, score }) => `
              <article class="score-player" style="--player:${player.color}">
                <div class="score-row"><div class="rank">${rank}</div><div class="score-name">${escapeHtml(displayPlayer(player))}</div>
                  <button class="score-step" type="button" data-score-delta="${player.id}:-1" aria-label="${escapeAttr(tr('a11y.adjustQuickScore', { name: displayPlayer(player), field: displayField(primary), delta: '−1' }))}" ${locked ? 'disabled' : ''}>−</button><strong>${score}</strong>
                  <button class="score-step" type="button" data-score-delta="${player.id}:1" aria-label="${escapeAttr(tr('a11y.adjustQuickScore', { name: displayPlayer(player), field: displayField(primary), delta: '+1' }))}" ${locked ? 'disabled' : ''}>+</button><button class="text-btn" type="button" data-score-delta="${player.id}:5" aria-label="${escapeAttr(tr('a11y.adjustQuickScore', { name: displayPlayer(player), field: displayField(primary), delta: '+5' }))}" ${locked ? 'disabled' : ''}>+5</button>
                </div>
                <div class="score-fields">${state.score.fields.map(field => renderScoreFieldControl(player, field, locked)).join('')}</div>
              </article>`).join('')}
          </div>
        </section>
        <section class="panel">
          <div class="section-head"><div><h2>${tr('score.fields')}</h2><p>${tr('score.fieldsHelp')}</p></div></div>
          <details class="collapsible">
            <summary>${tr('score.editFields')} · ${state.score.fields.length}</summary>
            <div class="collapsible-body">
              <div class="field-editor">
                ${state.score.fields.map(field => `
                  <div class="field-row">
                    <input data-field-name="${field.id}" value="${escapeAttr(field.customName || displayField(field))}" maxlength="20" aria-label="${escapeAttr(tr('a11y.fieldName', { field: displayField(field) }))}">
                    <input data-field-step="${field.id}" type="number" min="1" max="1000" value="${field.step}" aria-label="${escapeAttr(tr('a11y.fieldStep', { field: displayField(field) }))}">
                    <select data-field-effect="${field.id}" aria-label="${escapeAttr(tr('a11y.fieldEffect', { field: displayField(field) }))}"><option value="1" ${field.effect === 1 ? 'selected' : ''}>＋</option><option value="-1" ${field.effect === -1 ? 'selected' : ''}>−</option></select>
                    <button class="icon-btn danger" type="button" data-remove-field="${field.id}" aria-label="${escapeAttr(tr('a11y.removeField', { field: displayField(field) }))}" ${locked || state.score.fields.length <= 1 ? 'disabled' : ''}>×</button>
                  </div>`).join('')}
              </div>
              <button class="text-btn" type="button" data-action="add-score-field" ${locked || state.score.fields.length >= 12 ? 'disabled' : ''}>${tr('score.addField')}</button>
            </div>
          </details>
        </section>
      </div>
      <div>
        <section class="panel">
          <div class="section-head"><div><h2>${tr('score.history')}</h2><p>${tr('score.historyHelp')}</p></div></div>
          <div class="round-history">
            ${rounds.map(round => `
              <details class="round-history-item" ${round.round === state.timer.round ? 'open' : ''}>
                <summary><strong>${tr('timer.roundLabel', { round: round.round })}</strong><span>${roundTotal(state, round)} ${tr('common.points')} · ${formatDateTime(state.locale, round.updatedAt || round.createdAt)}</span></summary>
                ${renderRoundScoreTable(round, locked, true)}
              </details>`).join('') || `<p class="empty-state">${tr('score.noRounds')}</p>`}
          </div>
        </section>
        <section class="panel">
          <div class="section-head"><div><h2>${tr('score.log')}</h2></div><button class="text-btn" type="button" data-action="copy-summary">${tr('action.copy')}</button></div>
          <div class="history-list">${state.score.history.slice().reverse().map(item => `<div><span>${escapeHtml(historyText(item))}</span><time>${formatDateTime(state.locale, item.at)}</time></div>`).join('') || `<p class="empty-state">${tr('score.noLog')}</p>`}</div>
        </section>
      </div>
    </div>`;
}

function renderScoreFieldControl(player, field, locked) {
  const raw = Number(player.scoreBreakdown?.[field.id] || 0);
  return `<div class="score-field"><span>${field.effect === -1 ? '− ' : ''}${escapeHtml(displayField(field))}</span><button type="button" data-score-field="${player.id}:${field.id}:${-field.step}" aria-label="${escapeAttr(tr('a11y.adjustScore', { name: displayPlayer(player), field: displayField(field), delta: signedNumber(-field.step) }))}" ${locked ? 'disabled' : ''}>−</button><strong>${raw}</strong><button type="button" data-score-field="${player.id}:${field.id}:${field.step}" aria-label="${escapeAttr(tr('a11y.adjustScore', { name: displayPlayer(player), field: displayField(field), delta: signedNumber(field.step) }))}" ${locked ? 'disabled' : ''}>+</button></div>`;
}

function renderRoundScoreTable(round, locked, compact = false) {
  return `<div class="round-score-table ${compact ? 'compact' : ''}">${state.players.map(player => `
    <div class="round-player" style="--player:${player.color}"><div class="round-player-name">${escapeHtml(displayPlayer(player))}</div>
      ${state.score.fields.map(field => `<label class="round-score-cell"><span>${field.effect === -1 ? '− ' : ''}${escapeHtml(displayField(field))}</span><input type="number" min="0" max="999999" inputmode="numeric" value="${roundScoreValue(round, player.id, field.id)}" data-round-score="${round.round}:${player.id}:${field.id}" aria-label="${escapeAttr(tr('a11y.roundScore', { round: round.round, name: displayPlayer(player), field: displayField(field) }))}" ${locked ? 'disabled' : ''}></label>`).join('')}
    </div>`).join('')}</div>`;
}

function renderTools() {
  const first = state.players.find(player => player.id === state.tools.lastFirstPlayerId);
  const shuffled = state.tools.shuffledPlayerIds.map(id => state.players.find(player => player.id === id)).filter(Boolean);
  const bag = state.tools.drawBag;
  const lastBagItem = bag.items.find(item => item.id === bag.lastDrawnId);
  const bagRemaining = bag.remainingIds.length;
  return `
    <section class="tool-intro"><p class="eyebrow">${tr('nav.tools')}</p><h2>${tr('tools.title')}</h2><p>${tr('tools.subtitle')}</p></section>
    <div class="tools-grid">
      <section class="panel tool-card"><div class="section-head"><div><h2>🎲 ${tr('tools.dice')}</h2><p>${tr('tools.diceHelp')}</p></div></div>
        <div class="tool-form three"><label><span>${tr('tools.sides')}</span><select data-dice="sides">${[4, 6, 8, 10, 12, 20].map(value => `<option value="${value}" ${diceConfig.sides === value ? 'selected' : ''}>d${value}</option>`).join('')}</select></label>
          <label><span>${tr('tools.count')}</span><input data-dice="count" type="number" min="1" max="10" value="${diceConfig.count}"></label>
          <label><span>${tr('tools.modifier')}</span><input data-dice="modifier" type="number" min="-99" max="99" value="${diceConfig.modifier}"></label></div>
        <div class="tool-result random-result" role="status">${renderRandomResult()}</div>
        <div class="split-actions"><button class="primary-action small" type="button" data-action="roll-dice">${tr('tools.roll')}</button><button class="text-btn large" type="button" data-action="flip-coin">${tr('tools.flip')}</button></div>
      </section>
      <section class="panel tool-card"><div class="section-head"><div><h2>🎴 ${tr('tools.drawBag')}</h2><p>${tr('tools.drawBagHelp')}</p></div></div>
        ${bag.items.length ? `<div class="tool-result"><strong>${lastBagItem ? escapeHtml(lastBagItem.label) : escapeHtml(tr('tools.drawBagReady'))}</strong><span>${tr('tools.drawBagRemaining', { remaining: bagRemaining, total: bag.items.length })}</span></div><div class="split-actions"><button class="primary-action small" type="button" data-action="draw-bag" ${bagRemaining ? '' : 'disabled'}>${tr('tools.drawBagDraw')}</button><button class="text-btn large" type="button" data-action="reset-draw-bag">${tr('tools.drawBagReset')}</button></div>` : `<p class="empty-state">${tr('tools.drawBagEmpty')}</p>`}
        <details class="collapsible" ${bag.items.length ? '' : 'open'}><summary>${tr('tools.drawBagEdit')} · ${bag.items.length}</summary><div class="collapsible-body"><label><span class="label-text">${tr('tools.drawBagList')}</span><textarea rows="5" maxlength="7000" data-draw-bag-list placeholder="${escapeAttr(tr('tools.drawBagPlaceholder'))}">${escapeHtml(bag.items.map(item => item.label).join('\n'))}</textarea></label><button class="text-btn large" type="button" data-action="save-draw-bag">${tr('tools.drawBagSave')}</button></div></details>
      </section>
      <section class="panel tool-card"><div class="section-head"><div><h2>👆 ${tr('tools.first')}</h2><p>${tr('tools.firstHelp')}</p></div></div>
        ${first ? `<div class="tool-result"><strong>${tr('tools.firstResult', { name: displayPlayer(first) })}</strong><button class="text-btn" type="button" data-action="set-first-active">${tr('tools.setActive')}</button></div>` : ''}
        <button class="primary-action small" type="button" data-action="choose-first">${first ? tr('action.reroll') : tr('action.start')}</button>
      </section>
      <section class="panel tool-card"><div class="section-head"><div><h2>🔀 ${tr('tools.order')}</h2><p>${tr('tools.orderHelp')}</p></div></div>
        ${shuffled.length ? `<ol class="order-preview">${shuffled.map(player => `<li>${escapeHtml(displayPlayer(player))}</li>`).join('')}</ol><div class="split-actions"><button class="text-btn large" type="button" data-action="shuffle-order">${tr('action.reroll')}</button><button class="primary-action small" type="button" data-action="apply-order">${tr('action.apply')}</button></div>` : `<button class="primary-action small" type="button" data-action="shuffle-order">${tr('tools.shuffle')}</button>`}
      </section>
      <section class="panel tool-card"><div class="section-head"><div><h2>👥 ${tr('tools.teams')}</h2><p>${tr('tools.teamsHelp')}</p></div></div>
        ${state.players.length < 2 ? `<p class="empty-state">${tr('tools.needPlayers')}</p>` : `<label class="team-count"><span>${tr('tools.teamCount')}</span><select data-team-count>${Array.from({ length: Math.min(3, state.players.length - 1) }, (_, index) => index + 2).map(value => `<option value="${value}" ${teamCount === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
          ${state.tools.teams.length ? `<div class="team-results">${state.tools.teams.map(team => `<article><strong>${tr('tools.teamName', { index: team.index + 1 })}</strong><span>${team.playerIds.map(id => displayPlayer(state.players.find(player => player.id === id))).join(' · ')}</span></article>`).join('')}</div>` : ''}
          <button class="primary-action small" type="button" data-action="make-teams">${state.tools.teams.length ? tr('action.reroll') : tr('tools.makeTeams')}</button>`}
      </section>
    </div>
    <section class="panel"><div class="section-head"><div><h2>${tr('tools.history')}</h2></div></div><div class="history-list">${state.tools.history.slice().reverse().map(item => `<div><span>${escapeHtml(toolHistoryText(item))}</span><time>${formatDateTime(state.locale, item.at)}</time></div>`).join('') || `<p class="empty-state">${tr('tools.noHistory')}</p>`}</div></section>`;
}

function toolHistoryText(item) {
  if (item.type === 'dice') return tr('tools.historyDice', { count: item.count, sides: item.sides, modifier: item.modifier ? signedNumber(item.modifier) : '', total: item.total });
  if (item.type === 'coin') return tr('tools.historyCoin', { result: tr(`tools.${item.result}`) });
  if (item.type === 'first') return tr('tools.historyFirst', { name: toolPlayerName(item.playerId) });
  if (item.type === 'order') return tr('tools.historyOrder', { names: (item.playerIds || []).map(toolPlayerName).join(' → ') });
  if (item.type === 'teams') return tr('tools.historyTeams', { count: item.count });
  if (item.type === 'bag') return tr('tools.historyBag', { label: item.label || '—' });
  return '';
}

function toolPlayerName(id) {
  const player = state.players.find(item => item.id === id);
  return player ? displayPlayer(player) : tr('common.removedPlayer');
}

function renderRandomResult() {
  if (!lastRandomResult) return `<span>${tr('tools.noResult')}</span>`;
  if (lastRandomResult.kind === 'coin') {
    return `<strong>${tr(`tools.${lastRandomResult.result}`)}</strong><span>${tr('tools.flip')}</span>`;
  }
  const rolls = lastRandomResult.rolls.join(' + ');
  const modifier = lastRandomResult.modifier ? ` ${signedNumber(lastRandomResult.modifier)}` : '';
  return `<strong>${lastRandomResult.total}</strong><span>${rolls}${modifier}</span>`;
}

function timerProgressPercent(currentState) {
  const remaining = currentTimerSeconds(currentState);
  const total = Math.max(1, currentState.timer.baseSeconds);
  return Math.round(Math.max(0, Math.min(100, (remaining / total) * 100)));
}

function renderSummary() {
  const finished = state.session.status === 'finished';
  return `
    <section class="panel summary-panel">
      <div class="section-head"><div><h2>${tr('summary.title')}</h2><p>${tr('summary.subtitle')}</p></div>
        <span class="head-actions">
          <button class="text-btn" type="button" data-action="share-summary">${tr('action.share')}</button>
          <button class="text-btn" type="button" data-action="copy-summary">${tr('action.copy')}</button>
        </span></div>
      <div class="summary-status ${finished ? 'finished' : ''}">${finished ? tr('summary.finished', { time: formatDateTime(state.locale, state.session.finishedAt) }) : tr('summary.live')}</div>
      <div class="result-list">${rankedPlayers(state).map(({ player, rank, score }, index, list) => {
        const tied = list.filter(item => item.score === score).length > 1;
        return `<article class="result-card" style="--player:${player.color}"><div class="rank">${rank}</div><div><h3>${escapeHtml(displayPlayer(player))}</h3><p>${state.score.fields.map(field => `${field.effect === -1 ? '−' : ''}${escapeHtml(displayField(field))} ${player.scoreBreakdown?.[field.id] || 0}`).join(' · ')}</p><small>${tr(tied ? 'summary.tieRank' : 'summary.rank', { rank })}</small></div><strong>${tr('summary.total', { score })}</strong></article>`;
      }).join('')}</div>
      <div class="summary-actions">${finished
        ? `<button class="text-btn large" type="button" data-action="resume-session">${tr('action.resumeSession')}</button><button class="primary-action small" type="button" data-action="new-session">${tr('action.newSession')}</button>`
        : `<button class="primary-action" type="button" data-action="finish-session">${tr('action.finishSession')}</button>`}</div>
    </section>
    ${renderArchive()}`;
}

function renderArchive() {
  const games = archivedGames;
  return `
    <section class="panel archive-panel">
      <div class="section-head"><div><h2>${tr('archive.title')}</h2><p>${tr('archive.subtitle')}</p></div>
        ${games.length ? `<button class="text-btn danger-soft" type="button" data-action="clear-archive">${tr('action.remove')}</button>` : ''}</div>
      <div class="archive-list">
        ${games.map(game => `
          <details class="archive-item">
            <summary><strong>${escapeHtml(game.name)}</strong><span>${formatDateTime(state.locale, game.finishedAt)} · ${tr('timer.roundLabel', { round: game.roundCount })}</span></summary>
            <ol class="archive-ranking">${game.players.map(player => `<li style="--player:${player.color}"><span>${escapeHtml(player.name || tr('common.removedPlayer'))}</span><strong>${player.score}</strong></li>`).join('')}</ol>
            ${renderTableOsArchive(game.tableOs)}
            <div class="archive-actions">
              <button class="text-btn small" type="button" data-rematch-archive="${game.id}">${tr('archive.rematch')}</button>
              <button class="text-btn small" type="button" data-archive-copy="${game.id}">${tr('action.copy')}</button>
              <button class="text-btn danger-soft" type="button" data-archive-delete="${game.id}">${tr('action.remove')}</button>
            </div>
          </details>`).join('') || `<p class="empty-state">${tr('archive.empty')}</p>`}
      </div>
    </section>`;
}

function renderTableOsArchive(summary) {
  if (!summary) return '';
  const details = [];
  if (summary.phaseName) details.push(tr('archive.tableOsPhase', { phase: summary.phaseName, cycle: summary.phaseCycle }));
  if (summary.campaign) {
    const name = summary.campaign.name || tr('archive.tableOsCampaignFallback');
    const chapter = summary.campaign.chapter ? ` · ${summary.campaign.chapter}` : '';
    details.push(tr('archive.tableOsCampaign', { name, chapter, session: summary.campaign.sessionNumber }));
  }
  return `<div class="archive-tableos"><strong>${tr('archive.tableOs')}</strong>${details.length ? `<p class="inline-note">${details.map(escapeHtml).join(' · ')}</p>` : ''}${summary.scores.length ? `<p class="inline-note">${tr('archive.tableOsScores')}</p><ol class="archive-ranking">${summary.scores.map(score => `<li style="--player:${score.color}"><span>${escapeHtml(score.name)}</span><strong>${score.total}</strong></li>`).join('')}</ol>` : ''}</div>`;
}

function tableOsArchiveLines(summary) {
  if (!summary) return [];
  const lines = [tr('archive.tableOs')];
  if (summary.phaseName) lines.push(tr('archive.tableOsPhase', { phase: summary.phaseName, cycle: summary.phaseCycle }));
  if (summary.campaign) {
    const name = summary.campaign.name || tr('archive.tableOsCampaignFallback');
    const chapter = summary.campaign.chapter ? ` · ${summary.campaign.chapter}` : '';
    lines.push(tr('archive.tableOsCampaign', { name, chapter, session: summary.campaign.sessionNumber }));
  }
  if (summary.scores.length) {
    lines.push(tr('archive.tableOsScores'));
    summary.scores.forEach(score => lines.push(`${score.name}: ${score.total}`));
  }
  return lines;
}

function renderSettings() {
  if (!settingsOpen) return '';
  const permissionKey = state.settings.notificationPermission === 'granted' ? 'settings.notificationGranted' : state.settings.notificationPermission === 'denied' ? 'settings.notificationDenied' : 'settings.notificationPrompt';
  return `<div class="modal-backdrop" data-action="close-settings"><section class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div class="section-head"><div><p class="eyebrow">${tr('app.eyebrow')}</p><h2 id="settings-title">${tr('settings.title')}</h2></div><button class="icon-btn" type="button" data-action="close-settings" aria-label="${tr('action.close')}">×</button></div>
    <label class="setting-row"><span><strong>${tr('settings.language')}</strong><small>中文 / English</small></span><button class="text-btn" type="button" data-action="lang">${state.locale === 'zh' ? 'English' : '中文'}</button></label>
    <label class="setting-row"><span><strong>${tr('settings.sound')}</strong></span><input type="checkbox" data-setting-sound ${state.settings.soundOn ? 'checked' : ''}></label>
    <label class="setting-row"><span><strong>${tr('settings.keepScreenOn')}</strong><small>${tr('settings.keepScreenOnHelp')}</small></span><input type="checkbox" data-setting-keepawake ${state.settings.keepScreenOn ? 'checked' : ''}></label>
    <label class="setting-row"><span><strong>${tr('settings.notifications')}</strong><small>${tr(permissionKey)}</small></span><input type="checkbox" data-background-alerts ${state.settings.backgroundAlerts ? 'checked' : ''}></label>
    <p class="privacy-note">${notificationDisclosure()}</p>
    <button class="text-btn large" type="button" data-action="privacy">${tr('settings.privacy')}</button>
    ${state.screen === 'workspace' && state.session.status === 'active' ? `<button class="text-btn large danger-soft" type="button" data-action="back-setup">${tr('action.back')}</button>` : ''}
  </section></div>`;
}

function timerModeOptions() {
  return ['turn', 'chess', 'pool', 'round'].map(mode => `<option value="${mode}" ${state.timer.mode === mode ? 'selected' : ''}>${tr(`timer.${mode}`)}</option>`).join('');
}

// Renders triggered by `change` events must not run synchronously: the change
// fires during mousedown (when focus leaves a field), and swapping the DOM
// before mouseup would detach the button being pressed and swallow the tap.
// Coalescing into the next tick lets the interaction finish first.
let renderQueued = false;
function rerenderSoon() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => { renderQueued = false; render(); }, 0);
}

// Events are delegated to the persistent #app shell once, instead of rebinding
// to freshly rendered elements on every render.
function bindAppEvents(root) {
  root.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target.closest('[data-action],[data-tab],[data-template],[data-score-preset],[data-remove-player],[data-set-active],[data-score-delta],[data-score-field],[data-remove-field],[data-archive-copy],[data-archive-delete],[data-rematch-archive],[data-move-player],[data-color-picker],[data-player-color]') : null;
    if (!element) return;
    const data = element.dataset;
    if (data.action !== undefined) { handleAction(data.action, event); return; }
    if (data.tab !== undefined) { state.activeTool = data.tab; render(); return; }
    if (data.template !== undefined) { selectTemplate(data.template); return; }
    if (data.scorePreset !== undefined) { selectPreset(data.scorePreset); return; }
    if (data.removePlayer !== undefined) { removePlayerWithConfirm(data.removePlayer); return; }
    if (data.colorPicker !== undefined) {
      colorPickerPlayerId = colorPickerPlayerId === data.colorPicker ? null : data.colorPicker;
      render();
      return;
    }
    if (data.playerColor !== undefined) {
      const [playerId, color] = data.playerColor.split(':');
      setPlayerColor(state, playerId, color);
      colorPickerPlayerId = null;
      render();
      return;
    }
    if (data.movePlayer !== undefined) {
      const [playerId, direction] = data.movePlayer.split(':');
      movePlayer(state, playerId, direction);
      render();
      return;
    }
    if (data.rematchArchive !== undefined) { rematchFromArchive(data.rematchArchive); return; }
    if (data.setActive !== undefined) {
      if (state.session.status === 'finished') return;
      setActivePlayer(state, data.setActive);
      cancelTimerNotification();
      render();
      return;
    }
    if (data.scoreDelta !== undefined) {
      if (state.session.status === 'finished') return;
      const [playerId, delta] = data.scoreDelta.split(':');
      adjustScore(playerId, state.score.fields[0]?.id, Number(delta));
      return;
    }
    if (data.scoreField !== undefined) {
      if (state.session.status === 'finished') return;
      const [playerId, fieldId, delta] = data.scoreField.split(':');
      adjustScore(playerId, fieldId, Number(delta));
      return;
    }
    if (data.removeField !== undefined) { removeFieldWithConfirm(data.removeField); return; }
    if (data.archiveCopy !== undefined) { copyArchivedGame(data.archiveCopy); return; }
    if (data.archiveDelete !== undefined) {
      deleteArchiveEntry(data.archiveDelete);
      archivedGames = loadArchive();
      showToast('toast.saved');
      render();
    }
  });

  root.addEventListener('input', event => {
    const element = event.target;
    if (!(element instanceof Element)) return;
    if (element.dataset.playerName !== undefined) {
      const player = state.players.find(item => item.id === element.dataset.playerName);
      if (player) player.name = element.value;
      persist();
      return;
    }
    if (element.dataset.sessionName !== undefined) { state.session.name = element.value; persist(); }
  });

  root.addEventListener('focusin', event => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement)) return;
    if (element.type !== 'text' && element.type !== 'number' && element.type !== '') return;
    element.dataset.original = element.value;
    if (element.dataset.roundScore !== undefined && element.value === '0') element.value = '';
  });

  root.addEventListener('change', event => {
    const element = event.target;
    if (!(element instanceof Element)) return;
    const data = element.dataset;
    if (data.roundScore !== undefined) {
      const [round, playerId, fieldId] = data.roundScore.split(':');
      const changed = setRoundScore(state, Number(round), playerId, fieldId, Number(element.value || 0), { recordUndo: true });
      if (changed) addHistory('score.updatedRound', { round });
      rerenderSoon();
      return;
    }
    if (data.fieldName !== undefined) {
      const field = state.score.fields.find(item => item.id === data.fieldName);
      if (field) { field.customName = element.value.trim().slice(0, 20); field.nameKey = field.customName ? '' : field.nameKey; }
      rerenderSoon();
      return;
    }
    if (data.fieldStep !== undefined) {
      const field = state.score.fields.find(item => item.id === data.fieldStep);
      if (field) field.step = clamp(element.value, 1, 1000);
      rerenderSoon();
      return;
    }
    if (data.fieldEffect !== undefined) {
      const field = state.score.fields.find(item => item.id === data.fieldEffect);
      if (field) { field.effect = Number(element.value) === -1 ? -1 : 1; recalculateScores(state); }
      rerenderSoon();
      return;
    }
    if (data.setupField !== undefined) { updateSetupField(data.setupField, element.value); return; }
    if (data.duration !== undefined) { updateDuration(); return; }
    if (data.backgroundAlerts !== undefined) { toggleBackgroundAlerts(element.checked); return; }
    if (data.settingSound !== undefined) { state.settings.soundOn = element.checked; rerenderSoon(); return; }
    if (data.settingKeepawake !== undefined) { state.settings.keepScreenOn = element.checked; rerenderSoon(); return; }
    if (data.dice !== undefined) { diceConfig[data.dice] = Number(element.value); rerenderSoon(); return; }
    if (data.teamCount !== undefined) { teamCount = Number(element.value); rerenderSoon(); }
  });

  // Escape restores the value a text/number input had when it was focused.
  // Arrow keys move and activate tabs, per the WAI-ARIA tabs pattern.
  root.addEventListener('keydown', event => {
    const element = event.target;
    if (!(element instanceof Element)) return;
    if (event.key === 'Escape') {
      if (element instanceof HTMLInputElement && element.dataset.original !== undefined) {
        element.value = element.dataset.original;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
      }
      return;
    }
    if (element.dataset.tab === undefined) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const index = tabs.indexOf(element);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    state.activeTool = next.dataset.tab;
    render();
    document.querySelector(`[data-tab="${next.dataset.tab}"]`)?.focus({ preventScroll: true });
  });
}

async function handleAction(action, event) {
  if (action === 'lang') { state.locale = state.locale === 'zh' ? 'en' : 'zh'; await initializeNotifications(state.locale); await syncTimerNotification(); render(); }
  if (action === 'open-settings') { settingsOpen = true; state.settings.notificationPermission = await checkNotificationPermission(); render(); }
  if (action === 'close-settings') {
    // Only close when the tap hit a real control inside the sheet (the ×
    // button) or the backdrop itself — never when bubbling up from plain
    // sheet content, whose nearest [data-action] ancestor is the backdrop.
    const sheet = event?.target?.closest?.('.settings-sheet');
    if (sheet) {
      const trigger = event.target.closest('[data-action="close-settings"]');
      if (!trigger || !sheet.contains(trigger)) return;
    }
    closeSettingsFlow();
  }
  if (action === 'privacy') location.href = '/privacy.html';
  if (action === 'goto-flow') { state.activeTool = 'flow'; render(); }
  if (action === 'share-summary') await shareSummary();
  if (action === 'close-color-picker') { colorPickerPlayerId = null; render(); }
  if (action === 'back-setup') await backToSetupFlow();
  if (action === 'sound') { state.settings.soundOn = !state.settings.soundOn; render(); }
  if (action === 'add-player') { addPlayer(state); render(); }
  if (action === 'reset-all') resetAll();
  if (action === 'start-session') startSessionFlow();
  if (action === 'timer-toggle') await toggleTimerFlow();
  if (action === 'timer-minus') { adjustTimer(state, -30); await syncTimerNotification(); render(); }
  if (action === 'timer-plus') { adjustTimer(state, 30); await syncTimerNotification(); render(); }
  if (action === 'timer-reset') resetTimerFlow();
  if (action === 'finish-turn') finishTurnFlow();
  if (action === 'next-player') nextPlayerFlow();
  if (action === 'next-round') nextRoundFlow();
  if (action === 'record-round') recordRoundFlow();
  if (action === 'undo-score') { const change = undoScore(state); showToast(change ? 'score.undoDone' : 'score.nothingToUndo'); render(); }
  if (action === 'add-score-field') { addScoreField(state, tr('field.custom')); render(); }
  if (action === 'copy-summary') await copySummary();
  if (action === 'clear-archive') {
    if (!confirm(tr('archive.clearConfirm'))) return;
    clearArchive();
    archivedGames = loadArchive();
    showToast('toast.saved');
    render();
  }
  if (action === 'roll-dice') rollDiceFlow();
  if (action === 'flip-coin') flipCoinFlow();
  if (action === 'choose-first') chooseFirstFlow();
  if (action === 'set-first-active') { if (state.tools.lastFirstPlayerId) { setActivePlayer(state, state.tools.lastFirstPlayerId); state.activeTool = 'flow'; render(); } }
  if (action === 'shuffle-order') shuffleOrderFlow();
  if (action === 'apply-order') applyOrderFlow();
  if (action === 'make-teams') makeTeamsFlow();
  if (action === 'save-draw-bag') saveDrawBagFlow();
  if (action === 'draw-bag') drawBagFlow();
  if (action === 'reset-draw-bag') { resetDrawBag(state); render(); }
  if (action === 'finish-session') await finishSessionFlow();
  if (action === 'resume-session') resumeSessionFlow();
  if (action === 'new-session') newSessionFlow();
}

function closeSettingsFlow() {
  settingsOpen = false;
  render();
  queueMicrotask(() => document.querySelector('[data-action="open-settings"]')?.focus({ preventScroll: true }));
}

async function backToSetupFlow() {
  if (!confirm(tr('confirm.backSetup'))) return;
  pauseTimer(state);
  await cancelTimerNotification();
  settingsOpen = false;
  state.screen = 'setup';
  render();
}

function selectTemplate(id) {
  if (id === state.templateId) return;
  if (state.score.rounds.length && !confirm(tr('setup.destructiveTemplate'))) return;
  const names = state.players.map(player => ({ id: player.id, name: player.name, defaultNameIndex: player.defaultNameIndex, color: player.color }));
  applyTemplate(state, id, { clearScores: true });
  state.players.forEach((player, index) => Object.assign(player, names[index] || {}));
  render();
}

function selectPreset(id) {
  if (id === state.score.presetId) return;
  if (state.score.rounds.length && !confirm(tr('setup.destructiveTemplate'))) return;
  applyPreset(state, id, { clearScores: true });
  render();
}

function removePlayerWithConfirm(id) {
  const player = state.players.find(item => item.id === id);
  if (!player || !confirm(tr('confirm.removePlayer', { name: displayPlayer(player) }))) return;
  removePlayer(state, id);
  render();
}

function removeFieldWithConfirm(id) {
  const field = state.score.fields.find(item => item.id === id);
  if (!field || !confirm(tr('score.removeFieldConfirm', { field: displayField(field) }))) return;
  removeScoreField(state, id);
  render();
}

function resetAll() {
  if (!confirm(tr('setup.resetConfirm'))) return;
  cancelTimerNotification();
  const preferences = { ...state.settings };
  state = createDefaultState(state.locale);
  state.settings = preferences;
  render();
}

function updateSetupField(field, value) {
  if (field === 'timer-mode') {
    pauseTimer(state);
    state.timer.mode = value;
    state.timer.remainingSeconds = state.timer.baseSeconds;
    state.timer.sharedRemainingSeconds = state.timer.baseSeconds;
    state.players.forEach(player => { player.poolSeconds = state.timer.baseSeconds; });
  }
  if (field === 'score-target') state.score.target = clamp(value, 1, 999999);
  if (field === 'score-rule') state.score.rule = value === 'lowest' ? 'lowest' : 'highest';
  rerenderSoon();
}

function updateDuration() {
  const minutes = clamp(document.querySelector('[data-duration="minutes"]')?.value, 0, 1440);
  const seconds = clamp(document.querySelector('[data-duration="seconds"]')?.value, 0, 59);
  const total = clamp(minutes * 60 + seconds, 5, 86400);
  state.timer.baseSeconds = total;
  state.timer.remainingSeconds = total;
  state.timer.sharedRemainingSeconds = total;
  state.players.forEach(player => { player.poolSeconds = total; });
  rerenderSoon();
}

function startSessionFlow() {
  state.screen = 'workspace';
  state.activeTool = 'flow';
  state.session.status = 'active';
  state.session.startedAt ||= new Date().toISOString();
  state.timer.activePlayerId ||= state.players[0]?.id;
  ensureRound(state, state.timer.round);
  render();
}

async function toggleTimerFlow() {
  if (state.session.status === 'finished') { showToast('timer.finishedLocked'); render(); return; }
  if (state.timer.running) {
    pauseTimer(state);
    await cancelTimerNotification();
  } else {
    await ensureAlertPermission();
    if (startTimer(state)) await syncTimerNotification();
  }
  render();
}

function resetTimerFlow() {
  if (['pool', 'chess'].includes(state.timer.mode) && !confirm(tr('timer.resetConfirmPool'))) return;
  resetTimer(state);
  cancelTimerNotification();
  render();
}

function loadPhaseTimerFromTableOs(detail = {}) {
  const requested = Number(detail?.seconds);
  if (!Number.isFinite(requested) || requested <= 0) return false;
  const seconds = clamp(Math.round(requested), 5, 86400);
  if (state.session.status === 'finished') {
    showToast('timer.finishedLocked');
    render();
    return false;
  }
  if (state.timer.running && !confirm(tr('timer.phaseTimerReplaceRunning', { time: formatClock(seconds) }))) return false;

  pauseTimer(state);
  cancelTimerNotification();
  state.timer.mode = 'round';
  state.timer.baseSeconds = seconds;
  state.timer.remainingSeconds = seconds;
  state.timer.timeoutHandled = false;
  if (state.screen === 'workspace') state.activeTool = 'flow';
  showToast('timer.phaseTimerLoaded', { time: formatClock(seconds) });
  render();
  return true;
}

function saveDrawBagFlow() {
  const input = document.querySelector('[data-draw-bag-list]');
  const result = setDrawBagFromText(state, input instanceof HTMLTextAreaElement ? input.value : '');
  showToast('tools.drawBagSaved', { count: result.saved });
  render();
}

function drawBagFlow() {
  const item = drawFromBag(state);
  if (!item) return;
  addToolHistory(state, { type: 'bag', label: item.label });
  sFinish();
  render();
}

function finishTurnFlow() {
  if (state.session.status === 'finished') return;
  pauseTimer(state);
  cancelTimerNotification();
  const prior = activePlayer(state);
  sFinish();
  nextPlayer(state);
  addHistory('timer.finishedTurnLog', { round: state.timer.round, name: displayPlayer(prior) });
  render();
}

function nextPlayerFlow() {
  if (state.session.status === 'finished') return;
  nextPlayer(state);
  cancelTimerNotification();
  render();
}

function nextRoundFlow() {
  if (state.session.status === 'finished') return;
  const current = ensureRound(state, state.timer.round);
  addHistory('score.savedRound', { round: current.round, score: roundTotal(state, current) });
  nextRound(state);
  cancelTimerNotification();
  sRoundDone();
  render();
}

function recordRoundFlow() {
  const round = ensureRound(state, state.timer.round);
  round.updatedAt = new Date().toISOString();
  addHistory('score.savedRound', { round: round.round, score: roundTotal(state, round) });
  showToast('toast.saved');
  render();
}

function adjustScore(playerId, fieldId, delta) {
  const player = state.players.find(item => item.id === playerId);
  const field = state.score.fields.find(item => item.id === fieldId);
  if (!player || !field) return;
  const changed = addRoundScore(state, state.timer.round, playerId, fieldId, delta);
  if (changed) {
    addHistory('score.adjusted', { round: state.timer.round, name: displayPlayer(player), field: displayField(field), delta: signedNumber(delta) });
    sFinish();
  }
  render();
}

function rollDiceFlow() {
  const result = rollDice(diceConfig);
  lastRandomResult = { kind: 'dice', rolls: result.rolls, total: result.total, modifier: result.modifier };
  addToolHistory(state, { type: 'dice', ...result });
  sFinish();
  render();
}

function flipCoinFlow() {
  const result = flipCoin();
  lastRandomResult = { kind: 'coin', result };
  addToolHistory(state, { type: 'coin', result });
  sFinish();
  render();
}

function chooseFirstFlow() {
  const player = chooseFirstPlayer(state);
  if (player) addToolHistory(state, { type: 'first', playerId: player.id });
  sFinish();
  render();
}

function shuffleOrderFlow() {
  const ids = shufflePlayerOrder(state);
  addToolHistory(state, { type: 'order', playerIds: ids.slice() });
  render();
}

function applyOrderFlow() {
  if (!confirm(tr('tools.applyOrderConfirm'))) return;
  if (applyShuffledOrder(state)) showToast('toast.orderApplied');
  render();
}

function makeTeamsFlow() {
  const teams = makeTeams(state, teamCount);
  if (teams.length) addToolHistory(state, { type: 'teams', count: teams.length });
  render();
}

async function finishSessionFlow() {
  if (!confirm(tr('summary.finishConfirm'))) return;
  pauseTimer(state);
  await cancelTimerNotification();
  state.session.status = 'finished';
  state.session.finishedAt = new Date().toISOString();
  archivedGames = loadArchive();
  saveGameToArchive(buildArchiveEntry(state));
  archivedGames = loadArchive();
  sOver();
  showToast('toast.archived');
  render();
}

function buildArchiveEntry(currentState) {
  const ranked = rankedPlayers(currentState);
  // The session start time is a stable identity for this playthrough, so
  // finishing the same session again replaces its archive entry.
  const stamp = currentState.session.startedAt
    || currentState.session.finishedAt
    || new Date().toISOString();
  const stableId = `game_${String(stamp).replace(/[^0-9a-z]/gi, '')}`;
  return {
    id: stableId,
    name: sessionName(),
    locale: currentState.locale,
    templateId: currentState.templateId,
    rule: currentState.score.rule,
    target: currentState.score.target,
    roundCount: currentState.timer.round,
    startedAt: currentState.session.startedAt,
    finishedAt: currentState.session.finishedAt,
    tableOs: buildTableOsArchiveSummary(currentState),
    players: ranked.map(({ player, rank, score }) => ({
      name: displayPlayer(player),
      color: player.color,
      score,
      rank
    }))
  };
}

async function copyArchivedGame(id) {
  const game = archivedGames.find(item => item.id === id);
  if (!game) return;
  const lines = [
    `${game.name} · ${formatDateTime(game.locale, game.finishedAt)}`,
    ...game.players.map(player => `${player.rank}. ${player.name}: ${player.score}`),
    ...tableOsArchiveLines(game.tableOs)
  ];
  const copied = await copyText(lines.join('\n'));
  showToast(copied ? 'action.copied' : 'toast.copyFailed');
  render();
}

function resumeSessionFlow() {
  if (!confirm(tr('summary.resumeConfirm'))) return;
  state.session.status = 'active';
  state.session.finishedAt = null;
  state.activeTool = 'flow';
  render();
}

function newSessionFlow() {
  if (!confirm(tr('summary.newConfirm'))) return;
  cancelTimerNotification();
  lastRandomResult = null;
  archivedGames = loadArchive();
  prepareRematch(state);
  render();
}

function buildSummaryText() {
  return [
    tr('summary.copyTitle', { name: sessionName(), round: state.timer.round }),
    tr(`template.${state.templateId}.name`),
    ...rankedPlayers(state).map(({ player, rank, score }) => `${rank}. ${displayPlayer(player)}: ${score} ${tr('common.points')}`)
  ].join('\n');
}

async function copySummary() {
  const copied = await copyText(buildSummaryText());
  showToast(copied ? 'action.copied' : 'toast.copyFailed');
  render();
}

async function shareSummary() {
  const result = await shareText(buildSummaryText());
  if (result === 'shared') { showToast('action.shared'); render(); return; }
  if (result === 'cancelled') return;
  // Share sheet unavailable (desktop browsers, some WebViews): fall back.
  const copied = await copyText(buildSummaryText());
  showToast(copied ? 'action.copied' : 'toast.copyFailed');
  render();
}

function rematchFromArchive(id) {
  const entry = archivedGames.find(game => game.id === id);
  if (!entry) return;
  if (!confirm(tr('archive.rematchConfirm', { name: entry.name }))) return;
  applyArchivedSetup(entry);
}

function applyArchivedSetup(entry) {
  cancelTimerNotification();
  lastRandomResult = null;
  const template = templateById(entry.templateId);
  state.templateId = template.id;
  state.session.name = entry.name || '';
  state.score.rule = entry.rule === 'lowest' ? 'lowest' : 'highest';
  state.score.target = entry.target > 0 ? entry.target : 20;
  if (entry.fields.length) {
    state.score.fields = entry.fields.map(field => ({
      id: field.id, nameKey: field.nameKey, customName: field.customName, step: field.step, effect: field.effect
    }));
  }
  if (entry.players.length) {
    state.players = entry.players.map((player, index) => ({
      id: uid('p_'),
      name: player.name,
      defaultNameIndex: index + 1,
      color: /^#[0-9a-f]{6}$/i.test(player.color) ? player.color : PLAYER_COLORS[index % PLAYER_COLORS.length],
      poolSeconds: 0,
      score: 0,
      scoreBreakdown: {}
    }));
  }
  if (entry.timerMode) state.timer.mode = entry.timerMode;
  state.timer.baseSeconds = entry.baseSeconds || template.seconds;
  prepareRematch(state);
  colorPickerPlayerId = null;
  archivedGames = loadArchive();
  render();
}

async function toggleBackgroundAlerts(enabled) {
  state.settings.backgroundAlerts = enabled;
  if (enabled) await ensureAlertPermission();
  else await cancelTimerNotification();
  rerenderSoon();
}

async function ensureAlertPermission() {
  if (!state.settings.backgroundAlerts) return false;
  let permission = await checkNotificationPermission();
  if (permission === 'prompt') {
    if (!confirm(notificationDisclosure())) {
      state.settings.backgroundAlerts = false;
      return false;
    }
    permission = await requestNotificationPermission();
  }
  state.settings.notificationPermission = permission;
  if (permission !== 'granted') {
    showToast('toast.permissionDenied');
    return false;
  }
  return true;
}

async function syncTimerNotification() {
  await cancelTimerNotification();
  if (!state.timer.running || !state.timer.deadlineMs || !state.settings.backgroundAlerts || state.settings.notificationPermission !== 'granted') return false;
  const name = displayPlayer(activePlayer(state)) || tr('timer.round');
  return scheduleTimerNotification({
    deadlineMs: state.timer.deadlineMs,
    title: tr('timer.notificationTitle'),
    body: tr('timer.notificationBody', { name }),
    locale: state.locale
  });
}

function applyKeepAwake() {
  const desired = state.settings.keepScreenOn
    && state.screen === 'workspace'
    && state.session.status !== 'finished'
    && state.timer.running;
  setKeepScreenOn(desired);
}

function updateTimerView() {
  updateRunningBadge();
  const display = document.getElementById('timerDisplay');
  if (!display) return;
  const remaining = currentTimerSeconds(state);
  display.textContent = formatClock(remaining);
  const fill = document.getElementById('timerProgressFill');
  if (fill) fill.style.width = `${timerProgressPercent(state)}%`;
  const stage = display.closest('.timer-stage');
  stage?.classList.toggle('is-warning', state.timer.running && remaining > 10 && remaining <= 30);
  stage?.classList.toggle('is-danger', state.timer.running && remaining <= 10);
  if (state.timer.running) document.title = `${formatClock(remaining)} · ${tr('app.title')}`;
}

function updateRunningBadge() {
  const badge = document.getElementById('runningBadge');
  if (!badge || !state.timer.running) return;
  const remaining = currentTimerSeconds(state);
  badge.querySelector('#runningBadgeTime').textContent = formatClock(remaining);
  badge.classList.toggle('danger', remaining <= 10);
  badge.setAttribute('aria-label', tr('a11y.runningBadge', { time: formatClock(remaining) }));
}

function tick() {
  if (!state.timer.running) return;
  const result = reconcileTimer(state);
  const remaining = result.remaining;
  if (remaining !== lastAnnouncedSecond) {
    lastAnnouncedSecond = remaining;
    if (remaining === 10) sWarn();
    if (remaining > 0 && remaining <= 10) { sTick(); speakNumber(remaining); }
  }
  if (result.expired && !state.timer.timeoutHandled) {
    state.timer.timeoutHandled = true;
    const name = displayPlayer(activePlayer(state));
    if (document.visibilityState === 'visible') sElim();
    addHistory('timer.timeout', { name });
    cancelTimerNotification();
    showToast('timer.timeout', { name });
    render();
    return;
  }
  persist();
  updateTimerView();
}

function reconcileAfterResume() {
  const wasRunning = state.timer.running;
  const result = reconcileTimer(state);
  if (wasRunning && result.expired && !state.timer.timeoutHandled) {
    state.timer.timeoutHandled = true;
    addHistory('timer.timeout', { name: displayPlayer(activePlayer(state)) });
    sElim();
    showToast('timer.expiredWhileAway');
  }
  render();
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

document.addEventListener('keydown', event => {
  if (!settingsOpen) return;
  if (event.key === 'Escape') { closeSettingsFlow(); return; }
  if (event.key !== 'Tab') return;
  const sheet = document.querySelector('.settings-sheet');
  if (!sheet) return;
  const focusables = [...sheet.querySelectorAll('button, input, select, [href]')].filter(element => !element.disabled);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !sheet.contains(active))) { event.preventDefault(); last.focus({ preventScroll: true }); }
  else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
});

document.addEventListener('boardgame-helper:phase-timer', event => {
  const detail = event instanceof CustomEvent ? event.detail : {};
  if (!loadPhaseTimerFromTableOs(detail)) event.preventDefault();
});

setSoundOn(state.settings.soundOn);
setAudioLocale(state.locale);
bindAppEvents(document.getElementById('app'));
initializeNotifications(state.locale);
checkNotificationPermission().then(permission => { state.settings.notificationPermission = permission; persist(); });
observeAppState(active => { if (active) reconcileAfterResume(); else persist(); });
setInterval(tick, 250);
render();

if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
