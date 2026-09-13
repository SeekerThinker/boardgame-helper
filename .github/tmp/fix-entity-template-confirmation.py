from pathlib import Path


def replace_once(path, old, new):
    text = Path(path).read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:80]!r}')
    Path(path).write_text(text.replace(old, new, 1))


# Destructive template application now resets table entities as well. The
# confirmation copy must name that data explicitly in both locales.
replace_once(
    'src/tabletop.js',
    "confirmTemplate: '应用模板会重置状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者。继续吗？'",
    "confirmTemplate: '应用模板会重置桌面实体、状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者。继续吗？'",
)
replace_once(
    'src/tabletop.js',
    "confirmMyTemplate: '应用我的模板会重置状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者与战役记忆。继续吗？'",
    "confirmMyTemplate: '应用我的模板会重置桌面实体、状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者与战役记忆。继续吗？'",
)
replace_once(
    'src/tabletop.js',
    "confirmTemplate: 'Applying a template resets statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants. Continue?'",
    "confirmTemplate: 'Applying a template resets table entities, statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants. Continue?'",
)
replace_once(
    'src/tabletop.js',
    "confirmMyTemplate: 'Applying My template resets statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants and campaign memory. Continue?'",
    "confirmMyTemplate: 'Applying My template resets table entities, statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants and campaign memory. Continue?'",
)

# Capture confirmation text in the main Chromium flow so destructive-copy
# regressions fail even if the reset itself still works.
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  const promptResponses = [];\n  page.on('console'",
    "  const promptResponses = [];\n  const confirmMessages = [];\n  page.on('console'",
)
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "    if (dialog.type() === 'prompt') await dialog.accept(promptResponses.shift() || dialog.defaultValue() || '');\n    else await dialog.accept();",
    "    if (dialog.type() === 'prompt') await dialog.accept(promptResponses.shift() || dialog.defaultValue() || '');\n    else { confirmMessages.push(dialog.message()); await dialog.accept(); }",
)
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'test cleanup returns to the synchronized four-player roster');\n\n  // Apply a cooperative template; application intentionally returns to Play mode.\n  await page.locator('[data-os-template]').selectOption('coop-crisis');\n  await page.getByRole('button', { name: '应用模板' }).click();",
    "  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'test cleanup returns to the synchronized four-player roster');\n\n  // Destructive template reset must explicitly disclose that table entities are removed.\n  await page.getByRole('button', { name: '添加实体' }).click();\n  const disclosureEntity = page.locator('[data-os-entity-name]').first();\n  await disclosureEntity.fill('测试 Boss'); await disclosureEntity.blur();\n  const builtInConfirmCount = confirmMessages.length;\n\n  // Apply a cooperative template; application intentionally returns to Play mode.\n  await page.locator('[data-os-template]').selectOption('coop-crisis');\n  await page.getByRole('button', { name: '应用模板' }).click();\n  assert.equal(confirmMessages.length, builtInConfirmCount + 1, 'built-in template application asks for confirmation');\n  assert.match(confirmMessages.at(-1), /桌面实体/, 'built-in template confirmation discloses entity reset');\n  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')).entities.length), 0, 'confirmed built-in template reset removes prior entities');",
)
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  await page.locator('[data-os-template]').selectOption('universal');\n  await page.getByRole('button', { name: '应用模板', exact: true }).click();\n  await editMode(page);\n  await page.getByRole('button', { name: '应用我的模板', exact: true }).click();",
    "  await page.locator('[data-os-template]').selectOption('universal');\n  await page.getByRole('button', { name: '应用模板', exact: true }).click();\n  await editMode(page);\n  await page.getByRole('button', { name: '添加实体' }).click();\n  const myTemplateDisclosureEntity = page.locator('[data-os-entity-name]').first();\n  await myTemplateDisclosureEntity.fill('临时目标'); await myTemplateDisclosureEntity.blur();\n  const myTemplateConfirmCount = confirmMessages.length;\n  await page.getByRole('button', { name: '应用我的模板', exact: true }).click();\n  assert.equal(confirmMessages.length, myTemplateConfirmCount + 1, 'My Template application asks for confirmation');\n  assert.match(confirmMessages.at(-1), /桌面实体/, 'My Template confirmation discloses entity reset');",
)
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "      'pagehide draft flush', 'escape-close draft flush', 'campaign tracker persistence', 'campaign reload persistence', '320px mobile', 'tablet', 'dynamic bilingual UI'",
    "      'pagehide draft flush', 'escape-close draft flush', 'campaign tracker persistence', 'campaign reload persistence', 'template entity destructive disclosure', '320px mobile', 'tablet', 'dynamic bilingual UI'",
)

# Treat destructive-copy accuracy as a release correctness gate.
replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    "| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, ordered moderator assignment replacement, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |",
    "| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, ordered moderator assignment replacement, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, destructive template disclosure for entity reset, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |",
)
replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    "- Applying a setup template must not erase or silently disable persistent campaign metadata, notes or checkpoints.\n",
    "- Applying a setup template must not erase or silently disable persistent campaign metadata, notes or checkpoints.\n- Any template application that resets Table Entities must explicitly disclose that destructive effect before confirmation.\n",
)
