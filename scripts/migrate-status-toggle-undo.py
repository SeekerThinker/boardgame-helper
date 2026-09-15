from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    file.write_text(text.replace(old, new, 1))


i18n_old = "trackerAction: '状态调整', phaseAction: '阶段切换', scoreAction: '计分修改', flagAction: '检查点修改',"
i18n_new = "trackerAction: '状态调整', statusAction: '状态开关', phaseAction: '阶段切换', scoreAction: '计分修改', flagAction: '检查点修改',"
replace_once('src/tabletop-companion.js', i18n_old, i18n_new)

i18n_en_old = "trackerAction: 'Tracker adjustment', phaseAction: 'Phase change', scoreAction: 'Score edit', flagAction: 'Checkpoint change',"
i18n_en_new = "trackerAction: 'Tracker adjustment', statusAction: 'Status toggle', phaseAction: 'Phase change', scoreAction: 'Score edit', flagAction: 'Checkpoint change',"
replace_once('src/tabletop-companion.js', i18n_en_old, i18n_en_new)

function_marker = '''function trackerUndoFromButton(button) {'''
function_insert = '''function statusUndoFromButton(button) {
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

function trackerUndoFromButton(button) {'''
replace_once('src/tabletop-companion.js', function_marker, function_insert)

click_marker = '''  const tracker = element.closest('[data-os-tracker-delta]');'''
click_insert = '''  const status = element.closest('[data-os-status-toggle]');
  if (status) {
    const run = statusUndoFromButton(status);
    if (run) captureUndo(tr('statusAction'), run);
    return;
  }

  const tracker = element.closest('[data-os-tracker-delta]');'''
replace_once('src/tabletop-companion.js', click_marker, click_insert)

test_marker = '''  // ScoreSheet quick-step taps use the same one-step recovery as direct score edits.'''
test_insert = '''  // Status toggles are high-frequency live actions and are one-step reversible.
  await page.getByRole('button', { name: '编辑配置', exact: true }).click();
  await page.getByRole('button', { name: '状态', exact: true }).click();
  await page.getByRole('button', { name: '添加状态', exact: true }).click();
  const statusName = page.locator('[data-os-status-name]').last();
  await statusName.fill('准备完成');
  await statusName.blur();
  await page.getByRole('button', { name: '牌局模式', exact: true }).click();
  await page.getByRole('button', { name: '状态', exact: true }).click();
  const statusToggle = page.locator('[data-os-status-toggle]').last();
  assert.equal(await statusToggle.getAttribute('aria-pressed'), 'false', 'custom status starts from its default off value');
  await statusToggle.click();
  assert.equal(await statusToggle.getAttribute('aria-pressed'), 'true', 'status tap changes the live value');
  await page.locator('[data-tableos-companion-action="undo"]').click();
  assert.equal(await statusToggle.getAttribute('aria-pressed'), 'false', 'status tap can be undone to the exact prior value');

  // ScoreSheet quick-step taps use the same one-step recovery as direct score edits.'''
replace_once('tests/e2e/run-table-os-companion-e2e.js', test_marker, test_insert)

doc_marker = '''- Chromium: Card Battle Poisoned/Stunned toggles, Hidden Roles Alive default, new-scenario reset, custom global status, template privacy/fresh apply, and same-session reload persistence.'''
doc_insert = '''- Chromium: Card Battle Poisoned/Stunned toggles, Hidden Roles Alive default, new-scenario reset, custom global status, template privacy/fresh apply, and same-session reload persistence.
- Companion safety: Play-mode Status toggles participate in one-step undo, restoring the exact prior on/off value through the existing toggle path without changing Status persistence semantics.'''
replace_once('docs/TABLE_OS_TEST_MATRIX.md', doc_marker, doc_insert)
