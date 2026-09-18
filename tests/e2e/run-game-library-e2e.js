import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.GAME_LIBRARY_TEST_PORT || 4182);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server;
let browser;

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 12_000) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error('Game library preview server not ready');
}

async function scenario(locale, width) {
  const context = await browser.newContext({ locale, viewport: { width, height: 760 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  const english = locale.startsWith('en');
  const launcher = page.locator('#game-library-launcher');
  const nav = page.locator('#primary-navigation nav');
  assert.equal(await nav.locator(':scope > button').count(), 3, 'library / Table OS / toolbox have equal primary prominence');
  assert.ok(await launcher.isVisible(), 'library is prominent on the home screen');
  assert.ok(await page.locator('#tableos-launcher').isVisible(), 'Table OS is prominent on the home screen');
  assert.ok(await page.locator('#secret-dealer-launcher').isVisible(), 'secret dealer appears in quick host tools');
  const box = await launcher.boundingBox();
  const tableBox = await page.locator('#tableos-launcher').boundingBox();
  assert.ok(box.width > 70 && Math.abs(box.y - tableBox.y) <= 2, 'library and Table OS share a full-size navigation row');
  await launcher.click();
  const dialog = page.locator('#game-library-root [role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.textContent(), english ? /No games have completed editorial and rights review yet/ : /尚无完成审核并可公开的游戏条目/);
  assert.equal(await dialog.locator('[data-game-detail]').count(), 0, 'no unreviewed games can be opened');
  assert.ok(await dialog.locator('[data-library-choices]').isVisible(), 'material choices remain the primary flow');
  assert.ok(await dialog.locator('[data-library-player-choices]').isVisible(), 'player count is a tap-first section');
  assert.equal(await dialog.locator('[data-library-player-choice]').count(), 8, 'common counts and Any are visible');
  assert.ok(await dialog.locator('[data-game-material]').isVisible(), 'material selection exists');
  assert.ok(await dialog.locator('[data-game-players]').isVisible(), 'exact player count remains accessible for other counts');
  assert.ok(!(await dialog.locator('[data-game-query]').isVisible()), 'optional text search is initially collapsed');
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await dialog.locator('[data-library-material="none"]').click();
  assert.equal(await dialog.locator('[data-game-material]').inputValue(), 'none');
  assert.equal(await dialog.locator('[data-library-material="none"]').getAttribute('aria-pressed'), 'true');
  await dialog.locator('[data-library-player-choice="5"]').click();
  assert.equal(await dialog.locator('[data-game-players]').inputValue(), '5');
  assert.equal(await dialog.locator('[data-library-player-choice="5"]').getAttribute('aria-pressed'), 'true');
  await dialog.locator('[data-game-players]').selectOption('7');
  assert.equal(await dialog.locator('[data-library-player-choice="5"]').getAttribute('aria-pressed'), 'false', 'other exact counts deselect the shortcuts');
  await dialog.locator('[data-library-player-choice=""]').click();
  assert.equal(await dialog.locator('[data-game-players]').inputValue(), '');
  assert.equal(await dialog.locator('[data-library-player-choice=""]').getAttribute('aria-pressed'), 'true');
  await dialog.locator('[data-library-player-choice="3"]').click();
  await dialog.locator('[data-library-search]').evaluate(element => { element.open = true; });
  await dialog.locator('[data-game-query]').fill('incomplete draft');
  assert.equal(await dialog.locator('[data-game-detail]').count(), 0);
  await dialog.locator('[data-game-action="reset"]').click();
  assert.equal(await dialog.locator('[data-game-query]').inputValue(), '');
  assert.equal(await dialog.locator('[data-game-material]').inputValue(), 'all');
  assert.equal(await dialog.locator('[data-game-players]').inputValue(), '');
  assert.equal(await dialog.locator('[data-library-player-choice=""]').getAttribute('aria-pressed'), 'true', 'reset updates shortcut selection');
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before, 'catalog navigation does not write game data');
  const dimensions = await dialog.evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, scroll: element.scrollWidth, client: element.clientWidth }));
  assert.ok(dimensions.left >= 0 && dimensions.right <= width + 1, `library must fit ${width}px viewport: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.scroll <= dimensions.client + 1, 'library must not overflow horizontally');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#game-library-root').isHidden(), true);
  assert.equal(await launcher.evaluate(element => element === document.activeElement), true, 'focus returns to primary navigation');
  await launcher.click();
  assert.ok(await dialog.locator('[data-library-player-choices]').isVisible(), 'choices are rebuilt when reopened');
  await dialog.locator('[data-game-action="dealer"]').click();
  assert.equal(await page.locator('#game-library-root').isHidden(), true, 'tool handoff closes library');
  await page.locator('#secret-dealer-root [role="dialog"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#secret-dealer-root [data-secret-revealed]').count(), 0, 'handoff does not invent or reveal secret cards');
  await page.locator('#secret-dealer-root [data-secret-action="close"]').click();
  assert.equal(errors.length, 0, errors.join(' | '));
  await context.close();
}

try {
  if (!process.env.APP_URL) { server = spawn(process.execPath, ['scripts/serve-static.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' }); await waitForServer(); }
  browser = await chromium.launch({ headless: true });
  await scenario('zh-CN', 320);
  await scenario('en-US', 390);
  console.log('Game library E2E passed (primary navigation, tap-first materials/player counts, no unpublished content, privacy, mobile, bilingual).');
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
}
