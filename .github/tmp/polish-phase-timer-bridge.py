from pathlib import Path

# One-shot branch polish after the focused bridge migration.
def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected one anchor, found {text.count(old)}')
    p.write_text(text.replace(old, new, 1))

replace_once('src/tabletop.css', '  color: var(--tableos-muted);', '  color: #64748b;')
replace_once(
    'tests/e2e/run-table-os-e2e.js',
    "'phase engine', 'phase checklist lifecycle',\n      'toolbox-team bridge'",
    "'phase engine', 'phase checklist lifecycle', 'phase timer bridge',\n      'toolbox-team bridge'"
)
print('phase timer bridge polish applied')
