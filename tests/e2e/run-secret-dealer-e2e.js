import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.SECRET_DEALER_TEST_PORT || 4184);
const url = process.env.APP_URL || `http://127.0.0.1:${port}/`;
let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Secret dealer server unavailable: ${url}`);
}

async function checkNoSecrets(page, secrets) {
  const text = await page.locator('#secret-dealer-root').textContent();
  for (const secret of secrets) assert.ok(!text.includes(secret), `Private content leaked into covered DOM: ${secret}`);
  assert.equal(await page.locator('[data-secret-revealed]').count(), 0);
}

async function flow(language) {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, locale: language });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  if (language === 'en-US') await page.evaluate(() => { document.documentElement.lang = 'en'; });
  await page.locator('#secret-dealer-launcher').click();
  const root = page.locator('#secret-dealer-root');
  assert.equal(await root.locator('[role="dialog"]').count(), 1);
  assert.ok(await page.locator('#secret-dealer-launcher').isVisible());

  // No partial session on a mismatch; user input is retained for correction.
  await root.locator('[data-secret-input="names"]').fill('甲\n乙\n丙');
  await root.locator('[data-secret-input="cards"]').fill('ONLY_ONE_SECRET');
  await root.locator('[data-secret-action="deal"]').click();
  assert.equal(await root.locator('[role="alert"]').count(), 1);
  assert.equal(await root.locator('[data-secret-input="cards"]').inputValue(), 'ONLY_ONE_SECRET');

  const secrets = ['PRIVATE_ALPHA_91', 'PRIVATE_BETA_92', 'PRIVATE_GAMMA_93'];
  await root.locator('[data-secret-input="cards"]').fill(secrets.join('\n'));
  await root.locator('[data-secret-input="steps"]').fill('公布开始\n轮流发言');
  await root.locator('[data-secret-action="deal"]').click();
  assert.equal(await root.locator('textarea').count(), 0, 'full deck editor must leave DOM after deal');
  await checkNoSecrets(page, secrets);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('PRIVATE_ALPHA_91')), false, 'no secret stored in localStorage');

  for (let i = 0; i < 3; i++) {
    assert.equal(await root.locator('[data-secret-action="next"]').count(), 0, 'cannot skip an unseen private card');
    await root.locator('[data-secret-action="arm"]').click();
    await checkNoSecrets(page, secrets);
    await root.locator('[data-secret-action="reveal"]').click();
    const revealed = await root.locator('[data-secret-revealed]').textContent();
    assert.ok(secrets.includes(revealed));
    const text = await root.textContent();
    assert.equal(secrets.filter(secret => text.includes(secret)).length, 1, 'only intended secret is rendered');
    // Escape and backgrounding both re-cover the content.
    if (i === 0) {
      await page.keyboard.press('Escape');
      await checkNoSecrets(page, secrets);
      await root.locator('[data-secret-action="arm"]').click();
      await root.locator('[data-secret-action="reveal"]').click();
    }
    await root.locator('[data-secret-action="hide"]').click();
    await checkNoSecrets(page, secrets);
    await root.locator('[data-secret-action="next"]').click();
    await checkNoSecrets(page, secrets);
  }
  assert.equal(await root.locator('[data-secret-action="following"]').count(), 1);
  await root.locator('[data-secret-action="following"]').click();
  assert.ok((await root.textContent()).includes('轮流发言'));
  await root.locator('[data-secret-action="previous"]').click();
  assert.ok((await root.textContent()).includes('公布开始'));

  // Cancel is non-destructive; confirmation clears secrets and returns to empty editor.
  page.once('dialog', dialog => dialog.dismiss());
  await root.locator('[data-secret-action="clear"]').click();
  assert.equal(await root.locator('[data-secret-action="following"]').count(), 1);
  page.once('dialog', dialog => dialog.accept());
  await root.locator('[data-secret-action="clear"]').click();
  assert.equal(await root.locator('textarea').count(), 3);
  assert.equal(await root.locator('[data-secret-input="cards"]').inputValue(), '');
  await checkNoSecrets(page, secrets);

  // A subsequent deal is also discarded on reload, never restored from local storage.
  await root.locator('[data-secret-input="names"]').fill('A\nB');
  await root.locator('[data-secret-input="cards"]').fill('EXTRA_SECRET_1\nEXTRA_SECRET_2');
  await root.locator('[data-secret-action="deal"]').click();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#secret-dealer-root:not([hidden])').count(), 0);
  await page.locator('#secret-dealer-launcher').click();
  assert.equal(await root.locator('[data-secret-input="cards"]').inputValue(), '');
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('EXTRA_SECRET_1')), false);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 1, `secret dealer overflows ${language} 320px viewport by ${overflow}px`);
  assert.deepEqual(errors, [], `browser console errors: ${errors.join(' | ')}`);
  await context.close();
}

try {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], {
      cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: 'ignore'
    });
    await waitForServer();
  }
  browser = await chromium.launch({ headless: true });
  await flow('zh-CN');
  await flow('en-US');
  console.log('Secret dealer E2E passed (private DOM, cancellation, refresh, 320px, bilingual).');
} finally {
  await browser?.close();
  server?.kill();
}
