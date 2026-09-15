from pathlib import Path


def replace_once(path, old, new):
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/tabletop.js',
    '`<input type="number" value="${card.values[field.id] ?? 0}" data-os-score-value="${participant.id}|${field.id}">`',
    "(state.ui.mode === 'play' ? `<div class=\"tableos-score-stepper\"><button class=\"tableos-score-step\" type=\"button\" data-os-score-delta=\"${participant.id}|${field.id}|-${field.step}\" aria-label=\"${attr(field.name + ' −' + field.step)}\">−</button><input type=\"number\" value=\"${card.values[field.id] ?? 0}\" data-os-score-value=\"${participant.id}|${field.id}\"><button class=\"tableos-score-step\" type=\"button\" data-os-score-delta=\"${participant.id}|${field.id}|${field.step}\" aria-label=\"${attr(field.name + ' +' + field.step)}\">+</button></div>` : `<input type=\"number\" value=\"${card.values[field.id] ?? 0}\" data-os-score-value=\"${participant.id}|${field.id}\">`)"
)

replace_once(
    'src/tabletop.js',
    "[data-os-remove-score],[data-os-flag-toggle]",
    "[data-os-remove-score],[data-os-score-delta],[data-os-flag-toggle]"
)

replace_once(
    'src/tabletop.js',
    "    if (d.osRemoveScore) { removeScoreSheetField(state, d.osRemoveScore); persist(); render(); return; }\n    if (d.osAction === 'add-flag') { if (!addCampaignFlag(state, tr('customFlag'))) flash(tr('limit')); else { persist(); render(); } return; }",
    "    if (d.osRemoveScore) { removeScoreSheetField(state, d.osRemoveScore); persist(); render(); return; }\n    if (d.osScoreDelta) { const [participantId, fieldId, delta] = d.osScoreDelta.split('|'); const current = Number(state.scoreSheet.values?.[participantId]?.[fieldId] ?? 0); setScoreSheetValue(state, participantId, fieldId, current + Number(delta)); persist(); render(); return; }\n    if (d.osAction === 'add-flag') { if (!addCampaignFlag(state, tr('customFlag'))) flash(tr('limit')); else { persist(); render(); } return; }"
)

replace_once(
    'src/tabletop.css',
    '.tableos-score-values { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }\n.tableos-score-values output { display: block; min-height: 40px; color: #f8fafc; font-weight: 800; }',
    '.tableos-score-values { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }\n.tableos-score-stepper { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; gap: 5px; align-items: center; }\n.tableos-score-step { appearance: none; min-width: 36px; height: 40px; border: 1px solid rgba(148, 163, 184, .25); border-radius: 8px; background: #111827; color: #e2e8f0; font-size: 18px; font-weight: 800; cursor: pointer; }\n.tableos-score-step:hover { border-color: rgba(94, 234, 212, .65); }\n.tableos-score-step:focus-visible { outline: 2px solid rgba(45, 212, 191, .45); outline-offset: 1px; border-color: #2dd4bf; }\n.tableos-score-values output { display: block; min-height: 40px; color: #f8fafc; font-weight: 800; }'
)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  assert.equal(await page.locator('.tableos-score-config').count(), 0, 'formula configuration is hidden in play mode');\n  const manualInputs = page.locator('[data-os-score-value]');",
    "  assert.equal(await page.locator('.tableos-score-config').count(), 0, 'formula configuration is hidden in play mode');\n  await editMode(page);\n  await page.getByRole('button', { name: '计分表', exact: true }).click();\n  const firstScoreStep = page.locator('[data-os-score-step]').first();\n  await firstScoreStep.fill('5'); await firstScoreStep.blur();\n  assert.equal(await page.locator('[data-os-score-delta]').count(), 0, 'live score step buttons stay out of Edit setup');\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  await page.getByRole('button', { name: '计分表', exact: true }).click();\n  const manualInputs = page.locator('[data-os-score-value]');\n  const firstScoreDown = page.locator('[data-os-score-delta$=\"|-5\"]').first();\n  const firstScoreUp = page.locator('[data-os-score-delta$=\"|5\"]').first();\n  assert.ok(await firstScoreDown.isVisible() && await firstScoreUp.isVisible(), 'manual scores expose configured-step quick controls in Play mode');\n  await firstScoreUp.click();\n  assert.equal(await manualInputs.first().inputValue(), '5', 'score + control applies the configured field step');\n  await firstScoreDown.click();\n  assert.equal(await manualInputs.first().inputValue(), '0', 'score − control applies the configured field step while preserving direct input');"
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    "### Score standings semantics\n\n- Unit: highest-total and lowest-total modes sort deterministically; equal totals use competition ranking (`1, 1, 3`) and expose tie state.",
    "### Live score step controls\n\n- Chromium: manual ScoreSheet fields expose configured-step −/+ quick controls in Play mode while retaining direct numeric input; the controls stay out of Edit setup and reuse the same persisted live score values.\n- Correctness: step-button updates flow through the existing score setter/render path so formulas, totals and standings recompute from the same source of truth without a schema change.\n\n### Score standings semantics\n\n- Unit: highest-total and lowest-total modes sort deterministically; equal totals use competition ranking (`1, 1, 3`) and expose tie state."
)
