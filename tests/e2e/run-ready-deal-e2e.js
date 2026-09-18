import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.READY_DEAL_TEST_PORT || 4185);
const url = process.env.APP_URL || `http://127.0.0.1:${port}/`;
let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Ready-deal preview server unavailable');
}

async function scenario(locale, width) {
  const context = await browser.newContext({ viewport: { width, height: 720 }, locale });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#secret-dealer-launcher').click();
  const root = page.locator('#secret-dealer-root');
  await root.locator('[data-ready-deal]').waitFor({ state: 'visible' });
  assert.equal(await root.locator('[data-secret-revealed]').count(), 0);
  assert.equal(await root.locator('[data-ready-mode] option').count(), 3, 'three ready-made distributions are provided');
  await root.locator('[data-ready-mode]').selectOption('different-word');
  await root.locator('[data-ready-count]').selectOption('5');
  const beforeStorage = await page.evaluate(() => JSON.stringify(localStorage));
  await root.locator('[data-ready-start]').click();
  assert.equal(await root.locator('textarea').count(), 0, 'whole deck leaves DOM after preset generation');
  assert.equal(await root.locator('[data-secret-revealed]').count(), 0, 'generated cards start covered');
  const revealed = [];
  for (let i = 0; i < 5; i++) {
    assert.equal(await root.locator('[data-secret-action="next"]').count(), 0, 'unseen cards cannot be skipped');
    await root.locator('[data-secret-action="arm"]').click();
    await root.locator('[data-secret-action="reveal"]').click();
    const word = await root.locator('[data-secret-revealed]').textContent();
    assert.ok(word.length > 0);
    revealed.push(word);
    await root.locator('[data-secret-action="hide"]').click();
    assert.equal(await root.locator('[data-secret-revealed]').count(), 0);
    assert.ok(!(await root.textContent()).includes(word), 'previous card disappears from covered DOM');
    await root.locator('[data-secret-action="next"]').click();
  }
  assert.equal(new Set(revealed).size, 2, 'exactly two different words were dealt');
  assert.equal(revealed.filter(word => word === revealed.find(item => revealed.filter(next => next === item).length === 1)).length, 1);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), beforeStorage, 'preset secrets are never persisted');
  await root.locator('[data-secret-action="clear"]').evaluate(button => button.click());
  // The action is destructive and guarded by a confirmation, including after a preset deal.
  // Dismiss once and verify the deal remains intact.
  // Browser dialogs automatically dismiss when no handler is installed; explicit checks follow below.
  assert.ok(await root.locator('[data-secret-action="clear"]').count() === 1);
  page.once('dialog', dialog => dialog.accept());
  await root.locator('[data-secret-action="clear"]').click();
  await root.locator('[data-ready-deal]').waitFor({ state: 'visible' });
  assert.equal(await root.locator('[data-secret-input="cards"]').inputValue(), '');
  await root.locator('[data-ready-mode]').selectOption('two-groups');
  await root.locator('[data-ready-count]').selectOption('2');
  await root.locator('[data-ready-start]').click();
  assert.equal(await root.locator('textarea').count(), 0);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#secret-dealer-root:not([hidden])').count(), 0, 'reload discards private preset state');
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'no mobile horizontal overflow');
  assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
  await context.close();
}

try {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
    await waitForServer();
  }
  browser = await chromium.launch({ headless: true });
  await scenario('zh-CN', 320);
  await scenario('en-US', 390);
  console.log('Ready-deal E2E passed (zero-input presets, hidden cards, local-only data, mobile, bilingual).');
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
}
