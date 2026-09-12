import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_TEST_PORT || 4174);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server = null;
let browser = null;

async function waitForServer(target, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(target);
      if (response.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Table OS test server did not become ready at ${target}`);
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer(url);
  }

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const launcher = page.getByRole('button', { name: '高级桌游助手' });
  assert.ok(await launcher.isVisible(), 'Table OS launcher is always available');
  await launcher.click();
  assert.ok(await page.getByRole('dialog', { name: '高级桌游助手' }).isVisible());
  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'main game roster is synchronized on first open');

  // Apply a cooperative template and exercise shared/player trackers.
  await page.locator('[data-os-template]').selectOption('coop-crisis');
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  assert.ok(await page.getByDisplayValue('威胁').isVisible());
  assert.ok(await page.getByDisplayValue('个人生命').isVisible());
  const threatPlus = page.locator('[data-os-tracker-delta]').filter({ hasText: '+' }).first();
  await threatPlus.click();
  assert.equal(await page.locator('[data-os-tracker-value]').first().inputValue(), '1');

  // Phase engine advances and wraps through an explicit cycle counter.
  await page.getByRole('button', { name: '阶段', exact: true }).click();
  const activeBefore = await page.locator('.tableos-phase.active input').first().inputValue();
  await page.getByRole('button', { name: /下一步/ }).click();
  const activeAfter = await page.locator('.tableos-phase.active input').first().inputValue();
  assert.notEqual(activeAfter, activeBefore);

  // Teams and private-role reveal are usable on a phone-sized viewport.
  await page.getByRole('button', { name: '团队与身份', exact: true }).click();
  assert.equal(await page.locator('.tableos-team').count(), 1);
  await page.locator('[data-os-team-member]').first().check();
  const firstRoleName = page.locator('[data-os-role-name]').first();
  const firstFaction = page.locator('[data-os-role-faction]').first();
  await firstRoleName.fill('侦察员');
  await firstRoleName.blur();
  await firstFaction.fill('守护者');
  await firstFaction.blur();
  await page.locator('[data-os-role-reveal]').first().click();
  assert.ok(await page.getByText('侦察员', { exact: true }).isVisible());
  assert.ok(await page.getByText('守护者', { exact: true }).isVisible());
  await page.getByRole('button', { name: '隐藏身份' }).click();

  // Formula scoring is safe, editable and recalculates immediately.
  await page.locator('[data-os-template]').selectOption('engine-score');
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  const manualInputs = page.locator('[data-os-score-value]');
  await manualInputs.nth(0).fill('12');
  await manualInputs.nth(0).blur();
  await manualInputs.nth(1).fill('4');
  await manualInputs.nth(1).blur();
  await manualInputs.nth(2).fill('0');
  await manualInputs.nth(2).blur();
  await manualInputs.nth(3).fill('3');
  await manualInputs.nth(3).blur();
  const firstScoreCard = page.locator('.tableos-score-table > article').first();
  assert.ok(await firstScoreCard.getByText(/总分/).isVisible());
  assert.equal(await firstScoreCard.locator('output').last().textContent(), '13');

  // Campaign data persists across reloads while session state remains local.
  await page.locator('[data-os-template]').selectOption('campaign');
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '战役', exact: true }).click();
  await page.locator('[data-os-campaign="name"]').fill('周五战役');
  await page.locator('[data-os-campaign="name"]').blur();
  await page.getByRole('button', { name: '添加检查点' }).click();
  const flagName = page.locator('[data-os-flag-name]').first();
  await flagName.fill('开启北门');
  await flagName.blur();
  await page.locator('[data-os-flag-toggle]').first().check();

  await page.getByRole('button', { name: '关闭' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '高级桌游助手' }).click();
  await page.getByRole('button', { name: '战役', exact: true }).click();
  assert.equal(await page.locator('[data-os-campaign="name"]').inputValue(), '周五战役');
  assert.equal(await page.locator('[data-os-flag-name]').first().inputValue(), '开启北门');
  assert.equal(await page.locator('[data-os-flag-toggle]').first().isChecked(), true);

  // English UI follows the main document language dynamically.
  await page.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '界面语言' }).click();
  assert.equal(await page.getByRole('button', { name: 'Advanced Table Assistant' }).textContent(), 'Table OS');

  assert.equal(errors.length, 0, `Table OS console errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({
    event: 'table-os-e2e-summary',
    status: 'PASS',
    checks: [
      'launcher', 'roster sync', 'mechanism template', 'universal trackers', 'phase engine',
      'team membership', 'private role reveal', 'formula score sheet', 'campaign persistence', 'dynamic bilingual UI'
    ]
  }, null, 2));
}

run().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
