from pathlib import Path

path = Path('tests/e2e/run-table-os-e2e.js')
source = path.read_text()
before = "  assert.equal(JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).players.length, 4, 'bulk roster never mutates the main game roster');"
after = "  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).players.length), 4, 'bulk roster never mutates the main game roster');"
if source.count(before) != 1:
    raise RuntimeError(f'expected one E2E assertion target, found {source.count(before)}')
path.write_text(source.replace(before, after, 1))
print('bulk roster E2E assertion fixed')
