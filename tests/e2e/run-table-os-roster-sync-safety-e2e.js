import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_SYNC_TEST_PORT || 4182);
const url = process.env.APP_URL || `http://127.0.0.1:${port}`;
let server;
let browser;

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try { if ((await fetch(url)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Table OS roster-sync E2E server did not become ready at ${url}`);
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], {
      cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer();
  }

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors = [];
  const confirmMessages = [];
  let dismissNextConfirm = false;

  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    assert.equal(dialog.type(), 'confirm');
    confirmMessages.push(dialog.message());
    if (dismissNextConfirm) {
      dismissNextConfirm = false;
      await dialog.dismiss();
    } else {
      await dialog.accept();
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '高级桌游助手' }).click();
  await page.getByRole('button', { name: '编辑配置' }).click();
  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'first open syncs the four default main-game players');

  await page.getByRole('button', { name: '添加参与者' }).click();
  const extraName = page.locator('[data-os-participant-name]').last();
  await extraName.fill('本地访客');
  await extraName.blur();
  assert.equal(await page.locator('[data-os-participant-name]').count(), 5);

  await page.getByRole('button', { name: '同步当前玩家' }).click();
  assert.equal(confirmMessages.length, 0, 'non-destructive roster sync does not ask for confirmation');
  assert.equal(await page.locator('[data-os-participant-name]').count(), 5, 'assistant-only participant survives non-destructive sync');

  const originalMainState = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')));
  await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('board-game-assistant-state-v2'));
    game.players = game.players.slice(0, 3);
    localStorage.setItem('board-game-assistant-state-v2', JSON.stringify(game));
  });
  const beforeDestructiveRaw = await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1'));

  dismissNextConfirm = true;
  await page.getByRole('button', { name: '同步当前玩家' }).click();
  assert.equal(confirmMessages.length, 1, 'destructive roster sync asks for explicit confirmation');
  assert.match(confirmMessages[0], /私密身份/, 'sync confirmation discloses private-role cleanup');
  assert.match(confirmMessages[0], /状态\/追踪值/, 'sync confirmation discloses related live-value cleanup');
  assert.match(confirmMessages[0], /无法撤销/, 'sync confirmation discloses irreversibility');
  assert.equal(await page.evaluate(() => localStorage.getItem('board-game-assistant-table-os-v1')), beforeDestructiveRaw, 'canceling destructive sync leaves Table OS persisted state unchanged');
  assert.equal(await page.locator('[data-os-participant-name]').count(), 5);

  await page.getByRole('button', { name: '同步当前玩家' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')).participants.length === 4);
  const synced = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.equal(confirmMessages.length, 2, 'accepted destructive sync still passes through the confirmation boundary');
  assert.equal(synced.participants.filter(item => item.sourcePlayerId).length, 3, 'retired source-linked participant is removed');
  assert.ok(synced.participants.some(item => item.sourcePlayerId === null && item.name === '本地访客'), 'assistant-only participant is preserved');

  await page.evaluate(state => localStorage.setItem('board-game-assistant-state-v2', JSON.stringify(state)), originalMainState);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(JSON.stringify({ event: 'table-os-roster-sync-safety-e2e-summary', status: 'PASS' }));
}

run().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
