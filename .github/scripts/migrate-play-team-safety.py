from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/tabletop.js',
    '''<section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('teams'))}</span><h3>${state.teams.length}</h3></div><button class="tableos-btn" type="button" data-os-action="adopt-teams">${esc(tr('adoptTeams'))}</button></div>''',
    '''<section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('teams'))}</span><h3>${state.teams.length}</h3></div></div>'''
)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    '''  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  assert.equal(await page.locator('.tableos-team-live').count(), 2);''',
    '''  assert.equal(await page.getByRole('button', { name: '采用工具箱分队' }).count(), 0, 'team-roster replacement stays out of Play mode');\n  await editMode(page);\n  assert.equal(await page.getByRole('button', { name: '团队与身份', exact: true }).getAttribute('aria-current'), 'page', 'switching to Edit keeps the live Teams section in context');\n  await page.getByRole('button', { name: '采用工具箱分队' }).click();\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  assert.equal(await page.getByRole('button', { name: '团队与身份', exact: true }).getAttribute('aria-current'), 'page', 'returning to Play keeps Teams selected after roster replacement');\n  assert.equal(await page.locator('.tableos-team-live').count(), 2);'''
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    '''- Play mode must not expose template selectors, score formula configuration or roster edit fields.\n''',
    '''- Play mode must not expose template selectors, score formula configuration, roster edit fields, or whole-team replacement actions.\n'''
)

replace_once(
    'docs/TABLE_OS_TEST_MATRIX.md',
    '''- Chromium: adopting toolbox teams removes retired team IDs and hidden live values; replacement teams render the Tracker/Status defaults instead.\n''',
    '''- Chromium: adopting toolbox teams removes retired team IDs and hidden live values; replacement teams render the Tracker/Status defaults instead.\n- Play/Edit safety: whole-team adoption is configuration-only in Edit mode; Play keeps the live team/role surface read-focused, and section continuity makes the replacement workflow one mode switch away.\n'''
)
