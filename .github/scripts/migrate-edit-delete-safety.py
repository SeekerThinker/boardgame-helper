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
    "const QUICK_TEMPLATES = ['universal', 'coop-crisis', 'hidden-role', 'card-battle', 'campaign', 'party-teams'];\n\nconst I18N = {",
    "const QUICK_TEMPLATES = ['universal', 'coop-crisis', 'hidden-role', 'card-battle', 'campaign', 'party-teams'];\nconst DESTRUCTIVE_EDIT_SELECTOR = '[data-os-remove-participant],[data-os-remove-entity],[data-os-remove-status],[data-os-remove-tracker],[data-os-remove-phase],[data-os-remove-team],[data-os-role-clear],[data-os-remove-score],[data-os-flag-remove]';\n\nconst I18N = {"
)

replace_once(
    'src/tabletop.js',
    "    confirmMyTemplate: '应用我的模板会重置桌面实体、状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者与战役记忆。继续吗？', confirmDeleteMyTemplate: '删除这个本机模板吗？'",
    "    confirmMyTemplate: '应用我的模板会重置桌面实体、状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者与战役记忆。继续吗？', confirmDeleteMyTemplate: '删除这个本机模板吗？',\n    confirmDeleteItem: '删除后会同时清除该项目及其关联的配置或当前牌局数据，且无法撤销。继续吗？'"
)

replace_once(
    'src/tabletop.js',
    "    confirmMyTemplate: 'Applying My template resets table entities, statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants and campaign memory. Continue?', confirmDeleteMyTemplate: 'Delete this local template?'",
    "    confirmMyTemplate: 'Applying My template resets table entities, statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants and campaign memory. Continue?', confirmDeleteMyTemplate: 'Delete this local template?',\n    confirmDeleteItem: 'Removing this item also clears its related setup or live table data and cannot be undone. Continue?'"
)

replace_once(
    'src/tabletop.js',
    "    const d = target.dataset;\n    if (d.osAction === 'close')",
    "    const d = target.dataset;\n    if (target.matches(DESTRUCTIVE_EDIT_SELECTOR) && !confirm(tr('confirmDeleteItem'))) return;\n    if (d.osAction === 'close')"
)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).players.length), 4, 'bulk roster never mutates the main game roster');\n  for (let index = 0; index < 5; index += 1) await page.locator('[data-os-remove-participant]').last().click();\n  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'test cleanup returns to the synchronized four-player roster');",
    "  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).players.length), 4, 'bulk roster never mutates the main game roster');\n  const deleteConfirmCount = confirmMessages.length;\n  dismissNextConfirm = true;\n  await page.locator('[data-os-remove-participant]').last().click();\n  assert.equal(await page.locator('[data-os-participant-name]').count(), 9, 'canceling an Edit-mode destructive delete leaves the participant roster untouched');\n  assert.equal(confirmMessages.length, deleteConfirmCount + 1, 'Edit-mode destructive deletes ask for explicit confirmation');\n  assert.match(confirmMessages.at(-1), /无法撤销/, 'destructive delete confirmation discloses irreversible related-data removal');\n  for (let index = 0; index < 5; index += 1) await page.locator('[data-os-remove-participant]').last().click();\n  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'accepted destructive deletes still use the existing participant cleanup path');"
)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "      'play/edit separation', 'purpose-first quick start', 'roster sync', 'universal trackers', 'phase engine', 'phase checklist lifecycle', 'phase timer bridge',",
    "      'play/edit separation', 'purpose-first quick start', 'roster sync', 'edit destructive delete safety', 'universal trackers', 'phase engine', 'phase checklist lifecycle', 'phase timer bridge',"
)

replace_once(
    'tests/e2e/run-table-os-entities-e2e.js',
    "  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });\n  page.on('pageerror', error => errors.push(error.message));",
    "  const deleteConfirms = [];\n  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });\n  page.on('pageerror', error => errors.push(error.message));\n  page.on('dialog', async dialog => { deleteConfirms.push(dialog.message()); await dialog.accept(); });"
)

replace_once(
    'tests/e2e/run-table-os-entities-e2e.js',
    "  await page.locator(`[data-os-remove-entity=\"${bossId}\"]`).click();\n  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));",
    "  await page.locator(`[data-os-remove-entity=\"${bossId}\"]`).click();\n  assert.match(deleteConfirms.at(-1), /无法撤销/, 'entity removal uses the shared destructive-delete confirmation gate');\n  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));"
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    "### Large-table roster setup\n",
    "### Edit-mode destructive delete safety\n\n- Interaction boundary: participant, entity, status, tracker, phase, team, role, score-field and campaign-checkpoint removal controls share one Edit-mode confirmation gate; Play mode does not gain any new destructive controls or prompts.\n- Chromium: canceling a destructive participant deletion leaves the roster and persisted workspace untouched; accepting an entity deletion with live entity-scoped Tracker/Status values confirms first and then preserves the existing cleanup semantics.\n- Data-loss disclosure: the bilingual confirmation explicitly states that related setup/live table data is removed and the action cannot be undone; existing core cleanup semantics remain unchanged.\n\n### Large-table roster setup\n"
)
