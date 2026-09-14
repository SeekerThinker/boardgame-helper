from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}')
    p.write_text(text.replace(old, new, 1))


# Formula evaluator: unknown identifiers must not silently become zero.
replace_once(
    'src/tabletop-core.js',
    "    if (/^[A-Za-z_]/.test(token)) return number(variables[token], 0);",
    "    if (/^[A-Za-z_]/.test(token)) {\n      if (!Object.prototype.hasOwnProperty.call(variables, token)) throw new Error('unknown-variable');\n      return number(variables[token], 0);\n    }"
)

old_score_card = """export function scoreCardForParticipant(state, participantId) {
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
"""
new_score_card = """export function scoreCardForParticipant(state, participantId) {
  const rawValues = state.scoreSheet.values?.[participantId] || {};
  const variables = {};
  const values = {};
  const errors = {};
  const fieldsByKey = new Map(state.scoreSheet.fields.map(field => [field.key, field]));
  const resolved = new Set();
  const visiting = [];

  state.scoreSheet.fields.forEach(field => {
    if (field.kind === 'manual') {
      const value = number(rawValues[field.id], 0);
      values[field.id] = value;
      variables[field.key] = value;
    } else {
      values[field.id] = 0;
      variables[field.key] = 0;
    }
  });

  const markCycle = fieldId => {
    const start = visiting.indexOf(fieldId);
    const cycle = start >= 0 ? visiting.slice(start) : [fieldId];
    cycle.forEach(id => { errors[id] = 'circular-reference'; });
  };

  const evaluateField = field => {
    if (field.kind !== 'formula') return true;
    if (resolved.has(field.id)) return !errors[field.id];
    if (visiting.includes(field.id)) {
      markCycle(field.id);
      return false;
    }

    visiting.push(field.id);
    let tokens;
    try {
      tokens = tokenizeFormula(field.formula);
    } catch (error) {
      errors[field.id] = error.message || 'invalid-expression';
      visiting.pop();
      resolved.add(field.id);
      return false;
    }

    const dependencies = [...new Set(tokens.filter(token => /^[A-Za-z_]/.test(token)))];
    let valid = true;
    dependencies.forEach(key => {
      const dependency = fieldsByKey.get(key);
      if (!dependency) {
        errors[field.id] ||= 'unknown-variable';
        valid = false;
        return;
      }
      if (dependency.kind === 'formula' && !evaluateField(dependency)) {
        errors[field.id] ||= 'dependency-error';
        valid = false;
      }
    });

    if (errors[field.id]) valid = false;
    if (valid) {
      const evaluated = evaluateFormula(field.formula, variables);
      if (evaluated.ok) {
        values[field.id] = evaluated.value;
        variables[field.key] = evaluated.value;
      } else {
        errors[field.id] = evaluated.error || 'invalid-expression';
        valid = false;
      }
    }
    if (!valid) {
      values[field.id] = 0;
      variables[field.key] = 0;
    }

    visiting.pop();
    resolved.add(field.id);
    return valid;
  };

  state.scoreSheet.fields.forEach(field => { if (field.kind === 'formula') evaluateField(field); });
  const total = state.scoreSheet.fields.reduce((sum, field) => {
    if (!field.includeInTotal) return sum;
    return sum + number(values[field.id], 0) * field.effect;
  }, 0);
  return { values, variables, total: Math.round(total * 100) / 100, errors };
}
"""
replace_once('src/tabletop-core.js', old_score_card, new_score_card)

# Surface invalid formula state in the live score sheet.
replace_once(
    'src/tabletop.js',
    "    noScoreFields: '当前没有计分栏。', formulaHelp: '公式支持变量、数字、+ − × ÷ 和括号，例如 base + bonus - penalty。',",
    "    noScoreFields: '当前没有计分栏。', formulaHelp: '公式支持变量、数字、+ − × ÷ 和括号，例如 base + bonus - penalty。', formulaError: '公式无效，请检查变量名或循环引用。',"
)
replace_once(
    'src/tabletop.js',
    "    noScoreFields: 'No score fields yet.', formulaHelp: 'Formulas support variables, numbers, + − × ÷ and parentheses, e.g. base + bonus - penalty.',",
    "    noScoreFields: 'No score fields yet.', formulaHelp: 'Formulas support variables, numbers, + − × ÷ and parentheses, e.g. base + bonus - penalty.', formulaError: 'Invalid formula. Check variable names or circular references.',"
)
replace_once(
    'src/tabletop.js',
    "${field.kind === 'formula' ? `<output>${card.values[field.id] ?? 0}</output>` : `<input type=\"number\" value=\"${card.values[field.id] ?? 0}\" data-os-score-value=\"${participant.id}|${field.id}\">`}",
    "${field.kind === 'formula' ? (card.errors?.[field.id] ? `<output class=\"tableos-score-error\" data-os-score-error=\"${field.id}\" title=\"${attr(tr('formulaError'))}\" aria-label=\"${attr(`${field.name}: ${tr('formulaError')}`)}\">⚠</output>` : `<output>${card.values[field.id] ?? 0}</output>`) : `<input type=\"number\" value=\"${card.values[field.id] ?? 0}\" data-os-score-value=\"${participant.id}|${field.id}\">`}"
)

# Unit regressions: typo rejection, dependency ordering, and cycle detection.
replace_once(
    'tests/unit/tabletop-core.test.js',
    "  assert.equal(evaluateFormula('1 / 0', {}).ok, false, 'division by zero is rejected');\n});",
    "  assert.equal(evaluateFormula('1 / 0', {}).ok, false, 'division by zero is rejected');\n  assert.deepEqual(evaluateFormula('base + bonuz', { base: 10 }), { ok: false, value: 0, error: 'unknown-variable' }, 'unknown variables are rejected instead of silently becoming zero');\n});"
)
insert_after = """test('score sheet combines manual and calculated fields without double-counting display formulas', () => {
  const state = createDefaultTableOsState();
  const player = addParticipant(state, 'A');
  const base = addScoreSheetField(state, { name: 'Base', key: 'base' });
  const bonus = addScoreSheetField(state, { name: 'Bonus', key: 'bonus' });
  const penalty = addScoreSheetField(state, { name: 'Penalty', key: 'penalty', effect: -1 });
  addScoreSheetField(state, { name: 'Net', key: 'net', kind: 'formula', formula: 'base + bonus - penalty', includeInTotal: false });

  setScoreSheetValue(state, player.id, base.id, 12);
  setScoreSheetValue(state, player.id, bonus.id, 4);
  setScoreSheetValue(state, player.id, penalty.id, 3);
  const card = scoreCardForParticipant(state, player.id);

  assert.equal(card.variables.net, 13);
  assert.equal(card.total, 13, 'manual included fields use their effects; display formula is not counted again');
});
"""
addition = insert_after + """

test('score sheet resolves formula dependencies and rejects typo or circular formulas', () => {
  const state = createDefaultTableOsState();
  const player = addParticipant(state, 'A');
  const base = addScoreSheetField(state, { name: 'Base', key: 'base' });
  const grand = addScoreSheetField(state, { name: 'Grand', key: 'grand', kind: 'formula', formula: 'double + 1', includeInTotal: false });
  const doubled = addScoreSheetField(state, { name: 'Double', key: 'double', kind: 'formula', formula: 'base * 2', includeInTotal: false });
  const typo = addScoreSheetField(state, { name: 'Typo', key: 'typo', kind: 'formula', formula: 'base + bonuz', includeInTotal: true });
  const loopA = addScoreSheetField(state, { name: 'Loop A', key: 'loop_a', kind: 'formula', formula: 'loop_b + 1', includeInTotal: true });
  const loopB = addScoreSheetField(state, { name: 'Loop B', key: 'loop_b', kind: 'formula', formula: 'loop_a + 1', includeInTotal: true });

  setScoreSheetValue(state, player.id, base.id, 5);
  const card = scoreCardForParticipant(state, player.id);

  assert.equal(card.values[doubled.id], 10, 'formula dependency can be declared after its consumer');
  assert.equal(card.values[grand.id], 11, 'dependent formula resolves after its dependency');
  assert.equal(card.values[typo.id], 0);
  assert.equal(card.errors[typo.id], 'unknown-variable', 'typo does not silently alter settlement math');
  assert.equal(card.values[loopA.id], 0);
  assert.equal(card.values[loopB.id], 0);
  assert.equal(card.errors[loopA.id], 'circular-reference');
  assert.equal(card.errors[loopB.id], 'circular-reference');
  assert.equal(card.total, 5, 'invalid included formulas contribute zero and remain explicitly flagged');
});
"""
replace_once('tests/unit/tabletop-core.test.js', insert_after, addition)

# Chromium regression: a mistyped live formula must be visibly invalid and recover after correction.
score_anchor = """  assert.equal(await page.locator('.tableos-score-table > article').first().locator('output').last().textContent(), '5', 'variable renames preserve the live formula result');

  // A focused live value is flushed synchronously before page lifecycle interruption, even without blur/change.
"""
score_replacement = """  assert.equal(await page.locator('.tableos-score-table > article').first().locator('output').last().textContent(), '5', 'variable renames preserve the live formula result');

  // Formula typos are correctness failures, not implicit zero-valued variables.
  await editMode(page);
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  const renamedFormula = page.locator('[data-os-score-formula]').first();
  await renamedFormula.fill('points + missing_bonus');
  await renamedFormula.blur();
  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  const formulaWarning = page.locator('[data-os-score-error]').first();
  assert.equal(await formulaWarning.textContent(), '⚠', 'unknown score variable is visibly rejected');
  assert.match(await formulaWarning.getAttribute('title'), /公式无效/, 'formula warning explains the invalid configuration');
  await editMode(page);
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  await page.locator('[data-os-score-formula]').first().fill('-(points + points_2) / -2 + objective - penalty');
  await page.locator('[data-os-score-formula]').first().blur();
  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  assert.equal(await page.locator('[data-os-score-error]').count(), 0, 'correcting the formula clears the warning');
  assert.equal(await page.locator('.tableos-score-table > article').first().locator('output').last().textContent(), '5', 'corrected formula restores the calculated result');

  // A focused live value is flushed synchronously before page lifecycle interruption, even without blur/change.
"""
replace_once('tests/e2e/run-table-os-e2e.js', score_anchor, score_replacement)
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "      'toolbox-team bridge', 'two-stage private role reveal', 'moderator-note isolation', 'formula score sheet', 'unary formula operators', 'modal focus trap', 'nested reveal focus return', 'launcher focus return',",
    "      'toolbox-team bridge', 'two-stage private role reveal', 'moderator-note isolation', 'formula score sheet', 'unary formula operators', 'formula typo validation', 'modal focus trap', 'nested reveal focus return', 'launcher focus return',"
)

# Release-gate documentation.
replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    "- ScoreSheet variable keys must remain formula-safe and unique; renaming a variable must migrate exact formula references so configuration edits cannot silently change scores.\n",
    "- ScoreSheet variable keys must remain formula-safe and unique; renaming a variable must migrate exact formula references so configuration edits cannot silently change scores.\n- ScoreSheet formulas must reject unknown variables and circular formula dependencies; invalid formulas must be visibly flagged instead of silently producing plausible totals.\n"
)
replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    "### Score variable rename safety\n\n- Unit: duplicate 24-character keys terminate safely with a unique suffix; variable names are normalized to formula-safe identifiers.\n- Unit: renaming a ScoreSheet variable rewrites exact formula references, resolves collisions deterministically, and preserves calculated results.\n- Chromium: Edit setup can rename two variables to the same requested name; the UI shows unique keys, updates the formula text, and keeps the live calculated score unchanged.\n",
    "### Score variable rename safety\n\n- Unit: duplicate 24-character keys terminate safely with a unique suffix; variable names are normalized to formula-safe identifiers.\n- Unit: renaming a ScoreSheet variable rewrites exact formula references, resolves collisions deterministically, and preserves calculated results.\n- Chromium: Edit setup can rename two variables to the same requested name; the UI shows unique keys, updates the formula text, and keeps the live calculated score unchanged.\n\n### Score formula validation\n\n- Unit: unknown identifiers are rejected instead of becoming zero; forward formula dependencies resolve deterministically; circular dependencies are detected and contribute zero rather than arbitrary iterative values.\n- Chromium: a mistyped formula displays an explicit warning in the live score sheet, and correcting the formula clears the warning and restores the calculated value.\n"
)
