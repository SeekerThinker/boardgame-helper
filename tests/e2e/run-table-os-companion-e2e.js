import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_COMPANION_TEST_PORT || 4176);
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
  throw new Error(`Table OS companion test server did not become ready at ${target}`);
}

async function waitForTextChange(page, locator, initial, timeoutMs = 3_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await page.waitForTimeout(150);
    const current = await locator.textContent();
    if (current !== initial) return current;
  }
  return initial;
}

async function openTableOs(page) {
  await page.getByRole('button', { name: /高级桌游助手|Advanced Table Assistant/ }).click();
  await page.locator('.tableos-sheet').waitFor({ state: 'visible' });
}

async function runPrimaryFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // Start the main session and its timer so Table OS has live context to bridge.
  await page.locator('[data-action="start-session"]').click();
  await page.locator('[data-action="timer-toggle"]').click();
  await openTableOs(page);

  const mainContext = page.locator('[data-tableos-main-context]');
  await mainContext.waitFor({ state: 'visible' });
  const contextText = await mainContext.textContent();
  assert.match(contextText, /第 1 轮/);
  assert.match(contextText, /玩家 1/);
  assert.match(contextText, /进行中/);
  const timerText = page.locator('[data-tableos-main-time]');
  const firstTime = await timerText.textContent();
  const secondTime = await waitForTextChange(page, timerText, firstTime);
  assert.notEqual(secondTime, firstTime, 'main timer keeps ticking while Table OS is open');

  // Pause through the real bridge before simulating a persistent main-roster edit.
  await page.locator('[data-tableos-companion-action="flow"]').click();
  await page.locator('[data-action="timer-toggle"]').click();
  await openTableOs(page);
  assert.match(await mainContext.textContent(), /已暂停/);

  // Main-roster drift is detected without forcing a destructive automatic sync.
  await page.evaluate(() => {
    const key = 'board-game-assistant-state-v2';
    const game = JSON.parse(localStorage.getItem(key));
    game.players[0].name = 'Alice';
    localStorage.setItem(key, JSON.stringify(game));
  });
  const syncRoster = page.locator('[data-tableos-companion-action="sync"]');
  await syncRoster.waitFor({ state: 'visible' });
  assert.match(await mainContext.textContent(), /主对局玩家已变更/);
  await syncRoster.click();
  assert.ok(await page.getByText('已同步主对局玩家。', { exact: true }).isVisible());
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('board-game-assistant-table-os-v1');
    const table = raw ? JSON.parse(raw) : null;
    return Array.isArray(table?.participants)
      && table.participants.some(participant => participant?.sourcePlayerId && participant.name === 'Alice');
  });
  await syncRoster.waitFor({ state: 'detached' });

  // Start a useful live workspace without entering the editor.
  await page.locator('[data-os-quick-template="coop-crisis"]').click();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  let threat = page.locator('.tableos-module').filter({ hasText: '威胁' }).first();
  let threatValue = threat.locator('[data-os-tracker-value]').first();
  let plus = threat.locator('[data-os-tracker-delta]').filter({ hasText: '+' }).first();
  assert.match(await plus.getAttribute('aria-label'), /增加.*威胁/, 'tracker buttons expose contextual screen-reader labels');
  assert.match(await threatValue.getAttribute('aria-label'), /威胁/, 'direct tracker input includes tracker context');

  // High-frequency tracker taps are one-step reversible.
  await plus.click();
  assert.equal(await threatValue.inputValue(), '1');
  const undo = page.locator('[data-tableos-companion-action="undo"]');
  await undo.waitFor({ state: 'visible' });
  await undo.click();
  assert.equal(await threatValue.inputValue(), '0', 'tracker tap can be undone');
  assert.ok(await page.getByText('已撤销上一步。', { exact: true }).isVisible());

  // Direct numeric edits use the same safety path.
  await threatValue.fill('4');
  await threatValue.blur();
  assert.equal(await threatValue.inputValue(), '4');
  await page.locator('[data-tableos-companion-action="undo"]').click();
  assert.equal(await threatValue.inputValue(), '0', 'direct tracker edit can be undone');

  // Exact undo must restore the pre-tap value even when a large step clamps at the maximum.
  await page.getByRole('button', { name: '编辑配置' }).click();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  const threatEditor = page.locator('.tableos-module').filter({ has: page.locator('[data-os-tracker-name][value="威胁"]') }).first();
  const threatStep = threatEditor.locator('[data-os-tracker-step]').first();
  await threatStep.fill('10');
  await threatStep.blur();
  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  threat = page.locator('.tableos-module').filter({ hasText: '威胁' }).first();
  threatValue = threat.locator('[data-os-tracker-value]').first();
  plus = threat.locator('[data-os-tracker-delta]').filter({ hasText: '+' }).first();
  await threatValue.fill('95');
  await threatValue.blur();
  await plus.click();
  assert.equal(await threatValue.inputValue(), '99', 'large tracker step clamps at max');
  await page.locator('[data-tableos-companion-action="undo"]').click();
  assert.equal(await threatValue.inputValue(), '95', 'clamped tracker tap restores the exact prior value');

  // Phase changes are reversible, including the lower cycle boundary where inverse navigation is not symmetric.
  await page.getByRole('button', { name: '阶段', exact: true }).click();
  const firstPhase = await page.locator('.tableos-phase.active strong').textContent();
  const phaseButton = page.locator('[data-os-phase-active]').first();
  assert.match(await phaseButton.getAttribute('aria-label'), /切换到阶段/, 'phase buttons have descriptive labels');
  const phaseHeading = page.locator('.tableos-card-head h3').first();
  assert.match(await phaseHeading.textContent(), /循环 1/);
  await page.getByRole('button', { name: /上一步/ }).click();
  assert.notEqual(await page.locator('.tableos-phase.active strong').textContent(), firstPhase);
  assert.match(await phaseHeading.textContent(), /循环 1/, 'previous at cycle 1 stays at cycle 1');
  await page.locator('[data-tableos-companion-action="undo"]').click();
  assert.equal(await page.locator('.tableos-phase.active strong').textContent(), firstPhase, 'boundary phase change restores the exact phase');
  assert.match(await phaseHeading.textContent(), /循环 1/, 'boundary phase undo restores the exact cycle');

  const activeBefore = await page.locator('.tableos-phase.active strong').textContent();
  await page.getByRole('button', { name: /下一步/ }).click();
  assert.notEqual(await page.locator('.tableos-phase.active strong').textContent(), activeBefore);
  await page.locator('[data-tableos-companion-action="undo"]').click();
  assert.equal(await page.locator('.tableos-phase.active strong').textContent(), activeBefore, 'ordinary phase change can be undone');

  // The companion bridge returns directly to the main live timer.
  await page.locator('[data-tableos-companion-action="flow"]').click();
  assert.equal(await page.locator('#tableos-root').count(), 0);
  assert.ok((await page.locator('[data-tab="flow"]').getAttribute('class') || '').includes('active'));

  assert.equal(errors.length, 0, `Table OS companion console errors: ${errors.join(' | ')}`);
  await context.close();
}

async function runTouchTargetSmoke() {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, locale: 'zh-CN' });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await openTableOs(page);
  if (await page.locator('[data-os-quick-template="coop-crisis"]').count()) await page.locator('[data-os-quick-template="coop-crisis"]').click();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  const counterButton = page.locator('[data-os-tracker-delta]').first();
  const box = await counterButton.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `live counter touch target should be at least 44px: ${JSON.stringify(box)}`);
  await page.getByRole('button', { name: '阶段', exact: true }).click();
  const phaseBox = await page.locator('[data-os-phase-active]').first().boundingBox();
  assert.ok(phaseBox && phaseBox.width >= 44 && phaseBox.height >= 44, `phase touch target should be at least 44px: ${JSON.stringify(phaseBox)}`);
  const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(overflow.scrollWidth <= overflow.width + 1, `320px companion layout should not overflow: ${JSON.stringify(overflow)}`);
  await context.close();
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], {
      cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer(url);
  }

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  await runPrimaryFlow();
  await runTouchTargetSmoke();

  console.log(JSON.stringify({
    event: 'table-os-companion-e2e-summary',
    status: 'PASS',
    checks: [
      'live main-game context', 'timer continuity', 'roster-drift detection', 'one-tap roster sync',
      'tracker undo', 'direct-value undo', 'exact clamped tracker undo', 'exact phase-boundary undo',
      'ordinary phase undo', 'main-timer bridge', 'contextual accessibility labels',
      '44px live touch targets', '320px overflow'
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