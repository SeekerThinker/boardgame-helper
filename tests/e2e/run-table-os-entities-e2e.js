import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_ENTITY_TEST_PORT || 4180);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server;
let browser;

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Entity E2E server did not become ready at ${url}`);
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
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '高级桌游助手' }).click();
  await page.getByRole('button', { name: '编辑配置' }).click();
  await page.getByRole('button', { name: '添加实体' }).click();
  await page.getByRole('button', { name: '添加实体' }).click();
  const names = page.locator('[data-os-entity-name]');
  await names.nth(0).fill('Boss'); await names.nth(0).blur();
  await names.nth(1).fill('祭坛'); await names.nth(1).blur();
  const bossId = await names.nth(0).getAttribute('data-os-entity-name');
  assert.ok(bossId);

  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  await page.getByRole('button', { name: '添加追踪器' }).click();
  const trackerName = page.locator('[data-os-tracker-name]').last();
  await trackerName.fill('生命'); await trackerName.blur();
  const trackerId = await trackerName.getAttribute('data-os-tracker-name');
  await page.locator(`[data-os-tracker-scope="${trackerId}"]`).selectOption('entity');

  await page.getByRole('button', { name: '状态', exact: true }).click();
  await page.getByRole('button', { name: '添加状态' }).click();
  const statusName = page.locator('[data-os-status-name]').last();
  await statusName.fill('眩晕'); await statusName.blur();
  const statusId = await statusName.getAttribute('data-os-status-name');
  await page.locator(`[data-os-status-scope="${statusId}"]`).selectOption('entity');

  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  const hp = page.locator('.tableos-module').filter({ hasText: '生命' }).first();
  assert.deepEqual(await hp.locator('.tableos-counter > span').allTextContents(), ['Boss', '祭坛']);
  await hp.locator('[data-os-tracker-delta]').filter({ hasText: '+' }).first().click();
  await page.getByRole('button', { name: '状态', exact: true }).click();
  const stunned = page.locator('.tableos-module').filter({ hasText: '眩晕' }).first();
  const toggle = stunned.locator('[data-os-status-toggle]').filter({ hasText: 'Boss' }).first();
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');

  await page.getByRole('button', { name: '编辑配置' }).click();
  await page.getByRole('button', { name: '总览', exact: true }).click();
  await page.locator(`[data-os-remove-entity="${bossId}"]`).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.deepEqual(stored.entities.map(item => item.name), ['祭坛']);
  assert.equal(Object.hasOwn(stored.trackers.find(item => item.id === trackerId).values, bossId), false);
  assert.equal(Object.hasOwn(stored.statuses.find(item => item.id === statusId).values, bossId), false);
  assert.equal(JSON.stringify(stored).includes(bossId), false);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(JSON.stringify({ event: 'table-os-entities-e2e-summary', status: 'PASS' }));
}

run().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
