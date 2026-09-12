import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

const bridge = `import { TABLE_OS_STORAGE_KEY, parseTableOsState, scoreCardForParticipant } from './tabletop-core.js';

export const TABLE_OS_COMPANION_STORAGE_KEY = 'board-game-assistant-table-os-companion-v1';

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_) {}
  return null;
}

function mainSessionIdentity(game) {
  const rounds = Array.isArray(game?.score?.rounds) ? game.score.rounds : [];
  const firstRound = rounds.find(round => Number(round?.round) === 1);
  const createdAt = typeof firstRound?.createdAt === 'string' ? firstRound.createdAt.trim() : '';
  if (createdAt) return \`round:\${createdAt}\`;
  const startedAt = typeof game?.session?.startedAt === 'string' ? game.session.startedAt.trim() : '';
  return startedAt ? \`start:\${startedAt}\` : '';
}

function associatedMainSessionId(storage) {
  try {
    const raw = storage?.getItem(TABLE_OS_COMPANION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return typeof parsed?.associatedMainSessionId === 'string' ? parsed.associatedMainSessionId : '';
  } catch (_) {
    return '';
  }
}

function readTableState(storage) {
  try {
    const raw = storage?.getItem(TABLE_OS_STORAGE_KEY);
    return raw ? parseTableOsState(raw) : null;
  } catch (_) {
    return null;
  }
}

export function buildTableOsArchiveSummary(mainGame, storage = defaultStorage()) {
  if (!storage) return null;
  const sessionId = mainSessionIdentity(mainGame);
  if (!sessionId || associatedMainSessionId(storage) !== sessionId) return null;
  const state = readTableState(storage);
  if (!state) return null;

  const hasWorkspace = Boolean(
    state.trackers.length || state.phases.items.length || state.teams.length ||
    state.scoreSheet.fields.length || state.campaign.enabled
  );
  if (!hasWorkspace) return null;

  const activePhase = state.phases.items[state.phases.activeIndex] || null;
  const scores = state.scoreSheet.fields.length
    ? state.participants.slice(0, 32).map(participant => ({
        name: participant.name,
        color: participant.color,
        total: scoreCardForParticipant(state, participant.id).total
      }))
    : [];

  return {
    templateId: String(state.appliedTemplateId || '').slice(0, 32),
    phaseName: String(activePhase?.name || '').slice(0, 40),
    phaseCycle: Math.max(1, Math.min(9999, Math.round(Number(state.phases.cycle) || 1))),
    campaign: state.campaign.enabled ? {
      name: String(state.campaign.name || '').slice(0, 60),
      chapter: String(state.campaign.chapter || '').slice(0, 60),
      sessionNumber: Math.max(1, Math.min(9999, Math.round(Number(state.campaign.sessionNumber) || 1)))
    } : null,
    scores
  };
}
`;
fs.writeFileSync('src/tabletop-archive-bridge.js', bridge);

let archive = fs.readFileSync('src/archive.js', 'utf8');
archive = replaceOnce(archive,
`function clampInt(value, min, max, fallback = min) {\n  const number = Math.round(Number(value));\n  if (!Number.isFinite(number)) return fallback;\n  return Math.min(max, Math.max(min, number));\n}\n`,
`function clampInt(value, min, max, fallback = min) {\n  const number = Math.round(Number(value));\n  if (!Number.isFinite(number)) return fallback;\n  return Math.min(max, Math.max(min, number));\n}\n\nfunction safeNumber(value, min = -1000000, max = 1000000, fallback = 0) {\n  const parsed = Number(value);\n  if (!Number.isFinite(parsed)) return fallback;\n  return Math.round(Math.min(max, Math.max(min, parsed)) * 100) / 100;\n}\n`, 'archive safeNumber');
archive = replaceOnce(archive,
`export function normalizeArchiveEntry(input) {\n`,
`function normalizeTableOsSummary(input) {\n  if (!input || typeof input !== 'object') return null;\n  const campaign = input.campaign && typeof input.campaign === 'object' ? {\n    name: String(input.campaign.name ?? '').slice(0, 60),\n    chapter: String(input.campaign.chapter ?? '').slice(0, 60),\n    sessionNumber: clampInt(input.campaign.sessionNumber, 1, 9999, 1)\n  } : null;\n  const scores = (Array.isArray(input.scores) ? input.scores : []).slice(0, 32).map((score, index) => ({\n    name: String(score?.name ?? \`Player \${index + 1}\`).slice(0, 40),\n    color: safeColor(score?.color),\n    total: safeNumber(score?.total)\n  }));\n  return {\n    templateId: String(input.templateId ?? '').slice(0, 32),\n    phaseName: String(input.phaseName ?? '').slice(0, 40),\n    phaseCycle: clampInt(input.phaseCycle, 1, 9999, 1),\n    campaign,\n    scores\n  };\n}\n\nexport function normalizeArchiveEntry(input) {\n`, 'archive summary normalizer');
archive = replaceOnce(archive,
`    timerMode: ['turn', 'chess', 'pool', 'round'].includes(source.timerMode) ? source.timerMode : null,\n    baseSeconds: clampInt(source.baseSeconds, 5, 86400, 90)\n`,
`    timerMode: ['turn', 'chess', 'pool', 'round'].includes(source.timerMode) ? source.timerMode : null,\n    baseSeconds: clampInt(source.baseSeconds, 5, 86400, 90),\n    tableOs: normalizeTableOsSummary(source.tableOs)\n`, 'archive tableOs field');
fs.writeFileSync('src/archive.js', archive);

let app = fs.readFileSync('src/app.js', 'utf8');
app = replaceOnce(app,
`import {\n  loadArchive, saveGameToArchive, deleteArchiveEntry, clearArchive\n} from './archive.js';\n`,
`import {\n  loadArchive, saveGameToArchive, deleteArchiveEntry, clearArchive\n} from './archive.js';\nimport { buildTableOsArchiveSummary } from './tabletop-archive-bridge.js';\n`, 'app bridge import');
app = replaceOnce(app,
`            <ol class="archive-ranking">\${game.players.map(player => \`<li style="--player:\${player.color}"><span>\${escapeHtml(player.name || tr('common.removedPlayer'))}</span><strong>\${player.score}</strong></li>\`).join('')}</ol>\n            <div class="archive-actions">`,
`            <ol class="archive-ranking">\${game.players.map(player => \`<li style="--player:\${player.color}"><span>\${escapeHtml(player.name || tr('common.removedPlayer'))}</span><strong>\${player.score}</strong></li>\`).join('')}</ol>\n            \${renderTableOsArchive(game.tableOs)}\n            <div class="archive-actions">`, 'archive render hook');
app = replaceOnce(app,
`function renderSettings() {\n`,
`function renderTableOsArchive(summary) {\n  if (!summary) return '';\n  const details = [];\n  if (summary.phaseName) details.push(tr('archive.tableOsPhase', { phase: summary.phaseName, cycle: summary.phaseCycle }));\n  if (summary.campaign) {\n    const name = summary.campaign.name || tr('archive.tableOsCampaignFallback');\n    const chapter = summary.campaign.chapter ? \` · \${summary.campaign.chapter}\` : '';\n    details.push(tr('archive.tableOsCampaign', { name, chapter, session: summary.campaign.sessionNumber }));\n  }\n  return \`<div class="archive-tableos"><strong>\${tr('archive.tableOs')}</strong>\${details.length ? \`<p class="inline-note">\${details.map(escapeHtml).join(' · ')}</p>\` : ''}\${summary.scores.length ? \`<p class="inline-note">\${tr('archive.tableOsScores')}</p><ol class="archive-ranking">\${summary.scores.map(score => \`<li style="--player:\${score.color}"><span>\${escapeHtml(score.name)}</span><strong>\${score.total}</strong></li>\`).join('')}</ol>\` : ''}</div>\`;\n}\n\nfunction tableOsArchiveLines(summary) {\n  if (!summary) return [];\n  const lines = [tr('archive.tableOs')];\n  if (summary.phaseName) lines.push(tr('archive.tableOsPhase', { phase: summary.phaseName, cycle: summary.phaseCycle }));\n  if (summary.campaign) {\n    const name = summary.campaign.name || tr('archive.tableOsCampaignFallback');\n    const chapter = summary.campaign.chapter ? \` · \${summary.campaign.chapter}\` : '';\n    lines.push(tr('archive.tableOsCampaign', { name, chapter, session: summary.campaign.sessionNumber }));\n  }\n  if (summary.scores.length) {\n    lines.push(tr('archive.tableOsScores'));\n    summary.scores.forEach(score => lines.push(\`\${score.name}: \${score.total}\`));\n  }\n  return lines;\n}\n\nfunction renderSettings() {\n`, 'archive helpers');
app = replaceOnce(app,
`    ...game.players.map(player => \`\${player.rank}. \${player.name}: \${player.score}\`)\n  ];`,
`    ...game.players.map(player => \`\${player.rank}. \${player.name}: \${player.score}\`),\n    ...tableOsArchiveLines(game.tableOs)\n  ];`, 'copy archive tableos');
app = replaceOnce(app,
`    finishedAt: currentState.session.finishedAt,\n    players: ranked.map(({ player, rank, score }) => ({`,
`    finishedAt: currentState.session.finishedAt,\n    tableOs: buildTableOsArchiveSummary(currentState),\n    players: ranked.map(({ player, rank, score }) => ({`, 'build archive snapshot');
fs.writeFileSync('src/app.js', app);

let i18n = fs.readFileSync('src/i18n.js', 'utf8');
let archiveKeyCount = 0;
i18n = i18n.replace(/(    'archive\.rematchConfirm': [^\n]+\n)/g, match => {
  archiveKeyCount += 1;
  if (archiveKeyCount === 1) return match +
`    'archive.tableOs': 'Table OS 摘要', 'archive.tableOsPhase': '阶段：{phase} · 周期 {cycle}',\n    'archive.tableOsCampaign': '战役：{name}{chapter} · 第 {session} 局', 'archive.tableOsCampaignFallback': '战役',\n    'archive.tableOsScores': '高级计分',\n`;
  return match +
`    'archive.tableOs': 'Table OS summary', 'archive.tableOsPhase': 'Phase: {phase} · Cycle {cycle}',\n    'archive.tableOsCampaign': 'Campaign: {name}{chapter} · Session {session}', 'archive.tableOsCampaignFallback': 'Campaign',\n    'archive.tableOsScores': 'Advanced scores',\n`;
});
if (archiveKeyCount !== 2) throw new Error(`Expected 2 archive.rematchConfirm anchors, got ${archiveKeyCount}`);
fs.writeFileSync('src/i18n.js', i18n);

const unit = `import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState, syncParticipantsFromGame, applyAssistantTemplate,
  setScoreSheetValue, setRole, setActivePhase, serializeTableOsState
} from '../../src/tabletop-core.js';
import {
  buildTableOsArchiveSummary, TABLE_OS_COMPANION_STORAGE_KEY
} from '../../src/tabletop-archive-bridge.js';
import { TABLE_OS_STORAGE_KEY } from '../../src/tabletop-core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}

test('Table OS archive summary is session-bound and strips private role data', () => {
  const storage = memoryStorage();
  const game = {
    session: { startedAt: '2026-09-12T12:00:00.000Z' },
    score: { rounds: [{ round: 1, createdAt: '2026-09-12T12:00:01.000Z' }] }
  };
  const state = createDefaultTableOsState();
  syncParticipantsFromGame(state, [{ id: 'p1', name: 'Alice', color: '#f97316' }]);
  applyAssistantTemplate(state, 'campaign');
  const player = state.participants[0];
  const scoreField = state.scoreSheet.fields[0];
  setScoreSheetValue(state, player.id, scoreField.id, 12.5);
  setRole(state, player.id, { role: 'Secret Agent', faction: 'Hidden', note: 'Moderator only', secret: true });
  state.campaign.name = 'Friday Legacy';
  state.campaign.chapter = 'Chapter 3';
  state.campaign.sessionNumber = 4;
  setActivePhase(state, 2);
  state.phases.cycle = 3;
  storage.setItem(TABLE_OS_STORAGE_KEY, serializeTableOsState(state));
  storage.setItem(TABLE_OS_COMPANION_STORAGE_KEY, JSON.stringify({ associatedMainSessionId: 'round:2026-09-12T12:00:01.000Z' }));

  const summary = buildTableOsArchiveSummary(game, storage);
  assert.equal(summary.phaseName, '遭遇');
  assert.equal(summary.phaseCycle, 3);
  assert.equal(summary.campaign.name, 'Friday Legacy');
  assert.equal(summary.campaign.chapter, 'Chapter 3');
  assert.equal(summary.campaign.sessionNumber, 4);
  assert.equal(summary.scores[0].name, 'Alice');
  assert.equal(summary.scores[0].total, 12.5);
  assert.equal(JSON.stringify(summary).includes('Secret Agent'), false);
  assert.equal(JSON.stringify(summary).includes('Moderator only'), false);

  storage.setItem(TABLE_OS_COMPANION_STORAGE_KEY, JSON.stringify({ associatedMainSessionId: 'round:other' }));
  assert.equal(buildTableOsArchiveSummary(game, storage), null, 'stale Table OS state is not attached to a different main session');
});
`;
fs.writeFileSync('tests/unit/tabletop-archive-bridge.test.js', unit);

let packageJson = fs.readFileSync('package.json', 'utf8');
const pkg = JSON.parse(packageJson);
pkg.scripts['test:e2e'] = 'node tests/e2e/run-e2e.js && node tests/e2e/run-table-os-e2e.js && node tests/e2e/run-table-os-companion-e2e.js && node tests/e2e/run-table-os-archive-e2e.js';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const e2e = `import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = Number(process.env.TABLE_OS_ARCHIVE_TEST_PORT || 4176);
const url = process.env.APP_URL || \`http://127.0.0.1:\${port}\`;
let server = null;
let browser = null;

async function waitForServer(target, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const response = await fetch(target); if (response.ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(\`Archive bridge test server did not become ready at \${target}\`);
}

async function run() {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['scripts/serve-static.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForServer(url);
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '开始桌游局' }).click();

  await page.getByRole('button', { name: '高级桌游助手' }).click();
  await page.getByRole('button', { name: '编辑配置' }).click();
  await page.locator('[data-os-template]').selectOption('engine-score');
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '计分表', exact: true }).click();
  const values = page.locator('[data-os-score-value]');
  await values.nth(0).fill('12'); await values.nth(0).blur();
  await values.nth(1).fill('4'); await values.nth(1).blur();
  await values.nth(2).fill('0'); await values.nth(2).blur();
  await values.nth(3).fill('3'); await values.nth(3).blur();
  await page.getByRole('button', { name: '关闭' }).click();

  await page.getByRole('tab', { name: '结算' }).click();
  await page.getByRole('button', { name: '结束本局' }).click();
  await page.getByRole('button', { name: '结束本局' }).count().catch(() => 0);

  const archived = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-archive-v1') || '[]'));
  assert.equal(archived.length, 1);
  assert.ok(archived[0].tableOs, 'finished archive contains a Table OS summary');
  assert.equal(archived[0].tableOs.scores[0].total, 13);
  assert.equal(JSON.stringify(archived[0].tableOs).includes('roles'), false);
  assert.ok(await page.getByText('Table OS 摘要', { exact: true }).isVisible());
  assert.ok(await page.getByText('高级计分', { exact: true }).isVisible());

  console.log(JSON.stringify({ event: 'table-os-archive-e2e-summary', status: 'PASS', checks: ['session-bound snapshot', 'advanced score archived', 'private roles excluded', 'archive summary rendered'] }, null, 2));
  await context.close();
}

run().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  server?.kill('SIGTERM');
});
`;
fs.writeFileSync('tests/e2e/run-table-os-archive-e2e.js', e2e);
