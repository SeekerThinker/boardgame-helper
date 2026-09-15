from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    file.write_text(text.replace(old, new, 1))


path = 'src/tabletop.js'
replace_once(path, "export: '导出', import: '导入'", "export: '导出完整备份', import: '导入'")
replace_once(path, "export: 'Export', import: 'Import'", "export: 'Export full backup', import: 'Import'")
replace_once(
    path,
    "imported: '已导入高级助手数据。', importFailed: '导入失败：文件不是有效的桌面 OS 数据。', exported: '已导出。', synced: '已同步当前对局玩家。',",
    "imported: '已导入高级助手数据。', importFailed: '导入失败：文件不是有效的桌面 OS 数据。', exported: '已导出完整备份。', confirmExportBackup: '完整备份会包含当前 Table OS 的全部本机数据；如果已设置，也会包含私密身份/阵营、主持备注、当前计分与状态/追踪值，以及战役记录。请只保存到可信位置；分享前请先检查文件内容。继续导出吗？', synced: '已同步当前对局玩家。',"
)
replace_once(
    path,
    "imported: 'Advanced assistant data imported.', importFailed: 'Import failed: this is not valid Table OS data.', exported: 'Exported.', synced: 'Game roster synced.',",
    "imported: 'Advanced assistant data imported.', importFailed: 'Import failed: this is not valid Table OS data.', exported: 'Full backup exported.', confirmExportBackup: 'A full backup contains all local Table OS data. If configured, that includes private roles/factions, moderator notes, current scores and status/tracker values, and campaign records. Keep it in a trusted location and inspect the file before sharing it. Continue exporting?', synced: 'Game roster synced.',"
)
replace_once(
    path,
    "    if (d.osAction === 'export') { exportState(); return; }",
    "    if (d.osAction === 'export') { if (confirm(tr('confirmExportBackup'))) exportState(); return; }"
)

test_path = 'tests/e2e/run-table-os-e2e.js'
replace_once(
    test_path,
    "import { spawn } from 'node:child_process';\nimport assert from 'node:assert/strict';",
    "import { spawn } from 'node:child_process';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';"
)
replace_once(
    test_path,
    "  const confirmMessages = [];\n  let dismissNextConfirm = false;\n  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });",
    "  const confirmMessages = [];\n  let dismissNextConfirm = false;\n  let downloadCount = 0;\n  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });\n  page.on('download', () => { downloadCount += 1; });"
)
marker = "  await firstModeratorNote.fill('主持人机密：夜晚第二个行动'); await firstModeratorNote.blur();\n  await page.getByRole('button', { name: '牌局模式' }).click();"
insert = """  await firstModeratorNote.fill('主持人机密：夜晚第二个行动'); await firstModeratorNote.blur();

  // Full backup export is explicitly privacy-sensitive: cancel produces no file, accept preserves restorable private data.
  await page.getByRole('button', { name: '总览', exact: true }).click();
  const exportButton = page.getByRole('button', { name: '导出完整备份', exact: true });
  const exportConfirmCount = confirmMessages.length;
  const beforeCanceledExport = await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1'));
  dismissNextConfirm = true;
  await exportButton.click();
  await page.waitForTimeout(100);
  assert.equal(confirmMessages.length, exportConfirmCount + 1, 'full backup export asks for explicit privacy confirmation');
  assert.match(confirmMessages.at(-1), /私密身份\/阵营/);
  assert.match(confirmMessages.at(-1), /主持备注/);
  assert.match(confirmMessages.at(-1), /状态\/追踪值/);
  assert.match(confirmMessages.at(-1), /战役记录/);
  assert.equal(downloadCount, 0, 'canceling full backup export creates no download');
  assert.equal(await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1')), beforeCanceledExport, 'canceling export leaves Table OS persistence byte-identical');

  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const backupDownload = await downloadPromise;
  assert.equal(downloadCount, 1, 'accepted full backup export creates exactly one download');
  assert.match(backupDownload.suggestedFilename(), /^boardgame-table-os-\\d{4}-\\d{2}-\\d{2}\\.json$/);
  const backupPath = await backupDownload.path();
  assert.ok(backupPath, 'accepted full backup has a readable local download path');
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  const exportedRole = backup.roles.find(role => role.participantId === backup.participants[0]?.id);
  assert.equal(exportedRole?.role, '侦察员', 'full backup keeps the private role needed for restore');
  assert.equal(exportedRole?.faction, '守护者', 'full backup keeps the private faction needed for restore');
  assert.equal(exportedRole?.note, '主持人机密：夜晚第二个行动', 'full backup keeps moderator notes needed for restore');

  await page.getByRole('button', { name: '牌局模式' }).click();"""
replace_once(test_path, marker, insert)

doc = Path('docs/TABLE_OS_TEST_MATRIX.md')
text = doc.read_text().rstrip()
section = '''\n\n### Full backup export privacy\n\n- Edit setup labels the action as a full backup rather than a generic export, because the JSON is intentionally restorable rather than share-sanitized.\n- Privacy disclosure: every full-backup export confirms that configured private roles/factions, moderator notes, live scores/status/tracker values, and campaign records may be included and should be kept in a trusted location / inspected before sharing.\n- Chromium: canceling the confirmation creates no download and leaves persisted Table OS state byte-identical; accepting creates exactly one dated JSON backup and proves private role/faction/moderator-note content remains present for restore semantics.\n'''
if '### Full backup export privacy' in text:
    raise SystemExit('docs section already exists')
doc.write_text(text + section)
