import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_IMPORT_TEST_PORT || 4181);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server;
let browser;

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Table OS import E2E server did not become ready at ${url}`);
}

function jsonFile(name, text) {
  return { name, mimeType: 'application/json', buffer: Buffer.from(text) };
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer();
  }

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors = [];
  const confirmMessages = [];
  let dismissNextConfirm = false;

  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    assert.equal(dialog.type(), 'confirm');
    confirmMessages.push(dialog.message());
    if (dismissNextConfirm) {
      dismissNextConfirm = false;
      await dialog.dismiss();
    } else {
      await dialog.accept();
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '高级桌游助手' }).click();
  await page.getByRole('button', { name: '编辑配置' }).click();

  await page.getByRole('button', { name: '添加实体' }).click();
  const entityName = page.locator('[data-os-entity-name]').first();
  await entityName.fill('当前 Boss');
  await entityName.blur();

  const beforeRaw = await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1'));
  assert.ok(beforeRaw);
  const importPayload = await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1'));
    current.participants[0].name = 'Imported Player';
    current.entities[0].name = 'Imported Relic';
    current.campaign.enabled = true;
    current.campaign.name = 'Imported Campaign';
    current.campaign.notes = 'Imported persistent note';
    return JSON.stringify(current);
  });

  const input = page.locator('#tableos-import-file');
  dismissNextConfirm = true;
  await input.setInputFiles(jsonFile('table-os-valid.json', importPayload));
  await page.waitForFunction(() => document.querySelector('#tableos-import-file')?.files?.length === 0);

  assert.equal(await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1')), beforeRaw, 'canceling a valid import leaves persisted Table OS data unchanged');
  assert.equal(confirmMessages.length, 1, 'a valid import asks for one overwrite confirmation');
  assert.match(confirmMessages[0], /替换当前 Table OS 工作区/, 'import confirmation identifies the workspace replacement');
  assert.match(confirmMessages[0], /参与者.*战役记录/, 'import confirmation discloses the broad data scope being replaced');
  assert.match(confirmMessages[0], /无法撤销/, 'import confirmation discloses irreversibility');

  await page.locator('#tableos-import-file').setInputFiles(jsonFile('table-os-valid.json', importPayload));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')).campaign?.name === 'Imported Campaign');
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.equal(imported.participants[0].name, 'Imported Player');
  assert.equal(imported.entities[0].name, 'Imported Relic');
  assert.equal(imported.campaign.notes, 'Imported persistent note');
  assert.equal(confirmMessages.length, 2, 'accepting the same valid import still uses the confirmation gate');
  assert.ok(await page.getByRole('button', { name: '编辑配置' }).isVisible(), 'successful import keeps the existing normalization rule that reopens Table OS in Play mode');

  const confirmsBeforeInvalid = confirmMessages.length;
  await page.getByRole('button', { name: '编辑配置' }).click();
  const beforeInvalidRaw = await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1'));
  await page.locator('#tableos-import-file').setInputFiles(jsonFile('broken.json', '{ definitely not valid json'));
  await page.getByText('导入失败：文件不是有效的桌面 OS 数据。', { exact: true }).waitFor();
  assert.equal(confirmMessages.length, confirmsBeforeInvalid, 'invalid files fail without a destructive-overwrite confirmation');
  assert.equal(await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1')), beforeInvalidRaw, 'invalid import attempts never change persisted Table OS data');

  assert.deepEqual(errors, []);
  await context.close();
  console.log(JSON.stringify({ event: 'table-os-import-safety-e2e-summary', status: 'PASS' }));
}

run().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
