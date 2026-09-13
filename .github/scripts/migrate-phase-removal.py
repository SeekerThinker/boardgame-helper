from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'src/tabletop-core.js',
    """export function removePhase(state, phaseId) {\n  const index = state.phases.items.findIndex(item => item.id === phaseId);\n  if (index < 0) return false;\n  state.phases.items.splice(index, 1);\n  if (!state.phases.items.length) state.phases.activeIndex = 0;\n  else state.phases.activeIndex = Math.min(state.phases.activeIndex, state.phases.items.length - 1);\n  touch(state);\n  return true;\n}\n""",
    """export function removePhase(state, phaseId) {\n  const index = state.phases.items.findIndex(item => item.id === phaseId);\n  if (index < 0) return false;\n  const activePhaseId = state.phases.items[state.phases.activeIndex]?.id || null;\n  const removingActivePhase = activePhaseId === phaseId;\n  state.phases.items.splice(index, 1);\n  if (!state.phases.items.length) state.phases.activeIndex = 0;\n  else if (removingActivePhase) state.phases.activeIndex = Math.min(index, state.phases.items.length - 1);\n  else {\n    const preservedIndex = state.phases.items.findIndex(item => item.id === activePhaseId);\n    state.phases.activeIndex = preservedIndex >= 0\n      ? preservedIndex\n      : Math.min(state.phases.activeIndex, state.phases.items.length - 1);\n  }\n  touch(state);\n  return true;\n}\n"""
)

unit = """import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createDefaultTableOsState, addPhase, setActivePhase, removePhase } from '../../src/tabletop-core.js';\n\nfunction stateWithPhases(names = ['A', 'B', 'C', 'D']) {\n  const state = createDefaultTableOsState();\n  names.forEach(name => addPhase(state, name));\n  return state;\n}\n\ntest('removing an earlier phase preserves the active phase identity', () => {\n  const state = stateWithPhases();\n  setActivePhase(state, 2);\n  const activeId = state.phases.items[2].id;\n  const removedId = state.phases.items[0].id;\n\n  assert.equal(removePhase(state, removedId), true);\n  assert.equal(state.phases.activeIndex, 1);\n  assert.equal(state.phases.items[state.phases.activeIndex].id, activeId);\n  assert.equal(state.phases.items[state.phases.activeIndex].name, 'C');\n});\n\ntest('removing the active phase selects the nearest surviving phase without changing cycle', () => {\n  const middle = stateWithPhases();\n  middle.phases.cycle = 7;\n  setActivePhase(middle, 1);\n  assert.equal(removePhase(middle, middle.phases.items[1].id), true);\n  assert.equal(middle.phases.items[middle.phases.activeIndex].name, 'C');\n  assert.equal(middle.phases.cycle, 7);\n\n  const last = stateWithPhases(['A', 'B', 'C']);\n  setActivePhase(last, 2);\n  assert.equal(removePhase(last, last.phases.items[2].id), true);\n  assert.equal(last.phases.activeIndex, 1);\n  assert.equal(last.phases.items[last.phases.activeIndex].name, 'B');\n});\n"""
Path('tests/unit/tabletop-phase-removal.test.js').write_text(unit)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    """  assert.notEqual(activeAfter, activeBefore);\n  assert.ok(await page.getByRole('button', { name: '去主计时器' }).isVisible());\n\n  // Set a private role in Edit mode, then prove the player reveal is two-stage and moderator notes never leak.\n""",
    """  assert.notEqual(activeAfter, activeBefore);\n  assert.ok(await page.getByRole('button', { name: '去主计时器' }).isVisible());\n\n  // Editing the phase list must not silently move the live pointer when an earlier phase is removed.\n  await editMode(page);\n  await page.locator('[data-os-remove-phase]').first().click();\n  const phaseAfterRemoval = await page.evaluate(() => {\n    const stored = JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1'));\n    return stored.phases.items[stored.phases.activeIndex]?.name || '';\n  });\n  assert.equal(phaseAfterRemoval, activeAfter, 'removing an earlier phase preserves the active phase identity');\n  await page.getByRole('button', { name: '牌局模式' }).click();\n\n  // Set a private role in Edit mode, then prove the player reveal is two-stage and moderator notes never leak.\n"""
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    """- Existing basic timer/scoring flows must remain unchanged by Table OS work.\n\nThe production Android signing key""",
    """- Existing basic timer/scoring flows must remain unchanged by Table OS work.\n- Removing a phase before the current live phase must preserve that active phase by identity; removing the active phase selects the nearest surviving phase without changing the cycle.\n\nThe production Android signing key"""
)

with Path('docs/TABLE_OS_TEST_MATRIX.md').open('a') as f:
    f.write("""\n\n### Phase removal continuity\n\n- Unit: deleting a phase before the active phase preserves the same active phase identity after indexes shift; deleting the active phase selects the next neighbor or previous phase when removing the last item.\n- Chromium: deleting an earlier phase in Edit setup does not silently advance the live table to a different phase.\n""")
