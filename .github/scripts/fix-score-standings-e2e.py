from pathlib import Path

path = Path('tests/e2e/run-table-os-e2e.js')
text = path.read_text()
anchor = "  const highStandings = page.locator('[data-os-score-rank]');\n"
replacement = anchor + "  const firstScoredParticipantId = (await manualInputs.nth(0).getAttribute('data-os-score-value')).split('|')[0];\n"
if anchor not in text:
    raise SystemExit('missing high standings anchor')
text = text.replace(anchor, replacement, 1)

include_anchor = "  const renamedFormula = page.locator('[data-os-score-formula]').first();\n"
include_replacement = include_anchor + "  await page.locator('[data-os-score-total]').last().check();\n"
if include_anchor not in text:
    raise SystemExit('missing formula include anchor')
text = text.replace(include_anchor, include_replacement, 1)

old = "  assert.equal(await page.locator('[data-os-score-rank]').first().getAttribute('data-rank'), '', 'invalid included formulas do not produce a misleading rank');"
new = "  assert.equal(await page.locator('[data-os-score-rank=\"' + firstScoredParticipantId + '\"]').getAttribute('data-rank'), '', 'invalid included formulas do not produce a misleading rank');"
if old not in text:
    raise SystemExit('missing invalid-rank assertion anchor')
path.write_text(text.replace(old, new, 1))
