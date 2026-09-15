import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.ARCHIVE_DELETE_TEST_PORT || 4183);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server;
let browser;

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Archive delete E2E server did not become ready at ${url}`);
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer();
  }

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors = [];
  const confirmMessages = [];
  let dismissArchiveDelete = false;

  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() !== 'confirm') return dialog.accept();
    const message = dialog.message();
    confirmMessages.push(message);
    if (dismissArchiveDelete && /历史对局|archived game/i.test(message)) {
      dismissArchiveDelete = false;
      await dialog.dismiss();
      return;
    }
    await dialog.accept();
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: '开始桌游局' }).click();
  await page.getByRole('tab', { name: '结算', exact: true }).click();
  await page.getByRole('button', { name: '结束本局' }).click();

  assert.equal(await page.locator('.archive-item').count(), 1, 'finishing a game creates one archive entry');
  const beforeDelete = await page.evaluate(() => localStorage.getItem('board-game-assistant-archive-v1'));
  assert.ok(beforeDelete, 'archive is persisted before delete safety checks');

  await page.locator('.archive-item summary').first().click();
  const deleteButton = page.locator('[data-archive-delete]').first();
  dismissArchiveDelete = true;
  const confirmCountBeforeCancel = confirmMessages.length;
  await deleteButton.click();

  assert.equal(confirmMessages.length, confirmCountBeforeCancel + 1, 'single-entry archive deletion asks for confirmation');
  assert.match(confirmMessages.at(-1), /删除后无法恢复/, 'archive delete confirmation discloses irreversibility');
  assert.equal(await page.locator('.archive-item').count(), 1, 'canceling keeps the archived game visible');
  assert.equal(await page.evaluate(() => localStorage.getItem('board-game-assistant-archive-v1')), beforeDelete, 'canceling leaves persisted archive data unchanged');

  await page.locator('[data-archive-delete]').first().click();
  assert.equal(await page.locator('.archive-item').count(), 0, 'confirming deletes the archived game');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-archive-v1') || '[]')), [], 'confirmed deletion removes the persisted archive entry');

  assert.deepEqual(errors, []);
  await context.close();
  console.log(JSON.stringify({ event: 'archive-delete-safety-e2e-summary', status: 'PASS' }));
}

run().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
