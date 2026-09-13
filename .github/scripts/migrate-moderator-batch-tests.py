from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'tests/e2e/run-table-os-e2e.js',
    """  await page.keyboard.press('Escape');\n  assert.equal(await firstRoleReveal.evaluate(element => element === document.activeElement), true, 'closing private reveal returns focus to its trigger');\n\n  // Session bridge: recent random teams from the basic toolbox can be adopted without rebuilding them manually.\n""",
    """  await page.keyboard.press('Escape');\n  assert.equal(await firstRoleReveal.evaluate(element => element === document.activeElement), true, 'closing private reveal returns focus to its trigger');\n\n  // Large-table moderator setup can replace a whole ordered character list without carrying stale host notes forward.\n  await editMode(page);\n  await page.getByRole('button', { name: '团队与身份', exact: true }).click();\n  await page.getByText('批量设置身份', { exact: true }).click();\n  await page.locator('[data-os-bulk-characters]').fill('预言家 | 村民\\n狼人 | 狼人阵营\\n守卫 | 村民\\n村民');\n  await page.getByRole('button', { name: '替换身份列表', exact: true }).click();\n  const batchSnapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));\n  assert.deepEqual(batchSnapshot.roles.map(item => [item.role, item.faction]), [['预言家', '村民'], ['狼人', '狼人阵营'], ['守卫', '村民'], ['村民', '']]);\n  assert.equal(batchSnapshot.roles.every(item => item.note === ''), true, 'batch replacement clears old host notes');\n  assert.equal(JSON.stringify(batchSnapshot.roles).includes('主持人机密'), false, 'retired host notes do not survive replacement');\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  await page.getByRole('button', { name: '团队与身份', exact: true }).click();\n  await page.locator('[data-os-role-reveal]').first().click();\n  assert.equal(await page.getByText('预言家', { exact: true }).count(), 0, 'replacement character stays hidden before player confirmation');\n  await page.getByRole('button', { name: '这是我，查看身份' }).click();\n  assert.ok(await page.getByText('预言家', { exact: true }).isVisible());\n  assert.ok(await page.getByText('村民', { exact: true }).isVisible());\n  assert.equal(await page.getByText(/主持人机密/).count(), 0, 'retired host note never enters the replacement reveal DOM');\n  await page.keyboard.press('Escape');\n\n  // Session bridge: recent random teams from the basic toolbox can be adopted without rebuilding them manually.\n"""
)

replace_once(
    'TABLE_OS.md',
    """- 可一键采用基础工具箱最近一次随机分队结果，不需要重复勾选成员。\n- 每位参与者可设置身份、阵营、主持备注和“私密”属性。\n""",
    """- 可一键采用基础工具箱最近一次随机分队结果，不需要重复勾选成员。\n- 编辑模式可按当前参与者顺序批量粘贴 `Role | Faction`（也支持制表符分隔）并一次替换整组身份；已有身份数据会先确认，替换会清除旧主持备注，避免旧信息错误附着到新身份。\n- 每位参与者可设置身份、阵营、主持备注和“私密”属性。\n"""
)

replace_once(
    'TABLE_OS.md',
    """  - 工具箱随机分队 → Table OS Team bridge\n  - 两段式私密身份 reveal\n""",
    """  - 工具箱随机分队 → Table OS Team bridge\n  - 大型主持局批量身份/阵营替换与旧主持备注清理\n  - 两段式私密身份 reveal\n"""
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    """| Node unit tests | roster sync, participant bounds, bulk roster parsing/cap safety, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |\n""",
    """| Node unit tests | roster sync, participant bounds, bulk roster parsing/cap safety, moderator batch assignment/privacy cleanup, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |\n"""
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    """| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |\n""",
    """| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, ordered moderator assignment replacement, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |\n"""
)

with Path('docs/TABLE_OS_TEST_MATRIX.md').open('a') as f:
    f.write("""\n\n### Large-table moderator assignment\n\n- Unit: ordered pasted assignments are bounded by the current participant roster and empty input is non-destructive.\n- Unit/privacy: whole-list replacement clears retired moderator notes so old hidden context cannot attach to new characters or survive serialization/export.\n- Chromium: Edit setup replaces a four-player identity/faction list in one action, keeps the existing two-stage reveal flow, and proves the retired moderator note is absent from persisted assignments and the player reveal DOM.\n""")
