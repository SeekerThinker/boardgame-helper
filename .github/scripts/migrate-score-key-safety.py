from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/tabletop-core.js',
    """function scoreKey(value, index = 0) {\n  const cleaned = String(value ?? '')\n    .trim()\n    .toLowerCase()\n    .replace(/[^a-z0-9_]/g, '_')\n    .replace(/_+/g, '_')\n    .replace(/^_+|_+$/g, '')\n    .slice(0, 24);\n  return cleaned || `field_${index + 1}`;\n}\n\nfunction uniqueKey(candidate, used) {\n  let next = candidate;\n  let suffix = 2;\n  while (used.has(next)) {\n    next = `${candidate}_${suffix}`.slice(0, 24);\n    suffix += 1;\n  }\n  used.add(next);\n  return next;\n}\n""",
    """function scoreKey(value, index = 0) {\n  const cleaned = String(value ?? '')\n    .trim()\n    .toLowerCase()\n    .replace(/[^a-z0-9_]/g, '_')\n    .replace(/_+/g, '_')\n    .replace(/^_+|_+$/g, '')\n    .slice(0, 24);\n  if (!cleaned) return `field_${index + 1}`;\n  return /^[a-z_]/.test(cleaned) ? cleaned : `field_${cleaned}`.slice(0, 24);\n}\n\nfunction uniqueKey(candidate, used) {\n  let next = candidate;\n  let suffix = 2;\n  while (used.has(next)) {\n    const ending = `_${suffix}`;\n    next = `${candidate.slice(0, Math.max(1, 24 - ending.length))}${ending}`;\n    suffix += 1;\n  }\n  used.add(next);\n  return next;\n}\n"""
)

replace_once(
    'src/tabletop-core.js',
    """export function addScoreSheetField(state, { name = 'Field', key = '', kind = 'manual', formula = '', step = 1, effect = 1, includeInTotal = true } = {}) {\n  if (state.scoreSheet.fields.length >= MAX_SCORE_FIELDS) return null;\n  const used = new Set(state.scoreSheet.fields.map(field => field.key));\n  const field = scoreFieldFromTemplate({ name, key, kind, formula, step, effect, includeInTotal }, state.scoreSheet.fields.length, used);\n  state.scoreSheet.fields.push(field);\n  touch(state);\n  return field;\n}\n\nexport function removeScoreSheetField(state, fieldId) {\n""",
    """export function addScoreSheetField(state, { name = 'Field', key = '', kind = 'manual', formula = '', step = 1, effect = 1, includeInTotal = true } = {}) {\n  if (state.scoreSheet.fields.length >= MAX_SCORE_FIELDS) return null;\n  const used = new Set(state.scoreSheet.fields.map(field => field.key));\n  const field = scoreFieldFromTemplate({ name, key, kind, formula, step, effect, includeInTotal }, state.scoreSheet.fields.length, used);\n  state.scoreSheet.fields.push(field);\n  touch(state);\n  return field;\n}\n\nexport function setScoreSheetFieldKey(state, fieldId, value = '') {\n  const index = state.scoreSheet.fields.findIndex(field => field.id === fieldId);\n  if (index < 0) return null;\n  const field = state.scoreSheet.fields[index];\n  const used = new Set(state.scoreSheet.fields.filter(item => item.id !== fieldId).map(item => item.key));\n  const nextKey = uniqueKey(scoreKey(value || field.name, index), used);\n  const previousKey = field.key;\n  if (previousKey === nextKey) return nextKey;\n  field.key = nextKey;\n  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(previousKey || '')) {\n    state.scoreSheet.fields.forEach(candidate => {\n      if (candidate.kind === 'formula' && candidate.formula) {\n        candidate.formula = text(candidate.formula.replace(/[A-Za-z_][A-Za-z0-9_]*/g, token => token === previousKey ? nextKey : token), 120);\n      }\n    });\n  }\n  touch(state);\n  return nextKey;\n}\n\nexport function removeScoreSheetField(state, fieldId) {\n"""
)

replace_once(
    'src/tabletop.js',
    """  addScoreSheetField, removeScoreSheetField, setScoreSheetValue, scoreCardForParticipant,\n""",
    """  addScoreSheetField, setScoreSheetFieldKey, removeScoreSheetField, setScoreSheetValue, scoreCardForParticipant,\n"""
)

replace_once(
    'src/tabletop.js',
    """    if (d.osScoreKey) { mutateScoreField(d.osScoreKey, { key: element.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || 'field' }); saveAndRender(); return; }\n""",
    """    if (d.osScoreKey) { setScoreSheetFieldKey(state, d.osScoreKey, element.value); saveAndRender(); return; }\n"""
)

unit = """import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {\n  createDefaultTableOsState, addParticipant, addScoreSheetField, setScoreSheetFieldKey,\n  setScoreSheetValue, scoreCardForParticipant\n} from '../../src/tabletop-core.js';\n\ntest('score keys remain unique even when a 24-character candidate is duplicated', () => {\n  const state = createDefaultTableOsState();\n  const longKey = 'abcdefghijklmnopqrstuvwx';\n  const first = addScoreSheetField(state, { name: 'First', key: longKey });\n  const second = addScoreSheetField(state, { name: 'Second', key: longKey });\n\n  assert.equal(first.key, longKey);\n  assert.notEqual(second.key, first.key);\n  assert.equal(second.key.endsWith('_2'), true);\n  assert.ok(second.key.length <= 24);\n});\n\ntest('renaming score variables keeps keys formula-safe, unique and rewrites exact formula references', () => {\n  const state = createDefaultTableOsState();\n  const player = addParticipant(state, 'A');\n  const base = addScoreSheetField(state, { name: 'Base', key: 'base' });\n  const bonus = addScoreSheetField(state, { name: 'Bonus', key: 'bonus' });\n  const total = addScoreSheetField(state, { name: 'Net', key: 'net', kind: 'formula', formula: '-(base + bonus) / -2', includeInTotal: false });\n  setScoreSheetValue(state, player.id, base.id, 10);\n  setScoreSheetValue(state, player.id, bonus.id, 4);\n  assert.equal(scoreCardForParticipant(state, player.id).values[total.id], 7);\n\n  assert.equal(setScoreSheetFieldKey(state, base.id, 'points'), 'points');\n  assert.equal(total.formula, '-(points + bonus) / -2');\n  assert.equal(setScoreSheetFieldKey(state, bonus.id, 'points'), 'points_2');\n  assert.equal(total.formula, '-(points + points_2) / -2');\n  assert.equal(scoreCardForParticipant(state, player.id).values[total.id], 7, 'formula result survives both variable renames');\n\n  assert.equal(setScoreSheetFieldKey(state, base.id, '123'), 'field_123');\n  assert.equal(total.formula, '-(field_123 + points_2) / -2');\n  assert.equal(scoreCardForParticipant(state, player.id).values[total.id], 7, 'numeric-leading input is normalized to a formula-safe variable');\n});\n"""
Path('tests/unit/tabletop-score-key-safety.test.js').write_text(unit)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    """  assert.equal(await page.locator('.tableos-score-table > article').first().locator('output').last().textContent(), '5', 'unary formula syntax works through the live score sheet');\n\n  // A focused live value is flushed synchronously before page lifecycle interruption, even without blur/change.\n""",
    """  assert.equal(await page.locator('.tableos-score-table > article').first().locator('output').last().textContent(), '5', 'unary formula syntax works through the live score sheet');\n\n  // Score variable renames stay unique and migrate formula references instead of silently changing results.\n  await editMode(page);\n  await page.getByRole('button', { name: '计分表', exact: true }).click();\n  await page.locator('[data-os-score-key]').nth(0).fill('points');\n  await page.locator('[data-os-score-key]').nth(0).blur();\n  await page.locator('[data-os-score-key]').nth(1).fill('points');\n  await page.locator('[data-os-score-key]').nth(1).blur();\n  const renamedKeys = await page.locator('[data-os-score-key]').evaluateAll(elements => elements.map(element => element.value));\n  assert.deepEqual(renamedKeys.slice(0, 2), ['points', 'points_2'], 'duplicate score variables are made unique');\n  assert.equal(await page.locator('[data-os-score-formula]').first().inputValue(), '-(points + points_2) / -2 + objective - penalty', 'formula references migrate with variable renames');\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  await page.getByRole('button', { name: '计分表', exact: true }).click();\n  assert.equal(await page.locator('.tableos-score-table > article').first().locator('output').last().textContent(), '5', 'variable renames preserve the live formula result');\n\n  // A focused live value is flushed synchronously before page lifecycle interruption, even without blur/change.\n"""
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    """- Existing basic timer/scoring flows must remain unchanged by Table OS work.\n- Removing a phase before the current live phase must preserve that active phase by identity; removing the active phase selects the nearest surviving phase without changing the cycle.\n""",
    """- Existing basic timer/scoring flows must remain unchanged by Table OS work.\n- ScoreSheet variable keys must remain formula-safe and unique; renaming a variable must migrate exact formula references so configuration edits cannot silently change scores.\n- Removing a phase before the current live phase must preserve that active phase by identity; removing the active phase selects the nearest surviving phase without changing the cycle.\n"""
)

with Path('docs/TABLE_OS_TEST_MATRIX.md').open('a') as f:
    f.write("""\n\n### Score variable rename safety\n\n- Unit: duplicate 24-character keys terminate safely with a unique suffix; variable names are normalized to formula-safe identifiers.\n- Unit: renaming a ScoreSheet variable rewrites exact formula references, resolves collisions deterministically, and preserves calculated results.\n- Chromium: Edit setup can rename two variables to the same requested name; the UI shows unique keys, updates the formula text, and keeps the live calculated score unchanged.\n""")
