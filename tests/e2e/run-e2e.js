import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TEST_PORT || 4173);
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
  throw new Error(`Test server did not become ready at ${target}`);
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

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  } catch (error) {
    throw new Error(`Chromium could not launch. Run "npx playwright install chromium". ${error.message}`);
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });

  assert.match(await page.title(), /桌游助手/);
  assert.equal(await page.locator('[data-score-preset]').count(), 5);
  assert.equal(await page.locator('[data-template]').count(), 6);
  assert.equal(await page.locator('[data-player-name]').count(), 4);
  assert.equal(await page.locator('[data-tab]').count(), 0);
  assert.ok(await page.getByRole('checkbox', { name: '后台到时提醒' }).isVisible());
  assert.ok(await page.getByRole('checkbox', { name: '屏幕常亮' }).isVisible());
  assert.ok(await page.getByText('浏览器允许且页面保持运行时发送提醒；返回页面后计时仍会按实际时间校准。').isVisible());

  // Roster tools: recolor via popover and reorder via move buttons.
  await page.locator('.player-row').first().locator('button.color-dot').click();
  assert.equal(await page.locator('.color-popover').count(), 1);
  await page.locator('.color-popover .color-dot.chip').nth(2).click();
  assert.equal(await page.locator('.color-popover').count(), 0);
  const rosterBefore = await page.locator('[data-player-name]').first().getAttribute('data-player-name');
  await page.locator('[data-move-player]').nth(1).click();
  const rosterAfter = await page.locator('[data-player-name]').first().getAttribute('data-player-name');
  assert.notEqual(rosterAfter, rosterBefore, 'second player moved up into first row');
  await page.locator('[data-move-player]').nth(1).click();
  assert.equal(await page.locator('[data-player-name]').first().getAttribute('data-player-name'), rosterBefore, 'move is reversible');

  await page.getByRole('button', { name: '界面语言' }).click();
  assert.equal(await page.title(), 'Board Game Assistant');
  await page.getByRole('button', { name: 'Language' }).click();

  await page.getByRole('button', { name: '开始桌游局' }).click();
  assert.equal(await page.locator('[data-tab]').count(), 4);
  assert.ok(await page.getByRole('tab', { name: '工具', exact: true }).isVisible());
  assert.ok(await page.getByRole('spinbutton', { name: '第1轮，玩家1，胜利点' }).isVisible());
  assert.ok(await page.locator('#timerProgressFill').isVisible());

  await page.getByRole('tab', { name: '流程', exact: true }).click();
  await page.getByRole('tab', { name: '流程', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-tab][aria-selected="true"]').textContent(), '计分');
  assert.equal(await page.locator('[data-tab][aria-selected="true"]').getAttribute('data-tab'), 'score');
  await page.getByRole('tab', { name: '流程', exact: true }).click();

  const firstRoundInput = page.locator('[data-round-score]').first();
  await firstRoundInput.fill('7');
  await firstRoundInput.blur();
  await page.getByRole('tab', { name: '计分', exact: true }).click();
  assert.equal(await page.locator('.score-row').first().locator('strong').textContent(), '7');
  assert.ok(await page.getByRole('button', { name: '快捷调整玩家1的胜利点+1' }).isVisible());

  await page.locator('[data-score-delta]').filter({ hasText: '+' }).first().click();
  assert.equal(await page.locator('.score-row').first().locator('strong').textContent(), '8');
  await page.locator('[data-score-field]').nth(4).click();
  assert.ok(await page.locator('.round-history-item').count() >= 1);
  await page.getByRole('button', { name: '撤销' }).click();

  await page.getByRole('tab', { name: '工具', exact: true }).click();
  await page.getByRole('button', { name: '掷骰' }).click();
  assert.match(await page.locator('.random-result strong').textContent(), /^\d+$/);
  await page.getByRole('button', { name: '抛硬币' }).click();
  assert.match(await page.locator('.random-result strong').textContent(), /^(正面|反面)$/);
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.getByRole('button', { name: '生成随机顺序' }).click();
  await page.getByRole('button', { name: '开始分队' }).click();
  assert.ok(await page.locator('.history-list > div').count() >= 5);
  assert.equal(await page.locator('.team-results article').count(), 2);

  await page.getByRole('tab', { name: '流程', exact: true }).click();
  await page.getByRole('button', { name: '+30秒' }).click();
  assert.equal(await page.locator('#timerDisplay').textContent(), '02:00');

  // Running badge stays visible from any tab and returns to Flow on tap.
  await page.getByRole('button', { name: '开始', exact: true }).click();
  assert.ok(await page.locator('#runningBadge').isVisible());
  await page.getByRole('tab', { name: '计分', exact: true }).click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#runningBadgeTime').textContent(), '01:59');
  await page.locator('#runningBadge').click();
  assert.equal(await page.locator('[data-tab][aria-selected="true"]').textContent(), '流程');
  await page.getByRole('button', { name: '暂停' }).click();

  // Quick ±1 scoring directly from the Flow tab player chips.
  const chipPlus = page.locator('.chip-score button').filter({ hasText: '+' }).first();
  await chipPlus.click();
  await page.waitForTimeout(50);
  assert.match(await page.locator('.chip-main').first().locator('strong').textContent(), /^8 /);

  // Regression: tapping another control right after typing (no blur first)
  // must commit the score AND land the tap. The change event fires during
  // mousedown, so renders are deferred until the click completes.
  const noBlurInput = page.locator('[data-round-score]').first();
  await noBlurInput.fill('9');
  await page.getByRole('tab', { name: '计分', exact: true }).click();
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-tab][aria-selected="true"]').textContent(), '计分');
  assert.equal(await page.locator('.score-row').first().locator('strong').textContent(), '9');
  await page.getByRole('tab', { name: '流程', exact: true }).click();

  await page.getByRole('tab', { name: '结算', exact: true }).click();
  assert.equal(await page.locator('.result-card').count(), 4);
  await page.getByRole('button', { name: '结束本局' }).click();
  assert.ok(await page.getByRole('button', { name: '恢复本局' }).isVisible());
  assert.equal(await page.locator('.archive-item').count(), 1);
  assert.match(await page.locator('.archive-item summary strong').first().textContent(), /桌游局|Game Night/);
  await page.locator('.archive-item summary').first().click();
  await page.locator('[data-archive-delete]').first().click();
  assert.equal(await page.locator('.archive-item').count(), 0);
  assert.ok(await page.getByText('还没有历史对局；结束本局后会自动归档到这里。').isVisible());
  await page.getByRole('button', { name: '设置', exact: true }).click();
  assert.ok(await page.getByRole('checkbox', { name: '屏幕常亮' }).isVisible());
  assert.equal(await page.getByRole('button', { name: '返回设置', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);

  await page.setViewportSize({ width: 360, height: 740 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(hasHorizontalOverflow, false);

  await page.getByRole('button', { name: '恢复本局' }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  for (const tabName of ['流程', '计分', '工具', '结算']) {
    await page.getByRole('tab', { name: tabName, exact: true }).click();
    const compactOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(compactOverflow, false, `${tabName} overflows at 320px`);
  }
  await page.getByRole('tab', { name: '流程', exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 1366 });
  const columns = await page.locator('.flow-layout').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  assert.equal(columns, 2);

  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '返回设置', exact: true }).click();
  assert.equal(await page.locator('[data-template]').count(), 6);
  await page.getByRole('button', { name: '继续当前桌游局', exact: true }).click();

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('[data-tab]').count(), 4);
  await context.setOffline(false);

  await page.getByRole('button', { name: '界面语言' }).click();
  assert.ok(await page.getByRole('tab', { name: 'Tools', exact: true }).isVisible());

  // Rematch keeps players and settings, clears scores, and returns to round 1.
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await page.getByRole('button', { name: 'Finish Game' }).click();
  await page.getByRole('button', { name: 'Rematch (Keep Players)' }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-tab]').count(), 4);
  assert.ok(await page.getByText('Round 1', { exact: true }).isVisible());
  assert.equal(await page.locator('.player-chip').count(), 4);
  assert.equal(await page.locator('#runningBadge').count(), 0);

  // Share button and archive rematch: restore a past game's setup and roster.
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  assert.ok(await page.getByRole('button', { name: 'Share' }).isVisible());
  await page.getByRole('button', { name: 'Finish Game' }).click();
  await page.locator('.archive-item summary').last().click();
  await page.getByRole('button', { name: 'Rematch with this setup' }).last().click();
  await page.waitForTimeout(100);
  assert.ok(await page.getByText('Round 1', { exact: true }).isVisible());
  assert.equal(await page.locator('.player-chip').count(), 4);
  assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);

  const englishContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const englishPage = await englishContext.newPage();
  await englishPage.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await englishPage.title(), 'Board Game Assistant');
  await englishContext.close();

  const privacyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const privacyPage = await privacyContext.newPage();
  const privacyErrors = [];
  privacyPage.on('console', message => { if (message.type() === 'error') privacyErrors.push(message.text()); });
  privacyPage.on('pageerror', error => privacyErrors.push(error.message));
  await privacyPage.goto(`${url}/privacy.html`, { waitUntil: 'networkidle' });
  assert.match(await privacyPage.title(), /隐私政策/);
  await Promise.all([
    privacyPage.waitForURL(`${url}/`),
    privacyPage.getByRole('link', { name: /返回应用/ }).click()
  ]);
  await privacyPage.locator('[data-template]').first().waitFor({ state: 'visible' });
  assert.equal(await privacyPage.locator('[data-template]').count(), 6);
  assert.equal(privacyErrors.length, 0, `Privacy return errors: ${privacyErrors.join(' | ')}`);
  await privacyContext.close();

  console.log(JSON.stringify({
    event: 'e2e-summary',
    status: 'PASS',
    checks: ['bilingual setup', 'locale autodetection', 'accessible controls', 'four-tab workspace', 'tab keyboard navigation', 'progress bar', 'running badge', 'flow quick score', 'roster recolor and reorder', 'weighted scoring', 'undo', 'no-blur tap regression', 'toolbox', 'dice and coin result display', 'session finish/resume', 'game archive', 'rematch keeps players', 'share summary', 'archive rematch', 'frozen results', 'settings keyboard close', 'keep screen awake setting', 'back to setup', 'offline reload', 'privacy return navigation', '320px and 360px overflow', 'tablet layout']
  }, null, 2));
}

run().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
