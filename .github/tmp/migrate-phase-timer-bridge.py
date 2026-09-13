from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new, label):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    write(path, text.replace(old, new, 1))


def append_once(path, marker, content):
    text = read(path)
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + content)


# Table OS model: optional structural phase timer duration, no live main-timer state.
replace_once('src/tabletop-core.js',
             'export const TABLE_OS_SCHEMA_VERSION = 5;',
             'export const TABLE_OS_SCHEMA_VERSION = 6;',
             'schema version')
replace_once('src/tabletop-core.js',
             'export const USER_TEMPLATE_VERSION = 4;',
             'export const USER_TEMPLATE_VERSION = 5;',
             'user template version')
replace_once('src/tabletop-core.js',
             "        note: text(phase?.note, 120),\n        checklist: normalizePhaseChecklist(phase?.checklist)",
             "        note: text(phase?.note, 120),\n        timerSeconds: integer(phase?.timerSeconds, 0, 0, 86400),\n        checklist: normalizePhaseChecklist(phase?.checklist)",
             'normalize phase timer')
replace_once('src/tabletop-core.js',
             "  const phase = { id: uid('phase_'), name: text(name || `Phase ${state.phases.items.length + 1}`, 32), note: '', checklist: [] };",
             "  const phase = { id: uid('phase_'), name: text(name || `Phase ${state.phases.items.length + 1}`, 32), note: '', timerSeconds: 0, checklist: [] };",
             'add phase timer default')
replace_once('src/tabletop-core.js',
             "export function setPhaseChecklistFromText(state, phaseId, input = '') {",
             "export function setPhaseTimerSeconds(state, phaseId, seconds = 0) {\n  const phase = state.phases.items.find(item => item.id === phaseId);\n  if (!phase) return false;\n  const next = integer(seconds, 0, 0, 86400);\n  if (phase.timerSeconds === next) return false;\n  phase.timerSeconds = next;\n  touch(state);\n  return true;\n}\n\nexport function setPhaseChecklistFromText(state, phaseId, input = '') {",
             'phase timer setter')
replace_once('src/tabletop-core.js',
             "      note: text(phase?.note, 120),\n      checklist: (Array.isArray(phase?.checklist) ? phase.checklist : []).slice(0, MAX_PHASE_CHECKLIST_ITEMS).map((item, itemIndex) => ({",
             "      note: text(phase?.note, 120),\n      timerSeconds: integer(phase?.timerSeconds, 0, 0, 86400),\n      checklist: (Array.isArray(phase?.checklist) ? phase.checklist : []).slice(0, MAX_PHASE_CHECKLIST_ITEMS).map((item, itemIndex) => ({",
             'user template phase timer')
replace_once('src/tabletop-core.js',
             "    name: phase.name,\n    note: phase.note,\n    checklist: phase.checklist.map(item => ({ id: uid('phase_item_'), label: item.label, done: false }))",
             "    name: phase.name,\n    note: phase.note,\n    timerSeconds: phase.timerSeconds,\n    checklist: phase.checklist.map(item => ({ id: uid('phase_item_'), label: item.label, done: false }))",
             'apply user template phase timer')
replace_once('src/tabletop-core.js',
             "    name: translated?.phases?.[index] || name,\n    note: '',\n    checklist: []",
             "    name: translated?.phases?.[index] || name,\n    note: '',\n    timerSeconds: 0,\n    checklist: []",
             'built in phase timer default')

# Table OS UI: configure an optional duration and explicitly request the main timer.
replace_once('src/tabletop.js',
             '  addPhase, removePhase, setActivePhase, advancePhase, setPhaseChecklistFromText, togglePhaseChecklistItem,',
             '  addPhase, removePhase, setActivePhase, advancePhase, setPhaseTimerSeconds, setPhaseChecklistFromText, togglePhaseChecklistItem,',
             'tabletop phase timer import')
replace_once('src/tabletop.js',
             "    addPhase: '添加阶段', cycle: '循环', previous: '上一步', next: '下一步', noPhases: '当前没有阶段。', phaseNote: '备注', openTimer: '去主计时器', phaseChecklist: '阶段清单', phaseChecklistHelp: '每行一项；牌局模式可直接勾选。跨 cycle 或开始新场景时自动清空完成状态。', phaseChecklistPlaceholder: '执行阶段能力\\n补充公共资源',",
             "    addPhase: '添加阶段', cycle: '循环', previous: '上一步', next: '下一步', noPhases: '当前没有阶段。', phaseNote: '备注', openTimer: '去主计时器', phaseTimerSeconds: '阶段计时（秒）', phaseTimerHelp: '0 表示不配置。只有点击“载入主计时器”才会生效；切换阶段不会自动覆盖计时。', loadPhaseTimer: '载入主计时器', phaseChecklist: '阶段清单', phaseChecklistHelp: '每行一项；牌局模式可直接勾选。跨 cycle 或开始新场景时自动清空完成状态。', phaseChecklistPlaceholder: '执行阶段能力\\n补充公共资源',",
             'zh phase timer i18n')
replace_once('src/tabletop.js',
             "    addPhase: 'Add phase', cycle: 'Cycle', previous: 'Previous', next: 'Next', noPhases: 'No phases yet.', phaseNote: 'Note', openTimer: 'Open main timer', phaseChecklist: 'Phase checklist', phaseChecklistHelp: 'One item per line. Toggle items during play; completion resets when the cycle changes or a new scenario starts.', phaseChecklistPlaceholder: 'Resolve phase ability\\nRefill shared supply',",
             "    addPhase: 'Add phase', cycle: 'Cycle', previous: 'Previous', next: 'Next', noPhases: 'No phases yet.', phaseNote: 'Note', openTimer: 'Open main timer', phaseTimerSeconds: 'Phase timer (sec)', phaseTimerHelp: 'Use 0 for none. It only changes the main timer when you tap “Load main timer”; phase changes never overwrite timing automatically.', loadPhaseTimer: 'Load main timer', phaseChecklist: 'Phase checklist', phaseChecklistHelp: 'One item per line. Toggle items during play; completion resets when the cycle changes or a new scenario starts.', phaseChecklistPlaceholder: 'Resolve phase ability\\nRefill shared supply',",
             'en phase timer i18n')
replace_once('src/tabletop.js',
             'function renderPhaseChecklist(phase) {',
             "function formatPhaseTimer(totalSeconds) {\n  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));\n  const hours = Math.floor(safe / 3600);\n  const minutes = Math.floor((safe % 3600) / 60);\n  const seconds = safe % 60;\n  return hours > 0\n    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`\n    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;\n}\n\nfunction renderPhaseChecklist(phase) {",
             'phase timer formatter')
replace_once('src/tabletop.js',
             '<input value="${attr(phase.note)}" data-os-phase-note="${phase.id}" maxlength="120" placeholder="${attr(tr(\'phaseNote\'))}"><details class="tableos-phase-checklist-editor">',
             '<input value="${attr(phase.note)}" data-os-phase-note="${phase.id}" maxlength="120" placeholder="${attr(tr(\'phaseNote\'))}"><label class="tableos-phase-timer-field"><span>${esc(tr(\'phaseTimerSeconds\'))}<small>${esc(tr(\'phaseTimerHelp\'))}</small></span><input type="number" min="0" max="86400" value="${phase.timerSeconds || \'\'}" data-os-phase-timer-seconds="${phase.id}" placeholder="0"></label><details class="tableos-phase-checklist-editor">',
             'phase timer edit field')
replace_once('src/tabletop.js',
             "${index === state.phases.activeIndex ? renderPhaseChecklist(phase) : ''}</div></article>",
             "${index === state.phases.activeIndex ? renderPhaseChecklist(phase) : ''}${index === state.phases.activeIndex && phase.timerSeconds ? `<button type=\"button\" class=\"tableos-btn primary\" data-os-phase-timer=\"${phase.id}\">${esc(tr('loadPhaseTimer'))} · ${esc(formatPhaseTimer(phase.timerSeconds))}</button>` : ''}</div></article>",
             'phase timer play action')
replace_once('src/tabletop.js',
             '[data-os-phase-active],[data-os-phase-check],[data-os-remove-phase]',
             '[data-os-phase-active],[data-os-phase-check],[data-os-phase-timer],[data-os-remove-phase]',
             'phase timer delegated selector')
replace_once('src/tabletop.js',
             "    if (d.osPhaseCheck) { const [phaseId, itemId] = d.osPhaseCheck.split('|'); togglePhaseChecklistItem(state, phaseId, itemId); persist(); render(); return; }\n    if (d.osRemovePhase)",
             "    if (d.osPhaseCheck) { const [phaseId, itemId] = d.osPhaseCheck.split('|'); togglePhaseChecklistItem(state, phaseId, itemId); persist(); render(); return; }\n    if (d.osPhaseTimer) {\n      const phase = state.phases.items.find(item => item.id === d.osPhaseTimer);\n      if (!phase?.timerSeconds) return;\n      const accepted = document.dispatchEvent(new CustomEvent('boardgame-helper:phase-timer', {\n        cancelable: true,\n        detail: { seconds: phase.timerSeconds, phaseName: phase.name }\n      }));\n      if (!accepted) return;\n      isOpen = false;\n      render();\n      return;\n    }\n    if (d.osRemovePhase)",
             'phase timer click bridge')
replace_once('src/tabletop.js',
             "    if (d.osPhaseNote) { const phase = state.phases.items.find(item => item.id === d.osPhaseNote); if (phase) phase.note = element.value.trim().slice(0, 120); persist(); return; }\n    if (d.osPhaseChecklist)",
             "    if (d.osPhaseNote) { const phase = state.phases.items.find(item => item.id === d.osPhaseNote); if (phase) phase.note = element.value.trim().slice(0, 120); persist(); return; }\n    if (d.osPhaseTimerSeconds !== undefined) { setPhaseTimerSeconds(state, d.osPhaseTimerSeconds, element.value); persist(); render(); return; }\n    if (d.osPhaseChecklist)",
             'phase timer change handler')

append_once('src/tabletop.css', '.tableos-phase-timer-field {', "\n.tableos-phase-timer-field {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: .75rem;\n  margin-top: .5rem;\n}\n.tableos-phase-timer-field > span {\n  display: grid;\n  gap: .15rem;\n}\n.tableos-phase-timer-field small {\n  color: var(--tableos-muted);\n  font-weight: 400;\n}\n.tableos-phase-timer-field input {\n  width: 7rem;\n  flex: 0 0 auto;\n}\n")

# Main timer bridge: explicit, cancelable, never auto-starts, and preserves pool/chess stored values.
replace_once('src/i18n.js',
             "    'timer.expiredWhileAway': '计时已在后台结束', 'timer.resetConfirmPool': '重置当前时间池到默认时长？',\n    'timer.finishedLocked': '本局已结束，恢复本局后才能继续计时。',",
             "    'timer.expiredWhileAway': '计时已在后台结束', 'timer.resetConfirmPool': '重置当前时间池到默认时长？',\n    'timer.phaseTimerReplaceRunning': '主计时器正在运行。载入阶段计时 {time} 会停止并替换当前倒计时，继续吗？',\n    'timer.phaseTimerLoaded': '已载入阶段计时 {time}，尚未开始。',\n    'timer.finishedLocked': '本局已结束，恢复本局后才能继续计时。',",
             'zh main timer bridge i18n')
replace_once('src/i18n.js',
             "    'timer.expiredWhileAway': 'The timer ended while the app was in the background', 'timer.resetConfirmPool': 'Reset this time pool to its default duration?',\n    'timer.finishedLocked': 'This game is finished. Resume it to continue timing.',",
             "    'timer.expiredWhileAway': 'The timer ended while the app was in the background', 'timer.resetConfirmPool': 'Reset this time pool to its default duration?',\n    'timer.phaseTimerReplaceRunning': 'The main timer is running. Loading the {time} phase timer will stop and replace the current countdown. Continue?',\n    'timer.phaseTimerLoaded': 'Loaded a {time} phase timer. It has not started yet.',\n    'timer.finishedLocked': 'This game is finished. Resume it to continue timing.',",
             'en main timer bridge i18n')
replace_once('src/app.js',
             'function resetTimerFlow() {\n  if ([\'pool\', \'chess\'].includes(state.timer.mode) && !confirm(tr(\'timer.resetConfirmPool\'))) return;\n  resetTimer(state);\n  cancelTimerNotification();\n  render();\n}\n\nfunction finishTurnFlow()',
             "function resetTimerFlow() {\n  if (['pool', 'chess'].includes(state.timer.mode) && !confirm(tr('timer.resetConfirmPool'))) return;\n  resetTimer(state);\n  cancelTimerNotification();\n  render();\n}\n\nfunction loadPhaseTimerFromTableOs(detail = {}) {\n  const requested = Number(detail?.seconds);\n  if (!Number.isFinite(requested) || requested <= 0) return false;\n  const seconds = clamp(Math.round(requested), 5, 86400);\n  if (state.session.status === 'finished') {\n    showToast('timer.finishedLocked');\n    render();\n    return false;\n  }\n  if (state.timer.running && !confirm(tr('timer.phaseTimerReplaceRunning', { time: formatClock(seconds) }))) return false;\n\n  pauseTimer(state);\n  cancelTimerNotification();\n  state.timer.mode = 'round';\n  state.timer.baseSeconds = seconds;\n  state.timer.remainingSeconds = seconds;\n  state.timer.timeoutHandled = false;\n  if (state.screen === 'workspace') state.activeTool = 'flow';\n  showToast('timer.phaseTimerLoaded', { time: formatClock(seconds) });\n  render();\n  return true;\n}\n\nfunction finishTurnFlow()",
             'main phase timer loader')
replace_once('src/app.js',
             "setSoundOn(state.settings.soundOn);\nsetAudioLocale(state.locale);",
             "document.addEventListener('boardgame-helper:phase-timer', event => {\n  const detail = event instanceof CustomEvent ? event.detail : {};\n  if (!loadPhaseTimerFromTableOs(detail)) event.preventDefault();\n});\n\nsetSoundOn(state.settings.soundOn);\nsetAudioLocale(state.locale);",
             'main phase timer event listener')

# Focused unit coverage.
Path('tests/unit/tabletop-phase-timer.test.js').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState, normalizeTableOsState, addPhase, setPhaseTimerSeconds,
  resetTableOsSession, createUserTemplateFromState, applyUserTemplate
} from '../../src/tabletop-core.js';

test('phase timer duration is optional, bounded, and preserved by session reset', () => {
  const state = createDefaultTableOsState();
  const phase = addPhase(state, 'Action');
  assert.equal(phase.timerSeconds, 0);
  assert.equal(setPhaseTimerSeconds(state, phase.id, 75), true);
  assert.equal(phase.timerSeconds, 75);
  assert.equal(setPhaseTimerSeconds(state, phase.id, 999999), true);
  assert.equal(phase.timerSeconds, 86400);
  assert.equal(setPhaseTimerSeconds(state, phase.id, -5), true);
  assert.equal(phase.timerSeconds, 0);
  setPhaseTimerSeconds(state, phase.id, 90);
  resetTableOsSession(state);
  assert.equal(phase.timerSeconds, 90, 'new scenario preserves structural phase timer configuration');
});

test('normalization upgrades older phases and sanitizes timer duration', () => {
  const state = normalizeTableOsState({
    phases: { items: [
      { id: 'old', name: 'Old phase' },
      { id: 'timed', name: 'Timed phase', timerSeconds: 95 },
      { id: 'huge', name: 'Huge phase', timerSeconds: 999999 }
    ] }
  });
  assert.equal(state.schemaVersion, 6);
  assert.deepEqual(state.phases.items.map(phase => phase.timerSeconds), [0, 95, 86400]);
});

test('My Templates save phase timer structure but no live main-timer state', () => {
  const source = createDefaultTableOsState();
  const phase = addPhase(source, 'Resolve');
  setPhaseTimerSeconds(source, phase.id, 45);
  const saved = createUserTemplateFromState(source, 'Timed phases');
  assert.equal(saved.version, 5);
  assert.equal(saved.phases[0].timerSeconds, 45);
  assert.equal(JSON.stringify(saved).includes('deadlineMs'), false);
  assert.equal(JSON.stringify(saved).includes('remainingSeconds'), false);

  const target = createDefaultTableOsState();
  applyUserTemplate(target, saved);
  assert.equal(target.phases.items[0].timerSeconds, 45);
  assert.notEqual(target.phases.items[0].id, phase.id, 'template apply creates a fresh phase identity');
});
""")

replace_once('tests/unit/tabletop-phase-checklist.test.js',
             '  assert.equal(state.schemaVersion, 5);',
             '  assert.equal(state.schemaVersion, 6);',
             'phase checklist schema assertion')

# Chromium bridge regression including the running-timer cancellation boundary.
replace_once('tests/e2e/run-table-os-e2e.js',
             "  const promptResponses = [];\n  const confirmMessages = [];",
             "  const promptResponses = [];\n  const confirmMessages = [];\n  let dismissNextConfirm = false;",
             'e2e dialog flag')
replace_once('tests/e2e/run-table-os-e2e.js',
             "    else { confirmMessages.push(dialog.message()); await dialog.accept(); }",
             "    else {\n      confirmMessages.push(dialog.message());\n      if (dismissNextConfirm) { dismissNextConfirm = false; await dialog.dismiss(); }\n      else await dialog.accept();\n    }",
             'e2e dialog dismissal')
bridge_anchor = "  assert.equal(await page.locator('[data-os-phase-check]').first().getAttribute('aria-pressed'), 'false', 'wrapping to a new cycle resets checklist completion');\n\n"
bridge_block = """  assert.equal(await page.locator('[data-os-phase-check]').first().getAttribute('aria-pressed'), 'false', 'wrapping to a new cycle resets checklist completion');

  // Optional phase timers bridge explicitly into the main shared timer and never auto-start or auto-overwrite it.
  await editMode(page);
  await page.getByRole('button', { name: '阶段', exact: true }).click();
  const phaseTimerInput = page.locator('.tableos-phase.active [data-os-phase-timer-seconds]');
  await phaseTimerInput.fill('75');
  await phaseTimerInput.blur();
  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '阶段', exact: true }).click();
  assert.ok(await page.getByRole('button', { name: /载入主计时器 · 01:15/ }).isVisible(), 'configured active phase exposes an explicit timer load action');

  await page.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '开始桌游局' }).click();
  await page.locator('[data-action="timer-toggle"]').click();
  const runningBeforeBridge = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')));
  assert.equal(runningBeforeBridge.timer.running, true, 'main timer is running before bridge safety check');
  const preservedSharedPool = runningBeforeBridge.timer.sharedRemainingSeconds;
  const preservedPlayerPools = runningBeforeBridge.players.map(player => player.poolSeconds);

  await openTableOs(page);
  await page.getByRole('button', { name: '阶段', exact: true }).click();
  dismissNextConfirm = true;
  await page.getByRole('button', { name: /载入主计时器 · 01:15/ }).click();
  assert.ok(await tableDialog.isVisible(), 'canceling replacement keeps Table OS open');
  const afterCanceledBridge = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')));
  assert.equal(afterCanceledBridge.timer.running, true, 'canceling replacement leaves the running timer untouched');
  assert.equal(afterCanceledBridge.timer.mode, runningBeforeBridge.timer.mode, 'canceling replacement preserves the timer mode');
  assert.match(confirmMessages.at(-1), /主计时器正在运行/, 'running timer replacement is explicitly disclosed');

  await page.getByRole('button', { name: /载入主计时器 · 01:15/ }).click();
  assert.equal(await tableDialog.isVisible(), false, 'accepted phase timer load closes Table OS');
  const bridgedGame = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')));
  assert.equal(bridgedGame.timer.running, false, 'phase timer is prepared but never auto-started');
  assert.equal(bridgedGame.timer.mode, 'round', 'phase timer uses the shared round/discussion timer mode');
  assert.equal(bridgedGame.timer.baseSeconds, 75);
  assert.equal(bridgedGame.timer.remainingSeconds, 75);
  assert.equal(bridgedGame.timer.deadlineMs, null);
  assert.equal(bridgedGame.timer.sharedRemainingSeconds, preservedSharedPool, 'loading a phase timer does not erase a stored shared-pool value');
  assert.deepEqual(bridgedGame.players.map(player => player.poolSeconds), preservedPlayerPools, 'loading a phase timer does not erase personal chess-clock pools');
  assert.equal(await page.locator('#timerDisplay').textContent(), '01:15', 'main timer visibly receives the configured phase duration');

  await openTableOs(page);

"""
replace_once('tests/e2e/run-table-os-e2e.js', bridge_anchor, bridge_block, 'phase timer e2e bridge')

# Documentation and release-gate matrix.
append_once('TABLE_OS.md', '## Phase timer bridge', """
## Phase timer bridge

Each phase can optionally define a timer duration in seconds (`0` means no configured timer). Phase changes never mutate the main timer automatically. In Play mode, the active phase exposes **Load main timer** only when a duration is configured. Loading is explicit: it prepares the main app's shared `round` / discussion timer at that duration, leaves it paused, and preserves the stored shared-pool and personal chess-clock values. If the main timer is currently running, replacement requires confirmation; canceling leaves the timer and Table OS open unchanged.

My Templates store only the phase timer duration as reusable phase structure. They never store main-timer runtime state such as running/deadline/remaining values. New scenario / rematch preserves the configured phase durations.
""")
append_once('docs/TABLE_OS_TEST_MATRIX.md', 'Phase timer bridge |', """
| Phase timer bridge | Configure an active phase duration, verify Play mode exposes an explicit load action, start the main timer, cancel replacement and verify it remains untouched, then accept replacement and verify `round` mode is prepared at the phase duration without auto-starting or erasing pool/chess values | Chromium E2E + unit |
| Phase timer template/privacy boundary | Normalize old phase data to `timerSeconds: 0`; bound duration to 0–86400; save/apply My Template duration only; verify no main-timer runtime fields enter My Templates and new-scenario reset preserves phase timer structure | Unit |
""")

print('phase timer bridge migration applied')
