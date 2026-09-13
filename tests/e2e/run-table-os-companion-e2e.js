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

async function rematchMainGame(page) {
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await page.getByRole('button', { name: 'Finish Game', exact: true }).click();
  await page.getByRole('button', { name: 'Rematch (Keep Players)', exact: true }).click();
  await page.getByRole('tab', { name: 'Flow', exact: true }).waitFor({ state: 'visible' });
}

async function runQuietLifecycleFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.locator('[data-action="start-session"]').click();
  await openTableOs(page);
  assert.equal(await page.locator('[data-tableos-companion-action="new-session"]').count(), 0, 'first association is silent');
  await page.locator('.tableos-header [data-os-action="close"]').click();
  await rematchMainGame(page);
  await openTableOs(page);
  assert.equal(await page.locator('[data-tableos-companion-action="new-session"]').count(), 0, 'empty Table OS does not nag on rematch');
  await context.close();
}

async function runSessionLifecycleFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-action="start-session"]').click();
  await openTableOs(page);
  await page.locator('[data-os-quick-template="campaign"]').click();

  // Seed both persistent campaign state and transient session state.
  await page.getByRole('button', { name: 'Trackers', exact: true }).click();
  const teamResource = page.locator('.tableos-module').filter({ hasText: 'Team resources' }).first();
  const teamResourceValue = teamResource.locator('[data-os-tracker-value]').first();
  await teamResourceValue.fill('5');
  await teamResourceValue.blur();
  const health = page.locator('.tableos-module').filter({ hasText: 'Health' }).first();
  const healthValue = health.locator('[data-os-tracker-value]').first();
  await healthValue.fill('7');
  await healthValue.blur();

  await page.getByRole('button', { name: 'Phases', exact: true }).click();
  await page.locator('[data-os-action="next-phase"]').click();
  await page.getByRole('button', { name: 'Score sheet', exact: true }).click();
  const scoreValue = page.locator('[data-os-score-value]').first();
  await scoreValue.fill('9');
  await scoreValue.blur();

  await page.getByRole('button', { name: 'Edit setup', exact: true }).click();
  await page.getByRole('button', { name: 'Teams & roles', exact: true }).click();
  const roleInput = page.locator('[data-os-role-name]').first();
  await roleInput.fill('Scout');
  await roleInput.blur();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const seeded = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.equal(seeded.campaign.sessionNumber, 1);
  assert.equal(seeded.roles[0]?.role, 'Scout');
  assert.equal(seeded.phases.activeIndex, 1);

  // First rematch: detection is explicit, and Keep Table State must be non-destructive.
  await page.locator('.tableos-header [data-os-action="close"]').click();
  await rematchMainGame(page);
  await openTableOs(page);
  const newSession = page.locator('[data-tableos-companion-action="new-session"]');
  const keepSession = page.locator('[data-tableos-companion-action="keep-session"]');
  await newSession.waitFor({ state: 'visible' });
  assert.match(await page.locator('[data-tableos-main-context]').textContent(), /New main game detected/);
  assert.equal(await page.locator('[data-tableos-companion-action="sync"]').count(), 0, 'lifecycle decision takes priority over roster sync');
  await keepSession.click();
  await newSession.waitFor({ state: 'detached' });
  assert.ok(await page.getByText('Current table state kept.', { exact: true }).isVisible());
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.equal(kept.campaign.sessionNumber, 1, 'keeping state does not advance campaign session');
  assert.equal(kept.roles[0]?.role, 'Scout', 'keeping state preserves roles');
  assert.equal(kept.phases.activeIndex, 1, 'keeping state preserves phase');
  assert.ok(Object.values(kept.scoreSheet.values || {}).some(values => Object.values(values || {}).includes(9)), 'keeping state preserves advanced score');
  assert.ok(kept.trackers.some(tracker => tracker.name === 'Health' && Object.values(tracker.values || {}).includes(7)), 'keeping state preserves session tracker values');

  // Second rematch: Start New Table applies the existing safe session reset exactly once.
  await page.locator('.tableos-header [data-os-action="close"]').click();
  await rematchMainGame(page);
  await openTableOs(page);
  await newSession.waitFor({ state: 'visible' });
  await newSession.click();
  await page.getByText('Session state reset for the new game.', { exact: true }).waitFor({ state: 'visible' });
  await newSession.waitFor({ state: 'detached' });

  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  const resourceTracker = reset.trackers.find(tracker => tracker.name === 'Team resources');
  const healthTracker = reset.trackers.find(tracker => tracker.name === 'Health');
  assert.equal(resourceTracker?.values?.global, 5, 'campaign-persistent tracker survives rematch reset');
  assert.equal(Object.keys(healthTracker?.values || {}).length, 0, 'session tracker values are cleared');
  assert.equal(reset.phases.activeIndex, 0, 'phase returns to first step');
  assert.equal(reset.phases.cycle, 1, 'phase cycle returns to one');
  assert.equal(reset.roles.length, 0, 'private roles do not leak into the next table session');
  assert.equal(Object.keys(reset.scoreSheet.values || {}).length, 0, 'advanced score values are cleared');
  assert.equal(reset.campaign.sessionNumber, 2, 'campaign session advances once when user starts a new table session');

  const bridge = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-companion-v1')));
  const game = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')));
  const roundOne = game.score.rounds.find(round => Number(round.round) === 1);
  assert.equal(bridge.associatedMainSessionId, `round:${roundOne.createdAt}`, 'companion associates with the accepted main-game rematch');
  assert.equal(errors.length, 0, `Table OS lifecycle console errors: ${errors.join(' | ')}`);
  await context.close();
}

async function runTeamReplacementCleanupFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-action="start-session"]').click();

  await page.evaluate(() => {
    const gameKey = 'board-game-assistant-state-v2';
    const tableKey = 'board-game-assistant-table-os-v1';
    const game = JSON.parse(localStorage.getItem(gameKey));
    if (!Array.isArray(game?.players) || game.players.length < 2) throw new Error('Expected at least two main-game players');
    const players = game.players.slice(0, 2);
    localStorage.setItem(tableKey, JSON.stringify({
      schemaVersion: 3,
      participants: players.map((player, index) => ({
        id: `tp_seed_${index + 1}`,
        sourcePlayerId: String(player.id),
        name: player.name,
        color: player.color
      })),
      teams: [{ id: 'old_team', name: 'Old Team', memberIds: ['tp_seed_1', 'tp_seed_2'] }],
      trackers: [{
        id: 'team_tracker', name: 'Team score', scope: 'team', initial: 2, value: 2, min: 0, max: 99, step: 1,
        persistence: 'campaign', values: { old_team: 9 }
      }],
      statuses: [{ id: 'team_status', name: 'Ready', scope: 'team', initial: false, values: { old_team: true } }],
      ui: { mode: 'play', activeSection: 'overview' }
    }));
  });

  await page.reload({ waitUntil: 'networkidle' });
  await openTableOs(page);
  await page.getByRole('button', { name: 'Edit setup', exact: true }).click();
  await page.getByRole('button', { name: 'Teams & roles', exact: true }).click();
  await page.evaluate(() => {
    const gameKey = 'board-game-assistant-state-v2';
    const game = JSON.parse(localStorage.getItem(gameKey));
    const players = game.players.slice(0, 2);
    game.tools = game.tools && typeof game.tools === 'object' ? game.tools : {};
    game.tools.teams = [
      { index: 0, playerIds: [players[0].id] },
      { index: 1, playerIds: [players[1].id] }
    ];
    localStorage.setItem(gameKey, JSON.stringify(game));
  });
  await page.getByRole('button', { name: 'Use toolbox teams', exact: true }).click();
  await page.getByText('Latest toolbox teams adopted.', { exact: true }).waitFor({ state: 'visible' });

  const replaced = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.equal(replaced.teams.length, 2);
  assert.ok(replaced.teams.every(team => team.id !== 'old_team'), 'toolbox adoption creates fresh team identities');
  assert.deepEqual(replaced.trackers.find(tracker => tracker.id === 'team_tracker')?.values, {}, 'old team tracker values are not retained');
  assert.deepEqual(replaced.statuses.find(status => status.id === 'team_status')?.values, {}, 'old team status values are not retained');
  assert.equal(JSON.stringify(replaced).includes('old_team'), false, 'retired team ids do not survive persistence');

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Statuses', exact: true }).click();
  const readyButtons = page.locator('.tableos-module').filter({ hasText: 'Ready' }).locator('[data-os-status-toggle]');
  assert.equal(await readyButtons.count(), 2);
  for (let index = 0; index < 2; index += 1) assert.equal(await readyButtons.nth(index).getAttribute('aria-pressed'), 'false');

  await page.getByRole('button', { name: 'Trackers', exact: true }).click();
  const trackerValues = await page.locator('.tableos-module').filter({ hasText: 'Team score' }).locator('[data-os-tracker-value]').evaluateAll(inputs => inputs.map(input => input.value));
  assert.deepEqual(trackerValues, ['2', '2'], 'replacement teams start from tracker defaults');

  assert.equal(errors.length, 0, `Table OS team replacement console errors: ${errors.join(' | ')}`);
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
  await runQuietLifecycleFlow();
  await runSessionLifecycleFlow();
  await runTeamReplacementCleanupFlow();
  await runTouchTargetSmoke();

  console.log(JSON.stringify({
    event: 'table-os-companion-e2e-summary',
    status: 'PASS',
    checks: [
      'live main-game context', 'timer continuity', 'roster-drift detection', 'one-tap roster sync',
      'tracker undo', 'direct-value undo', 'exact clamped tracker undo', 'exact phase-boundary undo',
      'ordinary phase undo', 'main-timer bridge', 'contextual accessibility labels',
      'quiet empty rematch', 'new-session detection', 'keep-current lifecycle choice',
      'safe rematch reset', 'campaign tracker persistence across rematch', 'transient state reset across rematch',
      'toolbox re-team stale-value cleanup', 'fresh team defaults after replacement',
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