import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createDefaultState, ensureRound, recalculateScores, STORAGE_KEY } from '../src/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.STORE_ASSET_PORT || 4179);
const baseUrl = `http://127.0.0.1:${port}`;

const devices = [
  { id: 'google-phone', output: 'google-play-assets/screenshots', width: 450, height: 800, scale: 2.4 },
  { id: 'google-tablet', output: 'google-play-assets/screenshots', width: 1280, height: 720, scale: 2 },
  { id: 'iphone-6.9', output: 'app-store-assets/screenshots', width: 430, height: 932, scale: 3 },
  { id: 'ipad-13', output: 'app-store-assets/screenshots', width: 1032, height: 1376, scale: 2 }
];

const screens = ['01-flow', '02-score', '03-history', '04-tools', '05-results'];

function fixture(locale) {
  const state = createDefaultState(locale);
  const names = locale === 'zh' ? ['小林', '阿岚', '可可', '老周'] : ['Maya', 'Noah', 'Zoe', 'Leo'];
  const sessionName = locale === 'zh' ? '周末策略局' : 'Weekend Strategy Night';
  state.screen = 'workspace';
  state.session = { name: sessionName, status: 'active', startedAt: '2026-07-22T11:30:00.000Z', finishedAt: null };
  state.players.forEach((player, index) => { player.name = names[index]; });
  state.timer.round = 3;
  state.timer.remainingSeconds = 78;
  state.timer.activePlayerId = state.players[1].id;
  const roundValues = [
    [[7, 2, 1], [5, 3, 0], [6, 0, 2], [4, 4, 0]],
    [[5, 1, 0], [8, 2, 1], [4, 3, 0], [6, 1, 2]],
    [[3, 0, 0], [2, 1, 0], [5, 2, 1], [4, 0, 0]]
  ];
  roundValues.forEach((players, roundIndex) => {
    const round = ensureRound(state, roundIndex + 1);
    round.createdAt = `2026-07-22T${12 + roundIndex}:00:00.000Z`;
    round.updatedAt = `2026-07-22T${12 + roundIndex}:18:00.000Z`;
    players.forEach((values, playerIndex) => {
      state.score.fields.forEach((field, fieldIndex) => {
        round.scores[state.players[playerIndex].id][field.id] = values[fieldIndex];
      });
    });
  });
  state.score.history = [
    { key: 'score.updatedRound', values: { round: 1 }, at: '2026-07-22T12:18:00.000Z' },
    { key: 'score.adjusted', values: { round: 2, name: names[1], field: locale === 'zh' ? '奖励' : 'Bonus', delta: '+2' }, at: '2026-07-22T13:18:00.000Z' },
    { key: 'score.updatedRound', values: { round: 3 }, at: '2026-07-22T14:18:00.000Z' }
  ];
  state.tools.lastFirstPlayerId = state.players[2].id;
  state.tools.shuffledPlayerIds = [state.players[2].id, state.players[0].id, state.players[3].id, state.players[1].id];
  state.tools.teams = [
    { index: 0, playerIds: [state.players[0].id, state.players[2].id] },
    { index: 1, playerIds: [state.players[1].id, state.players[3].id] }
  ];
  state.tools.history = [
    { type: 'dice', count: 2, sides: 6, modifier: 1, total: 9, rolls: [3, 5], at: '2026-07-22T14:20:00.000Z' },
    { type: 'coin', result: 'heads', at: '2026-07-22T14:21:00.000Z' },
    { type: 'first', playerId: state.players[2].id, at: '2026-07-22T14:22:00.000Z' },
    { type: 'teams', count: 2, at: '2026-07-22T14:23:00.000Z' }
  ];
  recalculateScores(state);
  return state;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Preview server did not start at ${baseUrl}`);
}

async function captureView(page, screen, outputPath) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.paddingBottom = '';
    window.scrollTo(0, 0);
  });

  if (screen === '01-flow') await page.locator('[data-tab="flow"]').click();
  if (screen === '02-score' || screen === '03-history') await page.locator('[data-tab="score"]').click();
  if (screen === '04-tools') await page.locator('[data-tab="tools"]').click();
  if (screen === '05-results') {
    await page.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key));
      state.session.status = 'finished';
      state.session.finishedAt = '2026-07-22T14:30:00.000Z';
      state.activeTool = 'summary';
      localStorage.setItem(key, JSON.stringify(state));
    }, STORAGE_KEY);
    await page.reload();
    await page.locator('[data-tab="summary"]').click();
  }

  if (screen === '03-history') {
    // Tall tablet viewports can fit both the score editor and history section,
    // which makes scrollIntoViewIfNeeded() a no-op and produces a duplicate of
    // the score screenshot. Temporary bottom space guarantees enough scroll
    // range to anchor the history section at the top without changing app UI.
    await page.evaluate(() => { document.body.style.paddingBottom = '100vh'; });
    await page.locator('.round-history').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'auto' }));
  }

  await page.waitForTimeout(50);
  await page.screenshot({ path: outputPath, type: 'png', animations: 'disabled' });
}

async function createFeatureGraphic(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f8fafc}
    body{background:radial-gradient(circle at 16% 20%,#164e63 0,transparent 34%),radial-gradient(circle at 82% 76%,#713f12 0,transparent 32%),#07111f;padding:56px 68px;display:grid;grid-template-columns:1fr 390px;gap:54px;align-items:center}
    .eyebrow{color:#5eead4;font-size:19px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.title{font-size:54px;line-height:1.05;margin:16px 0 18px;font-weight:900}.sub{font-size:23px;line-height:1.45;color:#cbd5e1;max-width:530px}.card{height:350px;border:1px solid rgba(148,163,184,.28);border-radius:36px;background:rgba(15,23,42,.9);box-shadow:0 30px 70px rgba(0,0,0,.4);padding:28px;text-align:center}.round{color:#94a3b8;font-size:17px}.player{font-size:25px;font-weight:800;margin-top:25px}.timer{font-variant-numeric:tabular-nums;font-size:94px;font-weight:900;margin:14px 0;color:#f8fafc}.controls{display:flex;justify-content:center;gap:14px}.controls span{padding:13px 22px;border-radius:999px;background:#172033;color:#e2e8f0;font-weight:800}.controls .main{background:#14b8a6;color:#042f2e}.chips{display:flex;gap:12px;margin-top:25px}.chip{height:8px;flex:1;border-radius:99px}.orange{background:#f97316}.teal{background:#14b8a6}.blue{background:#3b82f6}.yellow{background:#eab308}
  </style><body><section><div class="eyebrow">Board Game Assistant</div><div class="title">桌游助手</div><div class="sub">计时、计分、随机工具与结算<br>Timing, scoring, random tools & results</div></section><section class="card"><div class="round">第 3 轮 · ROUND 3</div><div class="player">阿岚 · YOUR TURN</div><div class="timer">01:18</div><div class="controls"><span>−30</span><span class="main">暂停</span><span>+30</span></div><div class="chips"><i class="chip orange"></i><i class="chip teal"></i><i class="chip blue"></i><i class="chip yellow"></i></div></section></body></html>`);
  const output = path.join(root, 'google-play-assets', 'feature-graphic-1024x500.jpg');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, type: 'jpeg', quality: 96 });
  await page.close();
}

async function main() {
  const server = spawn(process.execPath, ['scripts/serve-static.js', 'dist'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch();
    await createFeatureGraphic(browser);
    for (const locale of ['zh', 'en']) {
      for (const device of devices) {
        const context = await browser.newContext({
          viewport: { width: device.width, height: device.height },
          deviceScaleFactor: device.scale,
          colorScheme: 'dark',
          locale: locale === 'zh' ? 'zh-CN' : 'en-US'
        });
        await context.addInitScript(({ key, value }) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, value);
        }, { key: STORAGE_KEY, value: JSON.stringify(fixture(locale)) });
        const page = await context.newPage();
        await page.goto(baseUrl);
        await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}html{scrollbar-width:none}::-webkit-scrollbar{display:none}' });
        const localeDir = path.join(root, device.output, locale);
        await fs.mkdir(localeDir, { recursive: true });
        for (const screen of screens) {
          const outputPath = path.join(localeDir, `${device.id}-${screen}.png`);
          await captureView(page, screen, outputPath);
          process.stdout.write(`Generated ${path.relative(root, outputPath)}\n`);
        }
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
