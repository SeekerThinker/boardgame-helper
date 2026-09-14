from pathlib import Path


def replace_once(path, old, new):
    text = Path(path).read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    Path(path).write_text(text.replace(old, new, 1))

# Add destructive replacement disclosure in both locales.
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

# Guard the replacement before replaceTeams mutates team-scoped live state.
replace_once(
    'src/tabletop.js',
    "  const teams = sourceTeams.slice(0, MAX_TEAMS).map((sourceTeam, index) => ({\n    name: locale() === 'zh' ? `${index + 1}队` : `Team ${index + 1}`,\n    memberIds: (Array.isArray(sourceTeam.playerIds) ? sourceTeam.playerIds : []).map(id => bySource.get(String(id))).filter(Boolean)\n  }));\n  replaceTeams(state, teams);",
    "  const teams = sourceTeams.slice(0, MAX_TEAMS).map((sourceTeam, index) => ({\n    name: locale() === 'zh' ? `${index + 1}队` : `Team ${index + 1}`,\n    memberIds: (Array.isArray(sourceTeam.playerIds) ? sourceTeam.playerIds : []).map(id => bySource.get(String(id))).filter(Boolean)\n  }));\n  if (state.teams.length && !confirm(tr('confirmAdoptTeams'))) return;\n  replaceTeams(state, teams);"
)

# Extend Chromium coverage at the real Play-mode adoption surface.
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  // Session bridge: recent random teams from the basic toolbox can be adopted without rebuilding them manually.\n  await page.evaluate(() => {",
    "  // Session bridge: replacing existing teams from the toolbox is destructive and must be explicit even in Play mode.\n  await editMode(page);\n  await page.getByRole('button', { name: '团队与身份', exact: true }).click();\n  await page.getByRole('button', { name: '添加团队', exact: true }).click();\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  const teamsBeforeAdopt = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')).teams);\n  await page.evaluate(() => {"
)
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  assert.equal(await page.locator('.tableos-team-live').count(), 2);",
    "  const adoptConfirmCount = confirmMessages.length;\n  dismissNextConfirm = true;\n  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  assert.equal(confirmMessages.length, adoptConfirmCount + 1, 'replacing existing teams asks for confirmation in Play mode');\n  assert.match(confirmMessages.at(-1), /替换现有团队.*团队范围的状态和追踪值/, 'team replacement disclosure names the live values that will be cleared');\n  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')).teams), teamsBeforeAdopt, 'canceling toolbox team replacement leaves existing teams untouched');\n  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  assert.equal(await page.locator('.tableos-team-live').count(), 2);"
)

# Document the release-blocking behavior and regression.
doc = Path('docs/TABLE_OS_TEST_MATRIX.md')
text = doc.read_text()
anchor = '- Team replacement must remove retired hidden team-scoped Tracker/Status values.\n'
if anchor in text and 'Toolbox team adoption must disclose' not in text:
    text = text.replace(anchor, anchor + '- Toolbox team adoption must disclose destructive replacement when teams already exist; cancel must preserve the current teams and live team-scoped state.\n', 1)
if '### Toolbox team replacement safety' not in text:
    text += "\n### Toolbox team replacement safety\n\n- Chromium: when teams already exist, Play-mode “Use toolbox teams” asks for confirmation that old team-scoped status/tracker values will be cleared.\n- Cancel path: dismissing that confirmation leaves the existing teams unchanged; accepting then replaces them with the latest toolbox result.\n"
doc.write_text(text)
