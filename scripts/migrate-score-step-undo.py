from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    file.write_text(text.replace(old, new, 1))


companion_marker = "\nfunction phaseSnapshot() {"
score_undo = r'''
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

function phaseSnapshot() {'''
replace_once('src/tabletop-companion.js', companion_marker, '\n' + score_undo)

click_marker = '''  const phase = element.closest('[data-os-action="next-phase"],[data-os-action="prev-phase"],[data-os-phase-active]');'''
click_insert = '''  const score = element.closest('[data-os-score-delta]');
  if (score) {
    const run = scoreUndoFromButton(score);
    if (run) captureUndo(tr('scoreAction'), () => { let ok = false; runInSection('score', () => { ok = run() !== false; }); return ok; });
    return;
  }

  const phase = element.closest('[data-os-action="next-phase"],[data-os-action="prev-phase"],[data-os-phase-active]');'''
replace_once('src/tabletop-companion.js', click_marker, click_insert)

test_marker = '''  // Phase changes are reversible, including the lower cycle boundary where inverse navigation is not symmetric.'''
test_insert = '''  // ScoreSheet quick-step taps use the same one-step recovery as direct score edits.
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  const quickScoreValue = page.locator('[data-os-score-value]').first();
  const quickScorePlus = page.locator('[data-os-score-delta]').filter({ hasText: '+' }).first();
  const quickScoreBefore = await quickScoreValue.inputValue();
  await quickScorePlus.click();
  assert.equal(await quickScoreValue.inputValue(), String(Number(quickScoreBefore) + 1), 'score quick-step updates the live value');
  await page.locator('[data-tableos-companion-action="undo"]').click();
  assert.equal(await quickScoreValue.inputValue(), quickScoreBefore, 'score quick-step can be undone to the exact prior value');

  // Phase changes are reversible, including the lower cycle boundary where inverse navigation is not symmetric.'''
replace_once('tests/e2e/run-table-os-companion-e2e.js', test_marker, test_insert)

doc_marker = '''- Correctness: step-button updates flow through the existing score setter/render path so formulas, totals and standings recompute from the same source of truth without a schema change.'''
doc_insert = '''- Correctness: step-button updates flow through the existing score setter/render path so formulas, totals and standings recompute from the same source of truth without a schema change.
- Companion safety: Play-mode ScoreSheet −/+ taps participate in the same one-step undo surface as direct score edits, restoring the exact prior manual value without bypassing normal score recomputation.'''
replace_once('docs/TABLE_OS_TEST_MATRIX.md', doc_marker, doc_insert)
