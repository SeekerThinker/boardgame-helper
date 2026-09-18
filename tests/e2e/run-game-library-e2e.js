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
  const name = english ? 'Game library' : '游戏图鉴';
  const launcher = page.getByRole('button', { name, exact: true });
  await launcher.click();
  const dialog = page.locator('#game-library-root [role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.textContent(), english ? /No games have completed editorial and rights review yet/ : /尚无完成审核并可公开的游戏条目/);
  assert.equal(await dialog.locator('[data-game-detail]').count(), 0, 'no unreviewed games can be opened');
  assert.ok(await dialog.locator('[data-game-query]').isVisible(), 'search is accessible before first reviewed entry');
  assert.ok(await dialog.locator('[data-game-material]').isVisible(), 'material filter exists');
  assert.ok(await dialog.locator('[data-game-players]').isVisible(), 'player count filter exists');
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await dialog.locator('[data-game-query]').fill('incomplete draft');
  await dialog.locator('[data-game-material]').selectOption('none');
  await dialog.locator('[data-game-players]').selectOption('5');
  assert.equal(await dialog.locator('[data-game-detail]').count(), 0);
  await dialog.locator('[data-game-action="reset"]').click();
  assert.equal(await dialog.locator('[data-game-query]').inputValue(), '');
  assert.equal(await dialog.locator('[data-game-material]').inputValue(), 'all');
  assert.equal(await dialog.locator('[data-game-players]').inputValue(), '');
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before, 'catalog is stateless and does not write game data');
  const dimensions = await dialog.evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, scroll: element.scrollWidth, client: element.clientWidth }));
  assert.ok(dimensions.left >= 0 && dimensions.right <= width + 1, `dialog must fit ${width}px viewport: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.scroll <= dimensions.client + 1, 'library content must not overflow horizontally');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#game-library-root').isHidden(), true);
  assert.equal(await launcher.evaluate(element => element === document.activeElement), true, 'dialog returns keyboard focus');
  await launcher.click();
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
  console.log('Game library E2E passed (no unpublished content, filters, privacy, tool handoff, mobile, bilingual).');
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
}
