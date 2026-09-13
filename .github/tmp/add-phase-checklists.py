from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


core = 'src/tabletop-core.js'
replace_once(core,
"export const TABLE_OS_SCHEMA_VERSION = 4;\nexport const TABLE_OS_STORAGE_KEY = 'board-game-assistant-table-os-v1';\nexport const MAX_TABLE_OS_PARTICIPANTS = 32;\nexport const MAX_ENTITIES = 16;\nexport const MAX_TRACKERS = 24;\nexport const MAX_STATUSES = 24;\nexport const MAX_PHASES = 20;",
"export const TABLE_OS_SCHEMA_VERSION = 5;\nexport const TABLE_OS_STORAGE_KEY = 'board-game-assistant-table-os-v1';\nexport const MAX_TABLE_OS_PARTICIPANTS = 32;\nexport const MAX_ENTITIES = 16;\nexport const MAX_TRACKERS = 24;\nexport const MAX_STATUSES = 24;\nexport const MAX_PHASES = 20;\nexport const MAX_PHASE_CHECKLIST_ITEMS = 12;")
replace_once(core, "export const USER_TEMPLATE_VERSION = 3;", "export const USER_TEMPLATE_VERSION = 4;")

replace_once(core,
"function normalizePhases(value) {\n  const source = value && typeof value === 'object' ? value : {};",
"function normalizePhaseChecklist(value) {\n  if (!Array.isArray(value)) return [];\n  const used = new Set();\n  return value.slice(0, MAX_PHASE_CHECKLIST_ITEMS).map((item, index) => {\n    const source = typeof item === 'string' ? { label: item } : (item && typeof item === 'object' ? item : {});\n    let id = identifier(source.id, 'phase_item_');\n    while (used.has(id)) id = uid('phase_item_');\n    used.add(id);\n    return {\n      id,\n      label: text(source.label || `Item ${index + 1}`, 80),\n      done: Boolean(source.done)\n    };\n  });\n}\n\nfunction normalizePhases(value) {\n  const source = value && typeof value === 'object' ? value : {};")

replace_once(core,
"        name: text(phase?.name || `Phase ${index + 1}`, 32),\n        note: text(phase?.note, 120)\n      };",
"        name: text(phase?.name || `Phase ${index + 1}`, 32),\n        note: text(phase?.note, 120),\n        checklist: normalizePhaseChecklist(phase?.checklist)\n      };")

replace_once(core,
"export function addPhase(state, name = '') {\n  if (state.phases.items.length >= MAX_PHASES) return null;\n  const phase = { id: uid('phase_'), name: text(name || `Phase ${state.phases.items.length + 1}`, 32), note: '' };\n  state.phases.items.push(phase);\n  touch(state);\n  return phase;\n}",
"export function addPhase(state, name = '') {\n  if (state.phases.items.length >= MAX_PHASES) return null;\n  const phase = { id: uid('phase_'), name: text(name || `Phase ${state.phases.items.length + 1}`, 32), note: '', checklist: [] };\n  state.phases.items.push(phase);\n  touch(state);\n  return phase;\n}\n\nexport function setPhaseChecklistFromText(state, phaseId, input = '') {\n  const phase = state.phases.items.find(item => item.id === phaseId);\n  if (!phase) return { requested: 0, saved: 0, limitReached: false, changed: false };\n  const labels = String(input ?? '')\n    .split(/\\r?\\n/)\n    .map(item => text(item, 80))\n    .filter(Boolean);\n  const priorByLabel = new Map();\n  (phase.checklist || []).forEach(item => {\n    if (!priorByLabel.has(item.label)) priorByLabel.set(item.label, []);\n    priorByLabel.get(item.label).push(item);\n  });\n  const next = labels.slice(0, MAX_PHASE_CHECKLIST_ITEMS).map(label => {\n    const prior = priorByLabel.get(label)?.shift();\n    return prior ? { id: prior.id, label, done: Boolean(prior.done) } : { id: uid('phase_item_'), label, done: false };\n  });\n  const before = JSON.stringify((phase.checklist || []).map(item => [item.id, item.label, Boolean(item.done)]));\n  const after = JSON.stringify(next.map(item => [item.id, item.label, Boolean(item.done)]));\n  phase.checklist = next;\n  const changed = before !== after;\n  if (changed) touch(state);\n  return { requested: labels.length, saved: next.length, limitReached: labels.length > next.length, changed };\n}\n\nexport function togglePhaseChecklistItem(state, phaseId, itemId) {\n  const phase = state.phases.items.find(item => item.id === phaseId);\n  const item = phase?.checklist?.find(candidate => candidate.id === itemId);\n  if (!item) return false;\n  item.done = !item.done;\n  touch(state);\n  return true;\n}\n\nfunction resetPhaseChecklistProgress(state) {\n  state.phases.items.forEach(phase => {\n    (phase.checklist || []).forEach(item => { item.done = false; });\n  });\n}")

replace_once(core,
"export function advancePhase(state, direction = 1) {\n  const count = state.phases.items.length;\n  if (!count) return null;\n  const forward = Number(direction) >= 0;\n  let next = state.phases.activeIndex + (forward ? 1 : -1);\n  if (next >= count) {\n    next = 0;\n    state.phases.cycle = Math.min(9999, state.phases.cycle + 1);\n  } else if (next < 0) {\n    next = count - 1;\n    state.phases.cycle = Math.max(1, state.phases.cycle - 1);\n  }\n  state.phases.activeIndex = next;\n  touch(state);\n  return state.phases.items[next];\n}",
"export function advancePhase(state, direction = 1) {\n  const count = state.phases.items.length;\n  if (!count) return null;\n  const forward = Number(direction) >= 0;\n  let next = state.phases.activeIndex + (forward ? 1 : -1);\n  let cycleChanged = false;\n  if (next >= count) {\n    next = 0;\n    state.phases.cycle = Math.min(9999, state.phases.cycle + 1);\n    cycleChanged = true;\n  } else if (next < 0) {\n    next = count - 1;\n    state.phases.cycle = Math.max(1, state.phases.cycle - 1);\n    cycleChanged = true;\n  }\n  if (cycleChanged) resetPhaseChecklistProgress(state);\n  state.phases.activeIndex = next;\n  touch(state);\n  return state.phases.items[next];\n}")

replace_once(core,
"    phases: phaseSource.slice(0, MAX_PHASES).map((phase, index) => ({\n      name: text(phase?.name || `Phase ${index + 1}`, 32),\n      note: text(phase?.note, 120)\n    })),",
"    phases: phaseSource.slice(0, MAX_PHASES).map((phase, index) => ({\n      name: text(phase?.name || `Phase ${index + 1}`, 32),\n      note: text(phase?.note, 120),\n      checklist: (Array.isArray(phase?.checklist) ? phase.checklist : []).slice(0, MAX_PHASE_CHECKLIST_ITEMS).map((item, itemIndex) => ({\n        label: text(typeof item === 'string' ? item : item?.label || `Item ${itemIndex + 1}`, 80)\n      }))\n    })),")

replace_once(core,
"  state.phases.items = template.phases.map(phase => ({ id: uid('phase_'), name: phase.name, note: phase.note }));",
"  state.phases.items = template.phases.map(phase => ({\n    id: uid('phase_'),\n    name: phase.name,\n    note: phase.note,\n    checklist: phase.checklist.map(item => ({ id: uid('phase_item_'), label: item.label, done: false }))\n  }));")

replace_once(core,
"    id: uid('phase_'),\n    name: translated?.phases?.[index] || name,\n    note: ''\n  }));",
"    id: uid('phase_'),\n    name: translated?.phases?.[index] || name,\n    note: '',\n    checklist: []\n  }));")

replace_once(core,
"  state.phases.activeIndex = 0;\n  state.phases.cycle = 1;\n  state.roles = [];",
"  state.phases.activeIndex = 0;\n  state.phases.cycle = 1;\n  resetPhaseChecklistProgress(state);\n  state.roles = [];")

ui = 'src/tabletop.js'
replace_once(ui,
"  TABLE_OS_STORAGE_KEY, ASSISTANT_TEMPLATES, MAX_TABLE_OS_PARTICIPANTS, MAX_ENTITIES, MAX_TRACKERS, MAX_STATUSES, MAX_PHASES,\n",
"  TABLE_OS_STORAGE_KEY, ASSISTANT_TEMPLATES, MAX_TABLE_OS_PARTICIPANTS, MAX_ENTITIES, MAX_TRACKERS, MAX_STATUSES, MAX_PHASES, MAX_PHASE_CHECKLIST_ITEMS,\n")
replace_once(ui,
"  addPhase, removePhase, setActivePhase, advancePhase,\n",
"  addPhase, removePhase, setActivePhase, advancePhase, setPhaseChecklistFromText, togglePhaseChecklistItem,\n")
replace_once(ui,
"    addPhase: '添加阶段', cycle: '循环', previous: '上一步', next: '下一步', noPhases: '当前没有阶段。', phaseNote: '备注', openTimer: '去主计时器',",
"    addPhase: '添加阶段', cycle: '循环', previous: '上一步', next: '下一步', noPhases: '当前没有阶段。', phaseNote: '备注', openTimer: '去主计时器', phaseChecklist: '阶段清单', phaseChecklistHelp: '每行一项；牌局模式可直接勾选。跨 cycle 或开始新场景时自动清空完成状态。', phaseChecklistPlaceholder: '执行阶段能力\\n补充公共资源',")
replace_once(ui,
"    addPhase: 'Add phase', cycle: 'Cycle', previous: 'Previous', next: 'Next', noPhases: 'No phases yet.', phaseNote: 'Note', openTimer: 'Open main timer',",
"    addPhase: 'Add phase', cycle: 'Cycle', previous: 'Previous', next: 'Next', noPhases: 'No phases yet.', phaseNote: 'Note', openTimer: 'Open main timer', phaseChecklist: 'Phase checklist', phaseChecklistHelp: 'One item per line. Toggle items during play; completion resets when the cycle changes or a new scenario starts.', phaseChecklistPlaceholder: 'Resolve phase ability\\nRefill shared supply',")

old_render = """function renderPhases() {
  const active = state.phases.items[state.phases.activeIndex];
  return `<section class=\"tableos-card\">\n    <div class=\"tableos-card-head\"><div><span>${esc(tr('phases'))}</span><h3>${active ? esc(active.name) : '—'} · ${esc(tr('cycle'))} ${state.phases.cycle}</h3></div>${state.ui.mode === 'edit' ? `<button class=\"tableos-btn primary\" type=\"button\" data-os-action=\"add-phase\">${esc(tr('addPhase'))}</button>` : ''}</div>\n    ${state.phases.items.length ? `<div class=\"tableos-phase-controls\"><button class=\"tableos-btn\" type=\"button\" data-os-action=\"prev-phase\">← ${esc(tr('previous'))}</button><button class=\"tableos-btn primary\" type=\"button\" data-os-action=\"next-phase\">${esc(tr('next'))} →</button><button class=\"tableos-btn\" type=\"button\" data-os-action=\"open-timer\">${esc(tr('openTimer'))}</button></div>` : ''}\n    <div class=\"tableos-phase-list\">${state.phases.items.map((phase, index) => state.ui.mode === 'edit' ? `<article class=\"tableos-phase ${index === state.phases.activeIndex ? 'active' : ''}\"><button class=\"tableos-phase-index\" type=\"button\" data-os-phase-active=\"${index}\">${index + 1}</button><div><input value=\"${attr(phase.name)}\" data-os-phase-name=\"${phase.id}\" maxlength=\"32\"><input value=\"${attr(phase.note)}\" data-os-phase-note=\"${phase.id}\" maxlength=\"120\" placeholder=\"${attr(tr('phaseNote'))}\"></div><button class=\"tableos-mini danger\" type=\"button\" data-os-remove-phase=\"${phase.id}\">×</button></article>` : `<article class=\"tableos-phase tableos-phase-live ${index === state.phases.activeIndex ? 'active' : ''}\"><button class=\"tableos-phase-index\" type=\"button\" data-os-phase-active=\"${index}\">${index + 1}</button><div><strong>${esc(phase.name)}</strong>${phase.note ? `<span>${esc(phase.note)}</span>` : ''}</div></article>`).join('') || `<p class=\"tableos-empty\">${esc(tr('noPhases'))}</p>`}</div>\n  </section>`;
}
"""
new_render = """function renderPhaseChecklist(phase) {
  const items = Array.isArray(phase.checklist) ? phase.checklist : [];
  if (!items.length) return '';
  const done = items.filter(item => item.done).length;
  return `<div class=\"tableos-phase-checklist-live\"><div class=\"tableos-phase-checklist-head\"><span>${esc(tr('phaseChecklist'))}</span><strong>${done} / ${items.length}</strong></div>${items.map(item => `<button type=\"button\" class=\"tableos-phase-checkitem ${item.done ? 'active' : ''}\" data-os-phase-check=\"${phase.id}|${item.id}\" aria-pressed=\"${item.done ? 'true' : 'false'}\"><span aria-hidden=\"true\">${item.done ? '✓' : '○'}</span><strong>${esc(item.label)}</strong></button>`).join('')}</div>`;
}

function renderPhases() {
  const active = state.phases.items[state.phases.activeIndex];
  return `<section class=\"tableos-card\">\n    <div class=\"tableos-card-head\"><div><span>${esc(tr('phases'))}</span><h3>${active ? esc(active.name) : '—'} · ${esc(tr('cycle'))} ${state.phases.cycle}</h3></div>${state.ui.mode === 'edit' ? `<button class=\"tableos-btn primary\" type=\"button\" data-os-action=\"add-phase\">${esc(tr('addPhase'))}</button>` : ''}</div>\n    ${state.phases.items.length ? `<div class=\"tableos-phase-controls\"><button class=\"tableos-btn\" type=\"button\" data-os-action=\"prev-phase\">← ${esc(tr('previous'))}</button><button class=\"tableos-btn primary\" type=\"button\" data-os-action=\"next-phase\">${esc(tr('next'))} →</button><button class=\"tableos-btn\" type=\"button\" data-os-action=\"open-timer\">${esc(tr('openTimer'))}</button></div>` : ''}\n    <div class=\"tableos-phase-list\">${state.phases.items.map((phase, index) => state.ui.mode === 'edit' ? `<article class=\"tableos-phase ${index === state.phases.activeIndex ? 'active' : ''}\"><button class=\"tableos-phase-index\" type=\"button\" data-os-phase-active=\"${index}\">${index + 1}</button><div><input value=\"${attr(phase.name)}\" data-os-phase-name=\"${phase.id}\" maxlength=\"32\"><input value=\"${attr(phase.note)}\" data-os-phase-note=\"${phase.id}\" maxlength=\"120\" placeholder=\"${attr(tr('phaseNote'))}\"><details class=\"tableos-phase-checklist-editor\"><summary>${esc(tr('phaseChecklist'))} · ${(phase.checklist || []).length}/${MAX_PHASE_CHECKLIST_ITEMS}</summary><p class=\"tableos-help\">${esc(tr('phaseChecklistHelp'))}</p><textarea rows=\"3\" maxlength=\"1200\" data-os-phase-checklist=\"${phase.id}\" placeholder=\"${attr(tr('phaseChecklistPlaceholder'))}\">${esc((phase.checklist || []).map(item => item.label).join('\\n'))}</textarea></details></div><button class=\"tableos-mini danger\" type=\"button\" data-os-remove-phase=\"${phase.id}\">×</button></article>` : `<article class=\"tableos-phase tableos-phase-live ${index === state.phases.activeIndex ? 'active' : ''}\"><button class=\"tableos-phase-index\" type=\"button\" data-os-phase-active=\"${index}\">${index + 1}</button><div><strong>${esc(phase.name)}</strong>${phase.note ? `<span>${esc(phase.note)}</span>` : ''}${index === state.phases.activeIndex ? renderPhaseChecklist(phase) : ''}</div></article>`).join('') || `<p class=\"tableos-empty\">${esc(tr('noPhases'))}</p>`}</div>\n  </section>`;
}
"""
replace_once(ui, old_render, new_render)

replace_once(ui,
"[data-os-tracker-delta],[data-os-remove-tracker],[data-os-phase-active],[data-os-remove-phase],[data-os-remove-team]",
"[data-os-tracker-delta],[data-os-remove-tracker],[data-os-phase-active],[data-os-phase-check],[data-os-remove-phase],[data-os-remove-team]")
replace_once(ui,
"    if (d.osPhaseActive !== undefined) { setActivePhase(state, Number(d.osPhaseActive)); persist(); render(); return; }\n    if (d.osRemovePhase) { removePhase(state, d.osRemovePhase); persist(); render(); return; }",
"    if (d.osPhaseActive !== undefined) { setActivePhase(state, Number(d.osPhaseActive)); persist(); render(); return; }\n    if (d.osPhaseCheck) { const [phaseId, itemId] = d.osPhaseCheck.split('|'); togglePhaseChecklistItem(state, phaseId, itemId); persist(); render(); return; }\n    if (d.osRemovePhase) { removePhase(state, d.osRemovePhase); persist(); render(); return; }")
replace_once(ui,
"    if (d.osPhaseNote) { const phase = state.phases.items.find(item => item.id === d.osPhaseNote); if (phase) phase.note = element.value.trim().slice(0, 120); persist(); return; }",
"    if (d.osPhaseNote) { const phase = state.phases.items.find(item => item.id === d.osPhaseNote); if (phase) phase.note = element.value.trim().slice(0, 120); persist(); return; }\n    if (d.osPhaseChecklist) { setPhaseChecklistFromText(state, d.osPhaseChecklist, element.value); persist(); return; }")

css = 'src/tabletop.css'
replace_once(css,
".tableos-phase.active .tableos-phase-index { background: #0f766e; color: white; border-color: #2dd4bf; }",
".tableos-phase.active .tableos-phase-index { background: #0f766e; color: white; border-color: #2dd4bf; }\n.tableos-phase-checklist-editor { grid-column: 1 / -1; }\n.tableos-phase-checklist-editor summary { color: #94a3b8; font-size: 12px; font-weight: 800; cursor: pointer; }\n.tableos-phase-checklist-editor .tableos-help { margin: 8px 0 6px; }\n.tableos-phase-checklist-editor textarea { resize: vertical; }\n.tableos-phase-checklist-live { grid-column: 1 / -1; display: grid; gap: 6px; margin-top: 3px; }\n.tableos-phase-checklist-head { display: flex; justify-content: space-between; gap: 10px; color: #94a3b8; font-size: 12px; }\n.tableos-phase-checkitem { min-height: 44px; display: grid; grid-template-columns: 24px 1fr; gap: 8px; align-items: center; text-align: left; border: 1px solid rgba(148, 163, 184, .18); border-radius: 9px; background: #0f172a; color: #cbd5e1; padding: 8px 10px; cursor: pointer; }\n.tableos-phase-checkitem > span { color: #64748b; font-size: 18px; }\n.tableos-phase-checkitem.active { border-color: rgba(45, 212, 191, .45); background: rgba(20, 184, 166, .1); color: #ccfbf1; }\n.tableos-phase-checkitem.active > span { color: #5eead4; }")

unit_test = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PHASE_CHECKLIST_ITEMS, createDefaultTableOsState, normalizeTableOsState,
  addPhase, setActivePhase, advancePhase, setPhaseChecklistFromText, togglePhaseChecklistItem,
  resetTableOsSession, createUserTemplateFromState, applyUserTemplate
} from '../../src/tabletop-core.js';

test('phase checklist text setup is bounded and preserves matching live items', () => {
  const state = createDefaultTableOsState();
  const phase = addPhase(state, 'Action');
  const input = Array.from({ length: MAX_PHASE_CHECKLIST_ITEMS + 3 }, (_, index) => `Step ${index + 1}`).join('\n');
  const result = setPhaseChecklistFromText(state, phase.id, input);
  assert.equal(result.requested, MAX_PHASE_CHECKLIST_ITEMS + 3);
  assert.equal(result.saved, MAX_PHASE_CHECKLIST_ITEMS);
  assert.equal(result.limitReached, true);
  assert.equal(togglePhaseChecklistItem(state, phase.id, phase.checklist[1].id), true);
  const preservedId = phase.checklist[1].id;

  setPhaseChecklistFromText(state, phase.id, 'Step 2\nNew step\nStep 1');
  assert.deepEqual(phase.checklist.map(item => item.label), ['Step 2', 'New step', 'Step 1']);
  assert.equal(phase.checklist[0].id, preservedId, 'matching item keeps identity when checklist order changes');
  assert.equal(phase.checklist[0].done, true, 'matching item keeps same-cycle completion state');
  assert.equal(phase.checklist[1].done, false);
});

test('phase checklist progress resets when cycle changes and on new scenario', () => {
  const state = createDefaultTableOsState();
  const first = addPhase(state, 'Start');
  const second = addPhase(state, 'Cleanup');
  setPhaseChecklistFromText(state, first.id, 'Draw\nReady');
  setPhaseChecklistFromText(state, second.id, 'Discard');
  togglePhaseChecklistItem(state, first.id, first.checklist[0].id);
  togglePhaseChecklistItem(state, second.id, second.checklist[0].id);

  setActivePhase(state, 1);
  advancePhase(state, 1);
  assert.equal(state.phases.cycle, 2);
  assert.equal(state.phases.items.flatMap(phase => phase.checklist).every(item => item.done === false), true, 'new cycle starts with a clean checklist');

  togglePhaseChecklistItem(state, first.id, first.checklist[1].id);
  resetTableOsSession(state);
  assert.equal(state.phases.cycle, 1);
  assert.equal(state.phases.activeIndex, 0);
  assert.equal(state.phases.items.flatMap(phase => phase.checklist).every(item => item.done === false), true, 'new scenario clears completion state');
});

test('normalization accepts older phases and sanitizes checklist data', () => {
  const state = normalizeTableOsState({
    phases: {
      activeIndex: 0,
      cycle: 3,
      items: [
        { id: 'phase one', name: 'Action', note: 'Do things' },
        { id: 'phase two', name: 'Resolve', checklist: ['Pay cost', { id: 'x', label: 'Gain reward', done: true }] }
      ]
    }
  });
  assert.deepEqual(state.phases.items[0].checklist, [], 'old phase data receives an empty checklist');
  assert.deepEqual(state.phases.items[1].checklist.map(item => [item.label, item.done]), [['Pay cost', false], ['Gain reward', true]]);
  assert.equal(state.schemaVersion, 5);
});

test('My Templates keep phase checklist structure but never live completion progress', () => {
  const source = createDefaultTableOsState();
  const phase = addPhase(source, 'Action');
  setPhaseChecklistFromText(source, phase.id, 'Resolve ability\nRefill supply');
  togglePhaseChecklistItem(source, phase.id, phase.checklist[0].id);

  const saved = createUserTemplateFromState(source, 'Checklist setup');
  assert.deepEqual(saved.phases[0].checklist, [{ label: 'Resolve ability' }, { label: 'Refill supply' }]);
  assert.equal(JSON.stringify(saved).includes('"done":true'), false, 'live completion state is excluded from My Templates');
  assert.equal(JSON.stringify(saved).includes('phase_item_'), false, 'live checklist item ids are excluded from My Templates');

  const target = createDefaultTableOsState();
  applyUserTemplate(target, saved);
  assert.deepEqual(target.phases.items[0].checklist.map(item => item.label), ['Resolve ability', 'Refill supply']);
  assert.equal(target.phases.items[0].checklist.every(item => item.done === false), true, 'template apply starts clean');
  assert.notEqual(target.phases.items[0].checklist[0].id, phase.checklist[0].id, 'template apply creates fresh checklist identities');
});
'''
Path('tests/unit/tabletop-phase-checklist.test.js').write_text(unit_test)

e2e = 'tests/e2e/run-table-os-e2e.js'
replace_once(e2e,
"  assert.equal(phaseAfterRemoval, activeAfter, 'removing an earlier phase preserves the active phase identity');\n  await page.getByRole('button', { name: '牌局模式' }).click();",
"  assert.equal(phaseAfterRemoval, activeAfter, 'removing an earlier phase preserves the active phase identity');\n\n  // Active phases can carry a lightweight checklist without turning Table OS into a rules engine.\n  const activeChecklistEditor = page.locator('.tableos-phase.active [data-os-phase-checklist]');\n  await activeChecklistEditor.fill('处理阶段能力\\n补充公共资源');\n  await activeChecklistEditor.blur();\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  const phaseChecklistItems = page.locator('[data-os-phase-check]');\n  assert.equal(await phaseChecklistItems.count(), 2, 'only the active phase exposes its configured checklist in play mode');\n  await phaseChecklistItems.first().click();\n  assert.equal(await phaseChecklistItems.first().getAttribute('aria-pressed'), 'true', 'phase checklist is directly toggleable during play');\n  const checkedSnapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));\n  assert.equal(checkedSnapshot.phases.items[checkedSnapshot.phases.activeIndex].checklist[0].done, true, 'phase checklist completion persists within the current cycle');\n  await page.locator('[data-os-phase-active]').last().click();\n  await page.getByRole('button', { name: /下一步/ }).click();\n  assert.equal(await page.locator('[data-os-phase-check]').first().getAttribute('aria-pressed'), 'false', 'wrapping to a new cycle resets checklist completion');")

replace_once(e2e,
"      'play/edit separation', 'purpose-first quick start', 'roster sync', 'universal trackers', 'phase engine',\n",
"      'play/edit separation', 'purpose-first quick start', 'roster sync', 'universal trackers', 'phase engine', 'phase checklist lifecycle',\n")

doc = 'TABLE_OS.md'
replace_once(doc,
"- Phase 名称与主持备注",
"- Phase 名称、主持备注与每阶段轻量清单")
replace_once(doc,
"- 可编辑阶段名与主持备注。\n- 上一步 / 下一步循环推进。\n- 自动维护 cycle 计数，适用于轮次、阶段制和昼夜流程。\n- 牌局模式提供「去主计时器」快捷入口，避免在两个工作台之间来回找导航。",
"- 可编辑阶段名与主持备注。\n- 每阶段可配置最多 12 条轻量清单；牌局模式只在当前阶段展示并直接勾选。\n- 同一 cycle 内切换阶段会保留完成状态；跨到新 cycle（前进或后退跨界）会统一清空，避免上一轮勾选污染下一轮。\n- 「新场景 / 下一局」也会清空清单完成状态，但保留清单结构。\n- 上一步 / 下一步循环推进。\n- 自动维护 cycle 计数，适用于轮次、阶段制和昼夜流程。\n- 牌局模式提供「去主计时器」快捷入口，避免在两个工作台之间来回找导航。")
replace_once(doc,
"- 模板只保存可复用配置：Tracker 的名称/范围/生命周期/上下限/步长/初始值、Phase 名称/备注、Team 名称/颜色和 ScoreSheet 字段/公式，以及是否启用 Campaign 能力。",
"- 模板只保存可复用配置：Tracker 的名称/范围/生命周期/上下限/步长/初始值、Phase 名称/备注/清单结构、Team 名称/颜色和 ScoreSheet 字段/公式，以及是否启用 Campaign 能力；Phase 清单的当前勾选状态不会进入模板。")
replace_once(doc,
"  - phase 实际推进与主计时器入口",
"  - phase 实际推进、当前阶段清单生命周期与主计时器入口")

matrix = 'docs/TABLE_OS_TEST_MATRIX.md'
replace_once(matrix,
"| Node unit tests | roster sync, participant bounds, bulk roster parsing/cap safety, moderator batch assignment/privacy cleanup, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |",
"| Node unit tests | roster sync, participant bounds, bulk roster parsing/cap safety, moderator batch assignment/privacy cleanup, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles/checklist lifecycle, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |")
replace_once(matrix,
"| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, ordered moderator assignment replacement, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |",
"| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, ordered moderator assignment replacement, universal trackers, phase engine with active-phase checklist lifecycle, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |")
replace_once(matrix,
"### Phase removal continuity\n",
"### Phase checklist lifecycle\n\n- Unit: checklist paste is bounded to 12 items per phase, sanitizes labels, and preserves matching same-cycle item identity/completion when the list is reordered.\n- Unit: crossing a cycle boundary in either direction and New scenario / rematch clear live completion while preserving checklist structure.\n- Unit/privacy: normalization accepts pre-checklist phase data; My Templates store checklist labels only, never live completion or item IDs, and apply with fresh IDs/default unchecked state.\n- Chromium: Edit setup configures the active phase checklist, Play mode toggles it directly, same-cycle progress persists, and wrapping into a new cycle resets completion.\n\n### Phase removal continuity\n")

print('phase checklist migration applied')
