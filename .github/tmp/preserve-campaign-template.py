from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1))


core_old = """function resetTemplateModules(state) {
  state.trackers = [];
  state.phases = { items: [], activeIndex: 0, cycle: 1 };
  state.teams = [];
  state.roles = [];
  state.scoreSheet = { fields: [], values: {} };
  state.campaign = { enabled: false, name: '', chapter: '', sessionNumber: 1, notes: '', flags: [] };
}
"""
core_new = """function resetTemplateModules(state) {
  state.trackers = [];
  state.phases = { items: [], activeIndex: 0, cycle: 1 };
  state.teams = [];
  state.roles = [];
  state.scoreSheet = { fields: [], values: {} };
}
"""
replace_once("src/tabletop-core.js", core_old, core_new)
replace_once(
    "src/tabletop-core.js",
    "  state.campaign.enabled = Boolean(template.campaign);\n",
    "  // Templates may enable campaign support, but must never silently erase or disable persistent campaign memory.\n  if (template.campaign) state.campaign.enabled = true;\n",
)

e2e_old = """  assert.ok(await page.getByText('周五战役', { exact: true }).isVisible());
  assert.ok(await page.getByText('开启北门', { exact: true }).isVisible());

  // English UI follows the main language dynamically.
"""
e2e_new = """  assert.ok(await page.getByText('周五战役', { exact: true }).isVisible());
  assert.ok(await page.getByText('开启北门', { exact: true }).isVisible());

  // Changing setup templates must not silently destroy persistent campaign memory.
  await editMode(page);
  await page.locator('[data-os-template]').selectOption('engine-score');
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '战役', exact: true }).click();
  assert.ok(await page.getByText('周五战役', { exact: true }).isVisible(), 'campaign name survives template application');
  assert.ok(await page.getByText('开启北门', { exact: true }).isVisible(), 'campaign checkpoints survive template application');

  // English UI follows the main language dynamically.
"""
replace_once("tests/e2e/run-table-os-e2e.js", e2e_old, e2e_new)

replace_once(
    "docs/TABLE_OS_TEST_MATRIX.md",
    "| Node unit tests | roster sync, participant bounds, templates, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |",
    "| Node unit tests | roster sync, participant bounds, templates, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |",
)
replace_once(
    "docs/TABLE_OS_TEST_MATRIX.md",
    "| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, dynamic bilingual UI |",
    "| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across template changes, dynamic bilingual UI |",
)
replace_once(
    "docs/TABLE_OS_TEST_MATRIX.md",
    "- `campaign` trackers must survive New scenario / rematch; `session` trackers must reset to their initial values.\n",
    "- `campaign` trackers must survive New scenario / rematch; `session` trackers must reset to their initial values.\n- Applying a setup template must not erase or silently disable persistent campaign metadata, notes or checkpoints.\n",
)
