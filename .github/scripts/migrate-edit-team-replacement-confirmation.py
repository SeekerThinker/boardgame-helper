from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'src/tabletop.js',
    "    adoptTeams: '采用工具箱分队', noRandomTeams: '工具箱里还没有随机分队结果。', teamsAdopted: '已采用工具箱最近一次分队。',",
    "    adoptTeams: '采用工具箱分队', noRandomTeams: '工具箱里还没有随机分队结果。', teamsAdopted: '已采用工具箱最近一次分队。', confirmAdoptTeams: '采用工具箱分队会替换现有团队，并清除旧团队范围的状态和追踪值。继续吗？',"
)
replace_once(
    'src/tabletop.js',
    "    adoptTeams: 'Use toolbox teams', noRandomTeams: 'There is no recent random-team result in the toolbox.', teamsAdopted: 'Latest toolbox teams adopted.',",
    "    adoptTeams: 'Use toolbox teams', noRandomTeams: 'There is no recent random-team result in the toolbox.', teamsAdopted: 'Latest toolbox teams adopted.', confirmAdoptTeams: 'Using toolbox teams replaces the current teams and clears status/tracker values scoped to the old teams. Continue?',"
)
replace_once(
    'src/tabletop.js',
    "  const teams = sourceTeams.slice(0, MAX_TEAMS).map((sourceTeam, index) => ({\n    name: locale() === 'zh' ? `${index + 1}队` : `Team ${index + 1}`,\n    memberIds: (Array.isArray(sourceTeam.playerIds) ? sourceTeam.playerIds : []).map(id => bySource.get(String(id))).filter(Boolean)\n  }));\n  replaceTeams(state, teams);",
    "  const teams = sourceTeams.slice(0, MAX_TEAMS).map((sourceTeam, index) => ({\n    name: locale() === 'zh' ? `${index + 1}队` : `Team ${index + 1}`,\n    memberIds: (Array.isArray(sourceTeam.playerIds) ? sourceTeam.playerIds : []).map(id => bySource.get(String(id))).filter(Boolean)\n  }));\n  if (state.teams.length && !confirm(tr('confirmAdoptTeams'))) return;\n  replaceTeams(state, teams);"
)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  await editMode(page);\n  assert.equal(await page.getByRole('button', { name: '团队与身份', exact: true }).getAttribute('aria-current'), 'page', 'switching to Edit keeps the live Teams section in context');\n  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  await page.getByRole('button', { name: '牌局模式' }).click();",
    "  await editMode(page);\n  assert.equal(await page.getByRole('button', { name: '团队与身份', exact: true }).getAttribute('aria-current'), 'page', 'switching to Edit keeps the live Teams section in context');\n  await page.getByRole('button', { name: '添加团队', exact: true }).click();\n  const teamsBeforeAdopt = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')).teams);\n  const adoptConfirmCount = confirmMessages.length;\n  dismissNextConfirm = true;\n  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  assert.equal(confirmMessages.length, adoptConfirmCount + 1, 'replacing existing teams asks for confirmation in Edit setup');\n  assert.match(confirmMessages.at(-1), /替换现有团队.*团队范围的状态和追踪值/, 'team replacement disclosure names the live values that will be cleared');\n  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')).teams), teamsBeforeAdopt, 'canceling toolbox team replacement leaves existing teams untouched');\n  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  await page.getByRole('button', { name: '牌局模式' }).click();"
)

doc = Path('docs/TABLE_OS_TEST_MATRIX.md')
text = doc.read_text()
anchor = '- Play/Edit safety: whole-team adoption is configuration-only in Edit mode; Play keeps the live team/role surface read-focused, and section continuity makes the replacement workflow one mode switch away.\n'
addition = '- Destructive confirmation: when teams already exist, Edit setup must disclose that toolbox adoption replaces the team roster and clears old team-scoped Tracker/Status live values; cancel leaves the current teams untouched.\n'
if addition not in text:
    if anchor not in text:
        raise SystemExit('team replacement docs anchor not found')
    text = text.replace(anchor, anchor + addition, 1)
doc.write_text(text)
