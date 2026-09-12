import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_ARCHIVE_TEST_PORT || 4176);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server = null;
let browser = null;

async function waitForServer(target, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const response = await fetch(target); if (response.ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Archive bridge test server did not become ready at ${target}`);
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer(url);
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '开始桌游局' }).click();

  await page.getByRole('button', { name: '高级桌游助手' }).click();
  await page.getByRole('button', { name: '编辑配置' }).click();
  await page.locator('[data-os-template]').selectOption('engine-score');
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  const values = page.locator('[data-os-score-value]');
  await values.nth(0).fill('12'); await values.nth(0).blur();
  await values.nth(1).fill('4'); await values.nth(1).blur();
  await values.nth(2).fill('0'); await values.nth(2).blur();
  await values.nth(3).fill('3'); await values.nth(3).blur();
  await page.getByRole('button', { name: '关闭' }).click();

  await page.getByRole('tab', { name: '结算' }).click();
  await page.getByRole('button', { name: '结束本局' }).click();
  await page.getByText('本局结果已存入历史对局').waitFor();

  const archived = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-archive-v1') || '[]'));
  assert.equal(archived.length, 1);
  assert.ok(archived[0].tableOs, 'finished archive contains a Table OS summary');
  assert.equal(archived[0].tableOs.scores[0].total, 13);
  assert.equal(JSON.stringify(archived[0].tableOs).includes('roles'), false);
  assert.ok(await page.getByText('Table OS 摘要', { exact: true }).isVisible());
  assert.ok(await page.getByText('高级计分', { exact: true }).isVisible());

  console.log(JSON.stringify({ event: 'table-os-archive-e2e-summary', status: 'PASS', checks: ['session-bound snapshot', 'advanced score archived', 'private roles excluded', 'archive summary rendered'] }, null, 2));
  await context.close();
}

run().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
