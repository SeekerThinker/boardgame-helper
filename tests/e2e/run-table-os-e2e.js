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

async function assertFocusTrapped(page, dialogSelector, label) {
  const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const count = await page.evaluate(({ dialogSelector, focusableSelector }) => {
    const dialog = document.querySelector(dialogSelector);
    if (!(dialog instanceof HTMLElement)) return 0;
    const items = [...dialog.querySelectorAll(focusableSelector)].filter(element => element instanceof HTMLElement && element.getClientRects().length > 0);
    items.at(-1)?.focus();
    return items.length;
  }, { dialogSelector, focusableSelector });
  assert.ok(count > 1, `${label} should have multiple focusable controls`);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(({ dialogSelector, focusableSelector }) => {
    const dialog = document.querySelector(dialogSelector);
    const items = dialog ? [...dialog.querySelectorAll(focusableSelector)].filter(element => element instanceof HTMLElement && element.getClientRects().length > 0) : [];
    return items.length > 0 && document.activeElement === items[0];
  }, { dialogSelector, focusableSelector }), true, `${label} should wrap Tab from last to first`);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(({ dialogSelector, focusableSelector }) => {
    const dialog = document.querySelector(dialogSelector);
    const items = dialog ? [...dialog.querySelectorAll(focusableSelector)].filter(element => element instanceof HTMLElement && element.getClientRects().length > 0) : [];
    return items.length > 0 && document.activeElement === items.at(-1);
  }, { dialogSelector, focusableSelector }), true, `${label} should wrap Shift+Tab from first to last`);
}

async function runPrimaryFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const promptResponses = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(promptResponses.shift() || dialog.defaultValue() || '');
    else await dialog.accept();
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const launcher = page.getByRole('button', { name: '高级桌游助手' });
  assert.ok(await launcher.isVisible(), 'Table OS launcher is always available');
  await launcher.click();
  const tableDialog = page.getByRole('dialog', { name: '高级桌游助手' });
  assert.ok(await tableDialog.isVisible());
  assert.equal(await tableDialog.evaluate(dialog => dialog.contains(document.activeElement)), true, 'focus enters Table OS when opened');
  await assertFocusTrapped(page, '.tableos-sheet[role="dialog"]', 'Table OS dialog');
  assert.equal(await page.locator('[data-os-participant-name]').count(), 0, 'play mode does not expose roster edit fields');
  assert.equal(await page.getByRole('button', { name: '编辑配置' }).count(), 1, 'play mode is the default');
  assert.ok(await page.getByText('今天需要什么？', { exact: true }).isVisible(), 'empty workspace starts with purpose-first quick start');
  assert.equal(await page.locator('[data-os-template]').count(), 0, 'advanced template selector stays hidden in play mode');

  // Configuration is still one tap away and roster sync remains available there.
  await editMode(page);
  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'main game roster is synchronized on first open');
  assert.ok(await page.locator('[data-os-template]').isVisible());

  // Large-table setup: paste a mixed-separator roster once instead of adding assistant-only players one by one.
  await page.getByText('批量添加名单', { exact: true }).click();
  const bulkRoster = page.locator('[data-os-bulk-participants]');
  await bulkRoster.fill('阿青\n小林, Mia；Noah\tEva');
  await page.getByRole('button', { name: '添加名单' }).click();
  assert.equal(await page.locator('[data-os-participant-name]').count(), 9, 'bulk roster appends all parsed participants');
  const bulkSnapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.deepEqual(bulkSnapshot.participants.slice(-5).map(item => item.name), ['阿青', '小林', 'Mia', 'Noah', 'Eva']);
  assert.equal(bulkSnapshot.participants.slice(-5).every(item => item.sourcePlayerId === null), true, 'bulk roster creates assistant-only participants');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).players.length), 4, 'bulk roster never mutates the main game roster');
  for (let index = 0; index < 5; index += 1) await page.locator('[data-os-remove-participant]').last().click();
  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'test cleanup returns to the synchronized four-player roster');

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
  const firstRoleReveal = page.locator('[data-os-role-reveal]').first();
  await firstRoleReveal.click();
  const secretDialog = page.locator('.tableos-secret[role="dialog"]');
  assert.equal(await secretDialog.evaluate(dialog => dialog.contains(document.activeElement)), true, 'focus enters private role reveal');
  await assertFocusTrapped(page, '.tableos-secret[role="dialog"]', 'private role reveal');
  assert.equal(await page.getByText('侦察员', { exact: true }).count(), 0, 'role stays hidden before player confirms identity');
  assert.equal(await page.getByText(/主持人机密/).count(), 0, 'moderator note is absent from the player reveal DOM');
  await page.getByRole('button', { name: '这是我，查看身份' }).click();
  assert.ok(await page.getByText('侦察员', { exact: true }).isVisible());
  assert.ok(await page.getByText('守护者', { exact: true }).isVisible());
  assert.equal(await page.getByText(/主持人机密/).count(), 0, 'moderator note never appears after reveal');
  await page.keyboard.press('Escape');
  assert.equal(await firstRoleReveal.evaluate(element => element === document.activeElement), true, 'closing private reveal returns focus to its trigger');

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

  // A focused live value is flushed synchronously before page lifecycle interruption, even without blur/change.
  const interruptedScore = page.locator('[data-os-score-value]').first();
  const interruptedScoreKey = await interruptedScore.getAttribute('data-os-score-value');
  assert.ok(interruptedScoreKey, 'live score input exposes a persistence key');
  await interruptedScore.focus();
  await interruptedScore.evaluate(element => { element.value = '21'; });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  assert.equal(await page.evaluate(key => {
    const [participantId, fieldId] = key.split('|');
    const stored = JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1'));
    return Number(stored?.scoreSheet?.values?.[participantId]?.[fieldId]);
  }, interruptedScoreKey), 21, 'pagehide flushes the active live score draft before blur');

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
  const campaignNameDraft = page.locator('[data-os-campaign="name"]');
  await campaignNameDraft.focus();
  await campaignNameDraft.evaluate(element => { element.value = '周五战役'; });
  await page.keyboard.press('Escape');
  assert.equal(await launcher.evaluate(element => element === document.activeElement), true, 'Escape closes Table OS after flushing the focused draft');
  await openTableOs(page);
  await editMode(page);
  await page.getByRole('button', { name: '战役', exact: true }).click();
  assert.equal(await page.locator('[data-os-campaign="name"]').inputValue(), '周五战役', 'Escape-close preserves the focused campaign draft without blur');
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

  // Changing setup templates must not silently destroy persistent campaign memory.
  await editMode(page);
  await page.locator('[data-os-template]').selectOption('engine-score');
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '战役', exact: true }).click();
  assert.ok(await page.getByText('周五战役', { exact: true }).isVisible(), 'campaign name survives template application');
  assert.ok(await page.getByText('开启北门', { exact: true }).isVisible(), 'campaign checkpoints survive template application');

  // My Templates persist locally but only copy reusable structure, never live/private/campaign data.
  await editMode(page);
  await page.getByRole('button', { name: '团队与身份', exact: true }).click();
  await page.getByRole('button', { name: '添加团队' }).click();
  await page.locator('[data-os-team-member]').first().check();
  const privateTemplateRole = page.locator('[data-os-role-name]').first();
  await privateTemplateRole.fill('不应保存的私密角色'); await privateTemplateRole.blur();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  const liveRound = page.locator('[data-os-tracker-value]').first();
  await liveRound.fill('7'); await liveRound.blur();
  promptResponses.push('引擎夜');
  await page.getByRole('button', { name: '保存当前配置' }).click();
  const savedTemplates = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-user-templates-v1') || '[]'));
  assert.equal(savedTemplates.length, 1);
  assert.equal(savedTemplates[0].name, '引擎夜');
  assert.equal(savedTemplates[0].trackers[0].initial, 1, 'template keeps tracker initial configuration');
  assert.equal('values' in savedTemplates[0].trackers[0], false, 'template excludes live tracker values');
  assert.equal('memberIds' in savedTemplates[0].teams[0], false, 'template excludes team membership');
  assert.equal('participants' in savedTemplates[0], false, 'template excludes player roster');
  assert.equal('roles' in savedTemplates[0], false, 'template excludes role secrets');
  assert.equal('campaign' in savedTemplates[0], false, 'template excludes campaign content');
  const savedRaw = JSON.stringify(savedTemplates[0]);
  assert.equal(savedRaw.includes('不应保存的私密角色'), false);
  assert.equal(savedRaw.includes('周五战役'), false);
  assert.equal(savedRaw.includes('开启北门'), false);

  promptResponses.push('周五引擎');
  await page.getByRole('button', { name: '重命名', exact: true }).click();
  assert.equal(await page.locator('[data-os-user-template] option').first().textContent(), '周五引擎');
  await page.getByRole('button', { name: '关闭' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await openTableOs(page);
  await editMode(page);
  assert.equal(await page.locator('[data-os-user-template] option').first().textContent(), '周五引擎', 'My Templates persist across reload');

  await page.locator('[data-os-template]').selectOption('universal');
  await page.getByRole('button', { name: '应用模板', exact: true }).click();
  await editMode(page);
  await page.getByRole('button', { name: '应用我的模板', exact: true }).click();
  await page.getByRole('button', { name: '追踪器', exact: true }).click();
  assert.equal(await page.locator('[data-os-tracker-value]').first().inputValue(), '1', 'applying My Template restores initial tracker state, not saved live value');
  const appliedTemplateState = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.ok(String(appliedTemplateState.appliedTemplateId).startsWith('user:'), 'custom template identity persists with the workspace');
  assert.equal(appliedTemplateState.roles.length, 0, 'private roles are not replayed');
  assert.deepEqual(appliedTemplateState.teams[0].memberIds, [], 'team membership is not replayed');
  assert.deepEqual(appliedTemplateState.scoreSheet.values, {}, 'score values are not replayed');
  assert.equal(appliedTemplateState.campaign.name, '周五战役', 'campaign memory survives My Template application');
  assert.equal(appliedTemplateState.campaign.flags[0].name, '开启北门');
  assert.equal(appliedTemplateState.campaign.flags[0].checked, true);

  await editMode(page);
  await page.getByRole('button', { name: '删除模板', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-user-templates-v1') || '[]').length), 0, 'deleted template is removed only from local template shelf');

  // English UI follows the main language dynamically.
  await page.keyboard.press('Escape');
  assert.equal(await launcher.evaluate(element => element === document.activeElement), true, 'closing Table OS returns focus to the launcher');
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
      'toolbox-team bridge', 'two-stage private role reveal', 'moderator-note isolation', 'formula score sheet', 'unary formula operators', 'modal focus trap', 'nested reveal focus return', 'launcher focus return',
      'pagehide draft flush', 'escape-close draft flush', 'campaign tracker persistence', 'campaign reload persistence', '320px mobile', 'tablet', 'dynamic bilingual UI'
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
