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

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(metrics.scrollWidth <= metrics.width + 1, `${label} should not horizontally overflow: ${JSON.stringify(metrics)}`);
}

async function runPrimaryFlow() {
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
  assert.equal(await page.locator('[data-os-participant-name]').count(), 0, 'play mode does not expose roster edit fields');
  assert.equal(await page.getByRole('button', { name: '编辑配置' }).count(), 1, 'play mode is the default');
  assert.ok(await page.getByText('今天需要什么？', { exact: true }).isVisible(), 'empty workspace starts with purpose-first quick start');
  assert.equal(await page.locator('[data-os-template]').count(), 0, 'advanced template selector stays hidden in play mode');

  // Configuration is still one tap away and roster sync remains available there.
  await editMode(page);
  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'main game roster is synchronized on first open');
  assert.ok(await page.locator('[data-os-template]').isVisible());

  // Apply a cooperative template; application intentionally returns to Play mode.
  await page.locator('[data-os-template]').selectOption('coop-crisis');
  await page.getByRole('button', { name: '应用模板' }).click();
  assert.ok(await page.getByRole('button', { name: '牌局模式' }).getAttribute('class').then(value => value.includes('active')));
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  const trackerNames = await page.locator('.tableos-live-head strong').allTextContents();
  assert.ok(trackerNames.includes('威胁'));
  assert.ok(trackerNames.includes('个人生命'));
  const threat = page.locator('.tableos-module').filter({ hasText: '威胁' }).first();
  await threat.locator('[data-os-tracker-delta]').filter({ hasText: '+' }).first().click();
  assert.equal(await threat.locator('[data-os-tracker-value]').first().inputValue(), '1');

  // Phase engine remains a live surface and bridges back to the main timer without extra configuration.
  await page.getByRole('button', { name: '阶段', exact: true }).click();
  const activeBefore = await page.locator('.tableos-phase.active strong').textContent();
  await page.getByRole('button', { name: /下一步/ }).click();
  const activeAfter = await page.locator('.tableos-phase.active strong').textContent();
  assert.notEqual(activeAfter, activeBefore);
  assert.ok(await page.getByRole('button', { name: '去主计时器' }).isVisible());

  // Set a private role in Edit mode, then prove the player reveal is two-stage and moderator notes never leak.
  await editMode(page);
  await page.getByRole('button', { name: '团队与身份', exact: true }).click();
  const firstRoleName = page.locator('[data-os-role-name]').first();
  const firstFaction = page.locator('[data-os-role-faction]').first();
  const firstModeratorNote = page.locator('[data-os-role-note]').first();
  await firstRoleName.fill('侦察员'); await firstRoleName.blur();
  await firstFaction.fill('守护者'); await firstFaction.blur();
  await firstModeratorNote.fill('主持人机密：夜晚第二个行动'); await firstModeratorNote.blur();
  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '团队与身份', exact: true }).click();
  await page.locator('[data-os-role-reveal]').first().click();
  assert.equal(await page.getByText('侦察员', { exact: true }).count(), 0, 'role stays hidden before player confirms identity');
  assert.equal(await page.getByText(/主持人机密/).count(), 0, 'moderator note is absent from the player reveal DOM');
  await page.getByRole('button', { name: '这是我，查看身份' }).click();
  assert.ok(await page.getByText('侦察员', { exact: true }).isVisible());
  assert.ok(await page.getByText('守护者', { exact: true }).isVisible());
  assert.equal(await page.getByText(/主持人机密/).count(), 0, 'moderator note never appears after reveal');
  await page.getByRole('button', { name: '看完了' }).click();

  // Session bridge: recent random teams from the basic toolbox can be adopted without rebuilding them manually.
  await page.evaluate(() => {
    const key = 'board-game-assistant-state-v2';
    const game = JSON.parse(localStorage.getItem(key));
    game.tools.teams = [
      { index: 0, playerIds: [game.players[0].id, game.players[2].id] },
      { index: 1, playerIds: [game.players[1].id, game.players[3].id] }
    ];
    localStorage.setItem(key, JSON.stringify(game));
  });
  await page.getByRole('button', { name: '采用工具箱分队' }).click();
  assert.equal(await page.locator('.tableos-team-live').count(), 2);

  // Formula scoring stays powerful, but configuration is hidden during live play.
  await applyTemplate(page, 'engine-score');
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  assert.equal(await page.locator('.tableos-score-config').count(), 0, 'formula configuration is hidden in play mode');
  const manualInputs = page.locator('[data-os-score-value]');
  await manualInputs.nth(0).fill('12'); await manualInputs.nth(0).blur();
  await manualInputs.nth(1).fill('4'); await manualInputs.nth(1).blur();
  await manualInputs.nth(2).fill('0'); await manualInputs.nth(2).blur();
  await manualInputs.nth(3).fill('3'); await manualInputs.nth(3).blur();
  const firstScoreCard = page.locator('.tableos-score-table > article').first();
  assert.equal(await firstScoreCard.locator('output').last().textContent(), '13');


  // Unary +/- follows ordinary arithmetic precedence in real formula-field editing.
  await editMode(page);
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  const netFormula = page.locator('[data-os-score-formula]').first();
  await netFormula.fill('-(base + bonus) / -2 + objective - penalty');
  await netFormula.blur();
  await page.getByRole('button', { name: '牌局模式' }).click();
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  assert.equal(await page.locator('.tableos-score-table > article').first().locator('output').last().textContent(), '5', 'unary formula syntax works through the live score sheet');

  // Campaign trackers have explicit lifetimes: health resets; experience persists across new scenarios.
  await applyTemplate(page, 'campaign');
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  const health = page.locator('.tableos-module').filter({ hasText: '生命' }).first();
  const experience = page.locator('.tableos-module').filter({ hasText: '经验' }).first();
  await health.locator('[data-os-tracker-value]').first().fill('4'); await health.locator('[data-os-tracker-value]').first().blur();
  await experience.locator('[data-os-tracker-value]').first().fill('7'); await experience.locator('[data-os-tracker-value]').first().blur();
  await page.getByRole('button', { name: '新场景 / 下一局' }).click();
  assert.equal(await health.locator('[data-os-tracker-value]').first().inputValue(), '10', 'session health resets to initial value');
  assert.equal(await experience.locator('[data-os-tracker-value]').first().inputValue(), '7', 'campaign experience survives');
  await page.getByRole('button', { name: '战役', exact: true }).click();
  assert.ok(await page.getByText(/第几局 2/).isVisible());

  // Campaign memory persists across reloads.
  await editMode(page);
  await page.getByRole('button', { name: '战役', exact: true }).click();
  await page.locator('[data-os-campaign="name"]').fill('周五战役'); await page.locator('[data-os-campaign="name"]').blur();
  await page.getByRole('button', { name: '添加检查点' }).click();
  const flagName = page.locator('[data-os-flag-name]').first();
  await flagName.fill('开启北门'); await flagName.blur();
  await page.locator('[data-os-flag-toggle]').first().click();
  await page.getByRole('button', { name: '关闭' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await openTableOs(page);
  await page.getByRole('button', { name: '战役', exact: true }).click();
  assert.ok(await page.getByText('周五战役', { exact: true }).isVisible());
  assert.ok(await page.getByText('开启北门', { exact: true }).isVisible());

  // English UI follows the main language dynamically.
  await page.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '界面语言' }).click();
  assert.equal(await page.getByRole('button', { name: 'Advanced Table Assistant' }).textContent(), 'Table OS');

  await assertNoHorizontalOverflow(page, '390px base app');
  assert.equal(errors.length, 0, `Table OS console errors: ${errors.join(' | ')}`);
  await context.close();
}

async function runResponsiveSmoke() {
  for (const viewport of [{ width: 320, height: 568 }, { width: 1024, height: 768 }]) {
    const context = await browser.newContext({ viewport, locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await openTableOs(page);
    await assertNoHorizontalOverflow(page, `${viewport.width}px Table OS`);
    assert.ok(await page.getByRole('button', { name: '牌局模式' }).isVisible());
    await page.getByRole('button', { name: '编辑配置' }).click();
    await assertNoHorizontalOverflow(page, `${viewport.width}px Table OS edit mode`);
    await context.close();
  }
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
  await runResponsiveSmoke();

  console.log(JSON.stringify({
    event: 'table-os-e2e-summary', status: 'PASS',
    checks: [
      'play/edit separation', 'purpose-first quick start', 'roster sync', 'universal trackers', 'phase engine',
      'toolbox-team bridge', 'two-stage private role reveal', 'moderator-note isolation', 'formula score sheet', 'unary formula operators',
      'campaign tracker persistence', 'campaign reload persistence', '320px mobile', 'tablet', 'dynamic bilingual UI'
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
