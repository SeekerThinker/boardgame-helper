import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_STATUS_TEST_PORT || 4178);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server = null;
let browser = null;

async function waitForServer(target, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const response = await fetch(target); if (response.ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Status E2E server did not become ready at ${target}`);
}

async function openTableOs(page) {
  await page.getByRole('button', { name: /高级桌游助手|Advanced Table Assistant/ }).click();
}

async function editMode(page) {
  await page.getByRole('button', { name: /编辑配置|Edit setup/ }).click();
}

async function applyTemplate(page, id) {
  await editMode(page);
  await page.locator('[data-os-template]').selectOption(id);
  await page.getByRole('button', { name: /应用模板|Apply/, exact: true }).click();
}

async function runStatusFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors = [];
  const prompts = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(prompts.shift() || dialog.defaultValue() || '');
    else await dialog.accept();
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await openTableOs(page);

  await applyTemplate(page, 'card-battle');
  await page.getByRole('button', { name: '状态', exact: true }).click();
  const poisoned = page.locator('.tableos-module').filter({ hasText: '中毒' }).first();
  const stunned = page.locator('.tableos-module').filter({ hasText: '眩晕' }).first();
  assert.ok(await poisoned.isVisible(), 'card battle exposes Poisoned as a boolean status');
  assert.ok(await stunned.isVisible(), 'card battle exposes Stunned as a boolean status');
  const poisonedToggle = poisoned.locator('[data-os-status-toggle]').first();
  assert.equal(await poisonedToggle.getAttribute('aria-pressed'), 'false');
  await poisonedToggle.click();
  assert.equal(await poisonedToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1'));
    const status = stored.statuses.find(item => item.name === '中毒');
    return Object.values(status.values).some(Boolean);
  }), true, 'live status values persist in the Table OS session state');

  await page.getByRole('button', { name: '新场景 / 下一局' }).click();
  assert.equal(await poisonedToggle.getAttribute('aria-pressed'), 'false', 'new scenario restores the false default');

  await applyTemplate(page, 'hidden-role');
  await page.getByRole('button', { name: '状态', exact: true }).click();
  const alive = page.locator('.tableos-module').filter({ hasText: '存活' }).first();
  const aliveToggle = alive.locator('[data-os-status-toggle]').first();
  assert.equal(await aliveToggle.getAttribute('aria-pressed'), 'true', 'Alive starts on by default');
  await aliveToggle.click();
  assert.equal(await aliveToggle.getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: '新场景 / 下一局' }).click();
  assert.equal(await aliveToggle.getAttribute('aria-pressed'), 'true', 'reset restores a true default as well');

  await editMode(page);
  await page.getByRole('button', { name: '状态', exact: true }).click();
  await page.getByRole('button', { name: '添加状态' }).click();
  const customName = page.locator('[data-os-status-name]').last();
  await customName.fill('目标完成');
  await customName.blur();
  const customId = await customName.getAttribute('data-os-status-name');
  assert.ok(customId);
  await page.locator(`[data-os-status-scope="${customId}"]`).selectOption('global');
  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '状态', exact: true }).click();
  const objective = page.locator('.tableos-module').filter({ hasText: '目标完成' }).first();
  const objectiveToggle = objective.locator('[data-os-status-toggle]').first();
  await objectiveToggle.click();
  assert.equal(await objectiveToggle.getAttribute('aria-pressed'), 'true');

  await editMode(page);
  prompts.push('状态模板');
  await page.getByRole('button', { name: '保存当前配置' }).click();
  const templateSnapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-user-templates-v1'))[0]);
  const savedObjective = templateSnapshot.statuses.find(item => item.name === '目标完成');
  assert.deepEqual(savedObjective, { name: '目标完成', scope: 'global', initial: false }, 'My Templates store only status structure');
  assert.equal(JSON.stringify(templateSnapshot.statuses).includes('values'), false, 'My Templates exclude live status values');

  await page.getByRole('button', { name: '应用我的模板' }).click();
  await page.getByRole('button', { name: '状态', exact: true }).click();
  const freshObjective = page.locator('.tableos-module').filter({ hasText: '目标完成' }).first().locator('[data-os-status-toggle]').first();
  assert.equal(await freshObjective.getAttribute('aria-pressed'), 'false', 'applying My Template starts from the saved default, not prior live state');
  await freshObjective.click();
  await page.reload({ waitUntil: 'networkidle' });
  await openTableOs(page);
  await page.getByRole('button', { name: '状态', exact: true }).click();
  assert.equal(await page.locator('.tableos-module').filter({ hasText: '目标完成' }).first().locator('[data-os-status-toggle]').first().getAttribute('aria-pressed'), 'true', 'live status survives reload within the same session');

  assert.deepEqual(errors, [], `browser should stay error-free: ${errors.join(' | ')}`);
  await context.close();
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer(url);
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  await runStatusFlow();
  console.log(JSON.stringify({ event: 'table-os-status-e2e-summary', status: 'PASS', checks: ['built-in statuses', 'toggle persistence', 'scenario reset defaults', 'custom status', 'My Templates status privacy', 'reload persistence'] }, null, 2));
}

run().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
