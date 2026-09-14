from pathlib import Path


def replace_once(path_str, old, new):
    path = Path(path_str)
    text = path.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'missing anchor in {path_str}')
    path.write_text(text.replace(old, new, 1))


replace_once(
    'src/tabletop.js',
    "    if (d.osMode) { state.ui.mode = d.osMode === 'edit' ? 'edit' : 'play'; state.ui.activeSection = 'overview'; saveAndRender(); return; }",
    "    if (d.osMode) {\n      state.ui.mode = d.osMode === 'edit' ? 'edit' : 'play';\n      if (!visibleSections().includes(state.ui.activeSection)) state.ui.activeSection = 'overview';\n      saveAndRender();\n      return;\n    }"
)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  await editMode(page);\n  await page.getByRole('button', { name: '阶段', exact: true }).click();\n  await page.locator('[data-os-remove-phase]').first().click();",
    "  await editMode(page);\n  assert.equal(await page.getByRole('button', { name: '阶段', exact: true }).getAttribute('aria-current'), 'page', 'switching to Edit preserves the current live section');\n  assert.ok(await page.locator('[data-os-remove-phase]').first().isVisible(), 'phase editor stays in context after switching to Edit');\n  await page.locator('[data-os-remove-phase]').first().click();"
)

replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "  await activeChecklistEditor.blur();\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  await page.getByRole('button', { name: '阶段', exact: true }).click();\n  const phaseChecklistItems = page.locator('[data-os-phase-check]');",
    "  await activeChecklistEditor.blur();\n  await page.getByRole('button', { name: '牌局模式' }).click();\n  assert.equal(await page.getByRole('button', { name: '阶段', exact: true }).getAttribute('aria-current'), 'page', 'switching back to Play preserves the configured section');\n  const phaseChecklistItems = page.locator('[data-os-phase-check]');"
)

replace_once(
    'tests/e2e/run-table-os-entities-e2e.js',
    "  await page.getByRole('button', { name: '编辑配置' }).click();\n  await page.locator(`[data-os-remove-entity=\"${bossId}\"]`).click();",
    "  await page.getByRole('button', { name: '编辑配置' }).click();\n  await page.getByRole('button', { name: '总览', exact: true }).click();\n  await page.locator(`[data-os-remove-entity=\"${bossId}\"]`).click();"
)

doc = Path('docs/TABLE_OS_TEST_MATRIX.md')
text = doc.read_text()
anchor = "- Advanced configuration must remain reachable in one action through Edit mode.\n"
addition = anchor + "- Switching Play/Edit mode must preserve the current module when that module exists in both modes; only unavailable Play sections may fall back to Overview.\n"
if addition not in text:
    if anchor not in text:
        raise SystemExit('missing test matrix anchor')
    text = text.replace(anchor, addition, 1)
section = "\n### Play/Edit section continuity\n\n- Chromium: switching from a live Phase surface into Edit setup keeps Phase selected and exposes its editor immediately; switching back to Play keeps the same Phase surface without an extra navigation tap.\n- Fallback: sections that are intentionally hidden in Play mode may still return to Overview, so continuity never exposes empty/config-only modules.\n"
if '### Play/Edit section continuity' not in text:
    text += section
doc.write_text(text)
