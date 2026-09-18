import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.SUBPATH_TEST_PORT || 4174);
const basePath = '/boardgame-helper/';
const origin = `http://127.0.0.1:${port}`;
const appUrl = `${origin}${basePath}`;
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
  throw new Error(`Subpath test server did not become ready at ${target}`);
}

async function run() {
  server = spawn(process.execPath, ['scripts/serve-static.js', 'dist'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), BASE_PATH: basePath },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr.on('data', chunk => process.stderr.write(chunk));
  await waitForServer(appUrl);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const consoleErrors = [];
  const outsideBaseRequests = [];

  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('request', request => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin === origin && !requestUrl.pathname.startsWith(basePath)) {
      outsideBaseRequests.push(requestUrl.pathname);
    }
  });

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /桌游助手/);
  await page.locator('[data-template]').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-template]').count(), 6);

  assert.equal(await page.locator('link[rel="manifest"]').getAttribute('href'), './manifest.json');
  const manifest = await page.evaluate(async () => {
    const response = await fetch('./manifest.json');
    return { ok: response.ok, body: await response.json() };
  });
  assert.equal(manifest.ok, true);
  assert.equal(manifest.body.start_url, './');
  assert.equal(manifest.body.scope, './');
  assert.equal(manifest.body.id, './');
  assert.ok(manifest.body.icons.every(icon => icon.src.startsWith('./')));

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.equal(scope, appUrl);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  assert.deepEqual(outsideBaseRequests, [], `Requests escaped base path: ${outsideBaseRequests.join(', ')}`);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-template]').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-template]').count(), 6);
  await page.locator('#game-library-launcher').click();
  const library = page.locator('#game-library-root [role="dialog"]');
  await library.locator('[data-library-player-choices]').waitFor({ state: 'visible' });
  await library.locator('[data-library-player-choice="4"]').click();
  assert.equal(await library.locator('[data-game-players]').inputValue(), '4', 'offline player choice uses the real catalog filter');
  assert.equal(await library.locator('[data-game-detail]').count(), 0, 'offline draft candidates remain private');
  await page.keyboard.press('Escape');
  await context.setOffline(false);

  await page.goto(`${appUrl}privacy.html`, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /隐私政策/);
  await Promise.all([
    page.waitForURL(appUrl),
    page.getByRole('link', { name: /返回应用/ }).click()
  ]);
  await page.locator('[data-template]').first().waitFor({ state: 'visible' });

  assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);
  console.log(JSON.stringify({
    event: 'subpath-e2e-summary',
    status: 'PASS',
    basePath,
    checks: ['relative assets', 'relative manifest', 'scoped service worker', 'offline reload and player choices', 'privacy return navigation']
  }, null, 2));
}

run().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
