from pathlib import Path

path = Path('tests/e2e/run-table-os-e2e.js')
text = path.read_text()
old = "  const activeChecklistEditor = page.locator('.tableos-phase.active [data-os-phase-checklist]');\n  await activeChecklistEditor.fill('处理阶段能力\\n补充公共资源');"
new = "  await page.locator('.tableos-phase.active .tableos-phase-checklist-editor > summary').click();\n  const activeChecklistEditor = page.locator('.tableos-phase.active [data-os-phase-checklist]');\n  await activeChecklistEditor.fill('处理阶段能力\\n补充公共资源');"
if text.count(old) != 1:
    raise SystemExit(f'expected one generated checklist E2E anchor, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('phase checklist E2E visibility fix applied')
