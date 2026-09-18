from pathlib import Path


def replace_once(path, before, after):
    file = Path(path)
    text = file.read_text()
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one anchor, got {count}: {before[:70]}')
    file.write_text(text.replace(before, after))

replace_once('index.html',
    '  <link rel="stylesheet" href="./src/tabletop-companion.css">',
    '  <link rel="stylesheet" href="./src/tabletop-companion.css">\n  <link rel="stylesheet" href="./src/secret-dealer.css">')
replace_once('index.html',
    '  <script type="module" src="./src/tabletop-companion.js"></script>',
    '  <script type="module" src="./src/tabletop-companion.js"></script>\n  <script type="module" src="./src/secret-dealer.js"></script>')
replace_once('sw.js',
    "  'src/tabletop-companion.js', 'src/tabletop-companion.css', 'src/tabletop-archive-bridge.js'",
    "  'src/tabletop-companion.js', 'src/tabletop-companion.css', 'src/tabletop-archive-bridge.js',\n  'src/secret-dealer.js', 'src/secret-dealer-core.js', 'src/secret-dealer.css'")
replace_once('package.json',
    'node tests/e2e/run-table-os-archive-e2e.js",',
    'node tests/e2e/run-table-os-archive-e2e.js && node tests/e2e/run-secret-dealer-e2e.js",')
replace_once('.github/workflows/pages.yml',
    '          test -f dist/src/tabletop-archive-bridge.js',
    '          test -f dist/src/tabletop-archive-bridge.js\n          test -f dist/src/secret-dealer.js\n          test -f dist/src/secret-dealer-core.js\n          test -f dist/src/secret-dealer.css')
replace_once('.github/workflows/pages.yml',
    '          fetch \'src/tabletop-archive-bridge.js\' "$RUNNER_TEMP/tabletop-archive-bridge.js"',
    '          fetch \'src/tabletop-archive-bridge.js\' "$RUNNER_TEMP/tabletop-archive-bridge.js"\n          fetch \'src/secret-dealer.js\' "$RUNNER_TEMP/secret-dealer.js"\n          fetch \'src/secret-dealer-core.js\' "$RUNNER_TEMP/secret-dealer-core.js"\n          fetch \'src/secret-dealer.css\' "$RUNNER_TEMP/secret-dealer.css"')
replace_once('.github/workflows/pages.yml',
    "          grep -q 'tabletop-archive-bridge.js' \"$RUNNER_TEMP/sw.js\"",
    "          grep -q 'tabletop-archive-bridge.js' \"$RUNNER_TEMP/sw.js\"\n          grep -q 'secret-dealer.js' \"$RUNNER_TEMP/index.html\"\n          grep -q 'secret-dealer.js' \"$RUNNER_TEMP/sw.js\"\n          grep -q 'secret-dealer-core.js' \"$RUNNER_TEMP/secret-dealer.js\"")

ui = Path('src/secret-dealer.js')
text = ui.read_text()
for before, after in [
    ("let stage = 'cover';\nlet error = '';", "let stage = 'cover';\nlet viewedAndHidden = false;\nlet error = '';"),
    ("  stage = 'cover';\n  error = '';", "  stage = 'cover';\n  viewedAndHidden = false;\n  error = '';"),
    ("${deal && playerIndex < deal.length && stage === 'cover' ?", "${deal && playerIndex < deal.length && stage === 'cover' && viewedAndHidden ?"),
    ("if (action === 'hide' && stage === 'shown') { stage = 'cover'; render('next'); return; }", "if (action === 'hide' && stage === 'shown') { stage = 'cover'; viewedAndHidden = true; render('next'); return; }"),
    ("if (action === 'next' && stage === 'cover' && playerIndex < deal.length) { playerIndex += 1; render(playerIndex < deal.length ? 'arm' : 'clear'); return; }", "if (action === 'next' && stage === 'cover' && viewedAndHidden && playerIndex < deal.length) { playerIndex += 1; viewedAndHidden = false; render(playerIndex < deal.length ? 'arm' : 'clear'); return; }")
]:
    if text.count(before) != 1:
        raise RuntimeError(f'secret-dealer.js: expected one anchor, got {text.count(before)}: {before}')
    text = text.replace(before, after)
ui.write_text(text)

spec = Path('tests/e2e/run-secret-dealer-e2e.js')
text = spec.read_text()
before = "    await root.locator('[data-secret-action=\"arm\"]').click();\n    await checkNoSecrets(page, secrets);"
after = "    assert.equal(await root.locator('[data-secret-action=\"next\"]').count(), 0, 'cannot skip an unseen private card');\n    await root.locator('[data-secret-action=\"arm\"]').click();\n    await checkNoSecrets(page, secrets);"
if text.count(before) != 1:
    raise RuntimeError('e2e missing guard anchor')
spec.write_text(text.replace(before, after))

print('Integrated generic secret dealer into PWA, CI and Pages; guarded against skipping unseen cards.')
