from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    file.write_text(text.replace(old, new, 1))


old_state = '''  const sessionTrackerValues = trackers.some(tracker => tracker?.persistence !== 'campaign'\n    && tracker?.values && typeof tracker.values === 'object' && Object.keys(tracker.values).length > 0);\n  const phases = table.phases && typeof table.phases === 'object' ? table.phases : {};\n  const phaseMoved = Number(phases.activeIndex || 0) !== 0 || Math.max(1, Number(phases.cycle) || 1) !== 1;'''
new_state = '''  const sessionTrackerValues = trackers.some(tracker => tracker?.persistence !== 'campaign'\n    && tracker?.values && typeof tracker.values === 'object' && Object.keys(tracker.values).length > 0);\n  const statuses = Array.isArray(table.statuses) ? table.statuses : [];\n  const statusChanged = statuses.some(status => {\n    const values = status?.values && typeof status.values === 'object' ? status.values : {};\n    const initial = Boolean(status?.initial);\n    return Object.values(values).some(value => Boolean(value) !== initial);\n  });\n  const phases = table.phases && typeof table.phases === 'object' ? table.phases : {};\n  const phaseMoved = Number(phases.activeIndex || 0) !== 0 || Math.max(1, Number(phases.cycle) || 1) !== 1;\n  const checklistProgress = (Array.isArray(phases.items) ? phases.items : []).some(phase =>\n    (Array.isArray(phase?.checklist) ? phase.checklist : []).some(item => Boolean(item?.done))\n  );'''
replace_once('src/tabletop-companion.js', old_state, new_state)

old_return = '''  return Boolean(sessionTrackerValues || phaseMoved || rolesAssigned || scoresEntered || table.campaign?.enabled);'''
new_return = '''  return Boolean(sessionTrackerValues || statusChanged || phaseMoved || checklistProgress || rolesAssigned || scoresEntered || table.campaign?.enabled);'''
replace_once('src/tabletop-companion.js', old_return, new_return)

flow_marker = '''async function runSessionLifecycleFlow() {'''
flow = r'''async function runTransientLifecycleDetectionFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-action="start-session"]').click();
  await openTableOs(page);
  await page.locator('[data-os-quick-template="card-battle"]').click();

  // An explicit Status override that equals its default is not meaningful live state.
  await page.getByRole('button', { name: 'Statuses', exact: true }).click();
  let statusToggle = page.locator('[data-os-status-toggle]').first();
  assert.equal(await statusToggle.getAttribute('aria-pressed'), 'false');
  await statusToggle.click();
  await statusToggle.click();
  const defaultEquivalent = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.ok(defaultEquivalent.statuses.some(status => Object.keys(status.values || {}).length > 0), 'test seeds an explicit default-equivalent Status override');
  await page.locator('.tableos-header [data-os-action="close"]').click();
  await rematchMainGame(page);
  await openTableOs(page);
  assert.equal(await page.locator('[data-tableos-companion-action="new-session"]').count(), 0, 'default-equivalent Status overrides do not nag on rematch');

  // A Status value that differs from its default is transient session state and must not silently carry over.
  await page.getByRole('button', { name: 'Statuses', exact: true }).click();
  statusToggle = page.locator('[data-os-status-toggle]').first();
  await statusToggle.click();
  assert.equal(await statusToggle.getAttribute('aria-pressed'), 'true');
  await page.locator('.tableos-header [data-os-action="close"]').click();
  await rematchMainGame(page);
  await openTableOs(page);
  const newSession = page.locator('[data-tableos-companion-action="new-session"]');
  await newSession.waitFor({ state: 'visible' });
  assert.match(await page.locator('[data-tableos-main-context]').textContent(), /New main game detected/);
  await newSession.click();
  await page.getByText('Session state reset for the new game.', { exact: true }).waitFor({ state: 'visible' });
  const statusReset = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.ok(statusReset.statuses.every(status => Object.keys(status.values || {}).length === 0), 'accepted rematch reset clears Status live values');

  // Checklist structure alone is reusable configuration, not live progress.
  await page.getByRole('button', { name: 'Edit setup', exact: true }).click();
  await page.getByRole('button', { name: 'Phases', exact: true }).click();
  await page.locator('.tableos-phase.active .tableos-phase-checklist-editor > summary').click();
  const checklistEditor = page.locator('.tableos-phase.active [data-os-phase-checklist]');
  await checklistEditor.fill('Resolve upkeep');
  await checklistEditor.blur();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Phases', exact: true }).click();
  let checklistItem = page.locator('[data-os-phase-check]').first();
  assert.equal(await checklistItem.getAttribute('aria-pressed'), 'false');
  await page.locator('.tableos-header [data-os-action="close"]').click();
  await rematchMainGame(page);
  await openTableOs(page);
  assert.equal(await page.locator('[data-tableos-companion-action="new-session"]').count(), 0, 'unchecked checklist structure does not nag on rematch');

  // Checked checklist progress is transient session state and must trigger the lifecycle choice.
  await page.getByRole('button', { name: 'Phases', exact: true }).click();
  checklistItem = page.locator('[data-os-phase-check]').first();
  await checklistItem.click();
  assert.equal(await checklistItem.getAttribute('aria-pressed'), 'true');
  await page.locator('.tableos-header [data-os-action="close"]').click();
  await rematchMainGame(page);
  await openTableOs(page);
  await newSession.waitFor({ state: 'visible' });
  await newSession.click();
  await page.getByText('Session state reset for the new game.', { exact: true }).waitFor({ state: 'visible' });
  const checklistReset = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.ok(checklistReset.phases.items.every(phase => (phase.checklist || []).every(item => item.done === false)), 'accepted rematch reset clears checklist completion');

  assert.equal(errors.length, 0, `Table OS transient lifecycle console errors: ${errors.join(' | ')}`);
  await context.close();
}

async function runSessionLifecycleFlow() {'''
replace_once('tests/e2e/run-table-os-companion-e2e.js', flow_marker, flow)

run_marker = '''  await runQuietLifecycleFlow();\n  await runSessionLifecycleFlow();'''
run_insert = '''  await runQuietLifecycleFlow();\n  await runTransientLifecycleDetectionFlow();\n  await runSessionLifecycleFlow();'''
replace_once('tests/e2e/run-table-os-companion-e2e.js', run_marker, run_insert)

summary_marker = '''      'quiet empty rematch', 'new-session detection', 'keep-current lifecycle choice','''
summary_insert = '''      'quiet empty rematch', 'status/checklist rematch transient detection', 'new-session detection', 'keep-current lifecycle choice','''
replace_once('tests/e2e/run-table-os-companion-e2e.js', summary_marker, summary_insert)

doc = Path('docs/TABLE_OS_TEST_MATRIX.md')
text = doc.read_text().rstrip()
section = '''\n\n### Companion rematch transient-state detection\n\n- Lifecycle detection: changed Status values and checked Phase checklist items count as session-local Table OS state, so a new main-game session requires the existing explicit Start New Table / Keep Table State choice instead of silently carrying them forward.\n- Noise control: a Status override equal to its configured default and an unchecked checklist structure do not count as live progress, so clean rematches remain silent.\n- Chromium: isolated Status-only and checklist-only rematches prove meaningful transient state triggers the lifecycle choice and accepted reset clears the live values/progress through the existing `resetTableOsSession()` path.\n'''
if '### Companion rematch transient-state detection' in text:
    raise SystemExit('docs section already exists')
doc.write_text(text + section)
