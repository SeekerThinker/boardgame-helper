from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, content):
    Path(path).write_text(content, encoding='utf-8')


def replace_once(source, before, after, label):
    if before not in source:
        raise RuntimeError(f'{label} anchor not found')
    return source.replace(before, after, 1)


# Share the companion session identity as a pure helper so archive capture can
# verify that Table OS actually belongs to the game being finished.
core_path = 'src/tabletop-core.js'
core = read(core_path)
core = replace_once(
    core,
    "export const TABLE_OS_STORAGE_KEY = 'board-game-assistant-table-os-v1';\n",
    """export const TABLE_OS_STORAGE_KEY = 'board-game-assistant-table-os-v1';
export const TABLE_OS_COMPANION_STORAGE_KEY = 'board-game-assistant-table-os-companion-v1';

export function tableOsMainSessionIdentity(game) {
  const rounds = Array.isArray(game?.score?.rounds) ? game.score.rounds : [];
  const firstRound = rounds.find(round => Number(round?.round) === 1);
  const createdAt = typeof firstRound?.createdAt === 'string' ? firstRound.createdAt.trim() : '';
  if (createdAt) return `round:${createdAt}`;
  const startedAt = typeof game?.session?.startedAt === 'string' ? game.session.startedAt.trim() : '';
  return startedAt ? `start:${startedAt}` : '';
}
""",
    'tabletop-core session helper'
)
write(core_path, core)


companion_path = 'src/tabletop-companion.js'
companion = read(companion_path)
companion = replace_once(
    companion,
    "import { TABLE_OS_STORAGE_KEY } from './tabletop-core.js';\n\nconst COMPANION_STORAGE_KEY = 'board-game-assistant-table-os-companion-v1';\n",
    "import { TABLE_OS_STORAGE_KEY, TABLE_OS_COMPANION_STORAGE_KEY, tableOsMainSessionIdentity } from './tabletop-core.js';\n",
    'companion imports'
)
companion = companion.replace('COMPANION_STORAGE_KEY', 'TABLE_OS_COMPANION_STORAGE_KEY')
identity_start = companion.find('function mainSessionIdentity(game) {')
identity_end = companion.find('\nfunction tableHasSessionState', identity_start)
if identity_start < 0 or identity_end < 0:
    raise RuntimeError('companion identity helper boundary not found')
companion = companion[:identity_start] + companion[identity_end + 1:]
companion = companion.replace('const currentId = mainSessionIdentity(game);', 'const currentId = tableOsMainSessionIdentity(game);', 1)
write(companion_path, companion)


# Archive only a bounded, privacy-safe summary. Roles, factions, moderator
# notes, phase notes, campaign notes and checkpoint labels never cross over.
archive_path = 'src/archive.js'
archive = read(archive_path)
archive = replace_once(
    archive,
    "import { STORAGE_KEY, uid } from './core.js';\n",
    """import { STORAGE_KEY, uid } from './core.js';
import {
  TABLE_OS_STORAGE_KEY, TABLE_OS_COMPANION_STORAGE_KEY, normalizeTableOsState,
  scoreCardForParticipant, tableOsMainSessionIdentity
} from './tabletop-core.js';
""",
    'archive imports'
)
archive = replace_once(
    archive,
    """function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#64748b';
}
""",
    """function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#64748b';
}

function safeNumber(value, min = -1000000, max = 1000000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(Math.min(max, Math.max(min, parsed)) * 100) / 100;
}

function safeText(value, max = 60) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeTableOsArchiveSummary(input) {
  if (!input || typeof input !== 'object') return null;
  const scores = (Array.isArray(input.scores) ? input.scores : []).slice(0, 32).map(item => ({
    name: safeText(item?.name, 40),
    color: safeColor(item?.color),
    total: safeNumber(item?.total)
  }));
  const trackers = (Array.isArray(input.trackers) ? input.trackers : []).slice(0, 8).map(tracker => ({
    name: safeText(tracker?.name, 40),
    persistence: tracker?.persistence === 'campaign' ? 'campaign' : 'session',
    values: (Array.isArray(tracker?.values) ? tracker.values : []).slice(0, 8).map(value => ({
      label: safeText(value?.label, 40),
      value: safeNumber(value?.value)
    }))
  })).filter(tracker => tracker.name && tracker.values.length);
  const phase = input.phase && typeof input.phase === 'object' && safeText(input.phase.name, 60)
    ? { name: safeText(input.phase.name, 60), cycle: clampInt(input.phase.cycle, 1, 9999, 1) }
    : null;
  const campaign = input.campaign && typeof input.campaign === 'object'
    ? {
        name: safeText(input.campaign.name, 60),
        chapter: safeText(input.campaign.chapter, 60),
        sessionNumber: clampInt(input.campaign.sessionNumber, 1, 9999, 1),
        completedFlags: clampInt(input.campaign.completedFlags, 0, 40, 0),
        totalFlags: clampInt(input.campaign.totalFlags, 0, 40, 0)
      }
    : null;
  if (!scores.length && !trackers.length && !phase && !campaign) return null;
  return { templateId: safeText(input.templateId, 32), scores, trackers, phase, campaign };
}

function readJson(storage, key) {
  try {
    const raw = safeStorage(storage).getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function buildTableOsArchiveSummary(storage, liveGame) {
  const liveSessionId = tableOsMainSessionIdentity(liveGame);
  if (!liveSessionId) return null;
  const companion = readJson(storage, TABLE_OS_COMPANION_STORAGE_KEY);
  if (String(companion?.associatedMainSessionId || '') !== liveSessionId) return null;
  const rawTable = readJson(storage, TABLE_OS_STORAGE_KEY);
  if (!rawTable) return null;

  const table = normalizeTableOsState(rawTable);
  const participantById = new Map(table.participants.map(item => [item.id, item]));
  const teamById = new Map(table.teams.map(item => [item.id, item]));
  const trackers = table.trackers.map(tracker => {
    const values = Object.entries(tracker.values || {}).slice(0, 8).map(([id, value]) => ({
      label: tracker.scope === 'participant'
        ? (participantById.get(id)?.name || '')
        : (tracker.scope === 'team' ? (teamById.get(id)?.name || '') : ''),
      value
    }));
    return values.length ? { name: tracker.name, persistence: tracker.persistence, values } : null;
  }).filter(Boolean).slice(0, 8);

  const hasScoreValues = Object.values(table.scoreSheet.values || {})
    .some(values => values && Object.keys(values).length > 0);
  const scores = hasScoreValues ? table.participants.slice(0, 32).map(participant => ({
    name: participant.name,
    color: participant.color,
    total: scoreCardForParticipant(table, participant.id).total
  })) : [];

  const activePhase = table.phases.items[table.phases.activeIndex];
  const phaseMoved = Boolean(activePhase) && (table.phases.activeIndex !== 0 || table.phases.cycle !== 1);
  const phase = phaseMoved ? { name: activePhase.name, cycle: table.phases.cycle } : null;
  const campaign = table.campaign.enabled ? {
    name: table.campaign.name,
    chapter: table.campaign.chapter,
    sessionNumber: table.campaign.sessionNumber,
    completedFlags: table.campaign.flags.filter(flag => flag.checked).length,
    totalFlags: table.campaign.flags.length
  } : null;

  return normalizeTableOsArchiveSummary({
    templateId: table.appliedTemplateId,
    scores,
    trackers,
    phase,
    campaign
  });
}
""",
    'archive summary helpers'
)
archive = replace_once(
    archive,
    """    timerMode: ['turn', 'chess', 'pool', 'round'].includes(source.timerMode) ? source.timerMode : null,
    baseSeconds: clampInt(source.baseSeconds, 5, 86400, 90)
""",
    """    timerMode: ['turn', 'chess', 'pool', 'round'].includes(source.timerMode) ? source.timerMode : null,
    baseSeconds: clampInt(source.baseSeconds, 5, 86400, 90),
    tableOs: normalizeTableOsArchiveSummary(source.tableOs)
""",
    'archive normalized Table OS summary'
)
enrich_start = archive.find('function enrichMissingConfig(entry, storage) {')
enrich_end = archive.find('\nexport function loadArchive', enrich_start)
if enrich_start < 0 or enrich_end < 0:
    raise RuntimeError('archive enrich boundary not found')
enrich = """function enrichMissingConfig(entry, storage) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const needsFields = !Array.isArray(source.fields) || source.fields.length === 0;
  const needsTimerMode = !['turn', 'chess', 'pool', 'round'].includes(source.timerMode);
  const baseSeconds = Number(source.baseSeconds);
  const needsBaseSeconds = !Number.isFinite(baseSeconds) || baseSeconds < 5;
  const needsTableOs = source.tableOs == null;
  if (!needsFields && !needsTimerMode && !needsBaseSeconds && !needsTableOs) return source;

  const live = readJson(storage, STORAGE_KEY);
  if (!live) return source;
  return {
    ...source,
    fields: needsFields && Array.isArray(live.score?.fields) ? live.score.fields : source.fields,
    timerMode: needsTimerMode ? live.timer?.mode : source.timerMode,
    baseSeconds: needsBaseSeconds ? live.timer?.baseSeconds : source.baseSeconds,
    tableOs: needsTableOs ? buildTableOsArchiveSummary(storage, live) : source.tableOs
  };
}
"""
archive = archive[:enrich_start] + enrich + archive[enrich_end:]
write(archive_path, archive)


# Render the summary only when a historical game is expanded; the live Results
# surface remains exactly as simple as before.
app_path = 'src/app.js'
app = read(app_path)
render_archive_anchor = 'function renderArchive() {'
render_helper = """function renderArchivedTableOs(game) {
  const table = game?.tableOs;
  if (!table) return '';
  const meta = [];
  if (table.phase) meta.push(tr('archive.tableOsPhase', { phase: table.phase.name, cycle: table.phase.cycle }));
  if (table.campaign) meta.push(tr('archive.tableOsCampaign', {
    name: table.campaign.name || tr('archive.tableOsCampaignFallback'),
    chapter: table.campaign.chapter || '—',
    session: table.campaign.sessionNumber
  }));
  if (table.campaign?.totalFlags) meta.push(tr('archive.tableOsFlags', {
    done: table.campaign.completedFlags,
    total: table.campaign.totalFlags
  }));
  const scores = table.scores?.length
    ? `<p class="inline-note"><strong>${tr('archive.tableOsScores')}</strong></p><ol class="archive-ranking">${table.scores.map(player => `<li style="--player:${player.color}"><span>${escapeHtml(player.name || tr('common.removedPlayer'))}</span><strong>${player.total}</strong></li>`).join('')}</ol>`
    : '';
  const trackers = table.trackers?.length
    ? `<p class="inline-note"><strong>${tr('archive.tableOsTrackers')}</strong></p><div class="history-list">${table.trackers.map(tracker => `<div><span>${escapeHtml(tracker.name)}</span><strong>${tracker.values.map(value => escapeHtml(value.label ? `${value.label}: ${value.value}` : String(value.value))).join(' · ')}</strong></div>`).join('')}</div>`
    : '';
  return `<div data-archive-table-os><p class="inline-note"><strong>${tr('archive.tableOs')}</strong>${meta.length ? ` · ${escapeHtml(meta.join(' · '))}` : ''}</p>${scores}${trackers}</div>`;
}

"""
app = replace_once(app, render_archive_anchor, render_helper + render_archive_anchor, 'app archive helper')
archive_markup_before = """            <ol class="archive-ranking">${game.players.map(player => `<li style="--player:${player.color}"><span>${escapeHtml(player.name || tr('common.removedPlayer'))}</span><strong>${player.score}</strong></li>`).join('')}</ol>
            <div class="archive-actions">
"""
archive_markup_after = """            <ol class="archive-ranking">${game.players.map(player => `<li style="--player:${player.color}"><span>${escapeHtml(player.name || tr('common.removedPlayer'))}</span><strong>${player.score}</strong></li>`).join('')}</ol>
            ${renderArchivedTableOs(game)}
            <div class="archive-actions">
"""
app = replace_once(app, archive_markup_before, archive_markup_after, 'app archive markup')
copy_start = app.find('async function copyArchivedGame(id) {')
copy_end = app.find('\nfunction resumeSessionFlow()', copy_start)
if copy_start < 0 or copy_end < 0:
    raise RuntimeError('copy archive boundary not found')
copy_fn = """async function copyArchivedGame(id) {
  const game = archivedGames.find(item => item.id === id);
  if (!game) return;
  const lines = [
    `${game.name} · ${formatDateTime(game.locale, game.finishedAt)}`,
    ...game.players.map(player => `${player.rank}. ${player.name}: ${player.score}`)
  ];
  if (game.tableOs) {
    lines.push('', tr('archive.tableOs'));
    if (game.tableOs.phase) lines.push(tr('archive.tableOsPhase', {
      phase: game.tableOs.phase.name,
      cycle: game.tableOs.phase.cycle
    }));
    if (game.tableOs.campaign) lines.push(tr('archive.tableOsCampaign', {
      name: game.tableOs.campaign.name || tr('archive.tableOsCampaignFallback'),
      chapter: game.tableOs.campaign.chapter || '—',
      session: game.tableOs.campaign.sessionNumber
    }));
    if (game.tableOs.scores?.length) {
      lines.push(tr('archive.tableOsScores'));
      game.tableOs.scores.forEach(player => lines.push(`${player.name}: ${player.total}`));
    }
    if (game.tableOs.trackers?.length) {
      lines.push(tr('archive.tableOsTrackers'));
      game.tableOs.trackers.forEach(tracker => lines.push(
        `${tracker.name}: ${tracker.values.map(value => value.label ? `${value.label}: ${value.value}` : value.value).join(' · ')}`
      ));
    }
  }
  const copied = await copyText(lines.join('\n'));
  showToast(copied ? 'action.copied' : 'toast.copyFailed');
  render();
}
"""
app = app[:copy_start] + copy_fn + app[copy_end:]
write(app_path, app)


i18n_path = 'src/i18n.js'
i18n = read(i18n_path)
i18n = replace_once(
    i18n,
    """    'archive.rematch': '用此配置再来一局',
    'archive.rematchConfirm': '按「{name}」的配置与名单开始新一局？当前进行中的对局会被替换，继续吗？',
""",
    """    'archive.rematch': '用此配置再来一局',
    'archive.rematchConfirm': '按「{name}」的配置与名单开始新一局？当前进行中的对局会被替换，继续吗？',
    'archive.tableOs': '高级桌面摘要', 'archive.tableOsScores': '高级总分', 'archive.tableOsTrackers': '状态快照',
    'archive.tableOsPhase': '阶段 {phase} · 循环 {cycle}',
    'archive.tableOsCampaign': '战役 {name} · {chapter} · 第 {session} 局',
    'archive.tableOsCampaignFallback': '未命名战役', 'archive.tableOsFlags': '检查点 {done}/{total}',
""",
    'zh archive i18n'
)
i18n = replace_once(
    i18n,
    """    'archive.rematch': 'Rematch with this setup',
    'archive.rematchConfirm': 'Start a new game using "{name}"\\'s setup and roster? Any game in progress will be replaced. Continue?',
""",
    """    'archive.rematch': 'Rematch with this setup',
    'archive.rematchConfirm': 'Start a new game using "{name}"\\'s setup and roster? Any game in progress will be replaced. Continue?',
    'archive.tableOs': 'Advanced table summary', 'archive.tableOsScores': 'Advanced score', 'archive.tableOsTrackers': 'State snapshot',
    'archive.tableOsPhase': 'Phase {phase} · Cycle {cycle}',
    'archive.tableOsCampaign': 'Campaign {name} · {chapter} · Session {session}',
    'archive.tableOsCampaignFallback': 'Unnamed campaign', 'archive.tableOsFlags': 'Checkpoints {done}/{total}',
""",
    'en archive i18n'
)
write(i18n_path, i18n)


archive_test_path = 'tests/unit/archive.test.js'
archive_test = read(archive_test_path)
archive_test = replace_once(
    archive_test,
    "import { STORAGE_KEY } from '../../src/core.js';\n",
    "import { STORAGE_KEY } from '../../src/core.js';\nimport { TABLE_OS_STORAGE_KEY, TABLE_OS_COMPANION_STORAGE_KEY } from '../../src/tabletop-core.js';\n",
    'archive test imports'
)
privacy_test = """test('archive captures only the associated privacy-safe Table OS summary', () => {
  const createdAt = '2026-09-12T10:00:00.000Z';
  const storage = fakeStorage({
    [STORAGE_KEY]: JSON.stringify({
      session: { startedAt: createdAt },
      players: [{ id: 'p_1', name: 'Alice', color: '#f97316' }],
      timer: { mode: 'turn', baseSeconds: 90 },
      score: { rounds: [{ round: 1, createdAt }], fields: sampleGame.fields }
    }),
    [TABLE_OS_COMPANION_STORAGE_KEY]: JSON.stringify({ associatedMainSessionId: `round:${createdAt}` }),
    [TABLE_OS_STORAGE_KEY]: JSON.stringify({
      appliedTemplateId: 'campaign',
      participants: [{ id: 'tp_1', sourcePlayerId: 'p_1', name: 'Alice', color: '#f97316' }],
      trackers: [{
        id: 'tr_health', name: 'Health', scope: 'participant', initial: 10, min: 0, max: 20, step: 1,
        persistence: 'session', values: { tp_1: 7 }
      }],
      phases: {
        items: [
          { id: 'ph_day', name: 'Day' },
          { id: 'ph_night', name: 'Night', note: 'PRIVATE_PHASE_NOTE' }
        ],
        activeIndex: 1,
        cycle: 2
      },
      teams: [],
      roles: [{
        participantId: 'tp_1', role: 'PRIVATE_ROLE', faction: 'PRIVATE_FACTION',
        note: 'PRIVATE_MOD_NOTE', secret: true
      }],
      scoreSheet: {
        fields: [{ id: 'sf_base', name: 'Base', key: 'base', kind: 'manual', effect: 1, includeInTotal: true }],
        values: { tp_1: { sf_base: 12 } }
      },
      campaign: {
        enabled: true, name: 'Legacy', chapter: 'Chapter 2', sessionNumber: 3,
        notes: 'PRIVATE_CAMPAIGN_NOTE',
        flags: [{ id: 'flag_1', name: 'PRIVATE_FLAG_LABEL', checked: true }]
      }
    })
  });

  saveGameToArchive({ ...sampleGame, id: 'game_table_os' }, storage);
  const [saved] = loadArchive(storage);
  assert.equal(saved.tableOs.phase.name, 'Night');
  assert.equal(saved.tableOs.phase.cycle, 2);
  assert.equal(saved.tableOs.scores[0].total, 12);
  assert.equal(saved.tableOs.trackers[0].values[0].value, 7);
  assert.equal(saved.tableOs.campaign.sessionNumber, 3);
  assert.equal(saved.tableOs.campaign.completedFlags, 1);
  const serialized = storage.getItem(ARCHIVE_STORAGE_KEY);
  for (const secret of [
    'PRIVATE_ROLE', 'PRIVATE_FACTION', 'PRIVATE_MOD_NOTE',
    'PRIVATE_PHASE_NOTE', 'PRIVATE_CAMPAIGN_NOTE', 'PRIVATE_FLAG_LABEL'
  ]) {
    assert.equal(serialized.includes(secret), false, `archive must not persist ${secret}`);
  }

  const wrongStorage = fakeStorage({
    [STORAGE_KEY]: storage.getItem(STORAGE_KEY),
    [TABLE_OS_STORAGE_KEY]: storage.getItem(TABLE_OS_STORAGE_KEY),
    [TABLE_OS_COMPANION_STORAGE_KEY]: JSON.stringify({ associatedMainSessionId: 'round:some-other-game' })
  });
  saveGameToArchive({ ...sampleGame, id: 'game_wrong_session' }, wrongStorage);
  assert.equal(loadArchive(wrongStorage)[0].tableOs, null, 'stale Table OS state is not attached to another game');
});

"""
archive_test = replace_once(
    archive_test,
    "test('explicit archive configuration wins over persisted fallback state', () => {",
    privacy_test + "test('explicit archive configuration wins over persisted fallback state', () => {",
    'archive privacy test'
)
write(archive_test_path, archive_test)


companion_test_path = 'tests/e2e/run-table-os-companion-e2e.js'
companion_test = read(companion_test_path)
archive_flow = """async function runArchiveSummaryFlow() {
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
  await page.locator('[data-os-quick-template="engine-score"]').click();
  await page.getByRole('button', { name: 'Score sheet', exact: true }).click();
  const scoreValue = page.locator('[data-os-score-value]').first();
  await scoreValue.fill('11');
  await scoreValue.blur();
  await page.getByRole('button', { name: 'Phases', exact: true }).click();
  await page.locator('[data-os-action="next-phase"]').click();
  await page.locator('.tableos-header [data-os-action="close"]').click();

  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await page.getByRole('button', { name: 'Finish Game', exact: true }).click();
  const archiveItem = page.locator('.archive-item').first();
  await archiveItem.locator('summary').click();
  const advanced = archiveItem.locator('[data-archive-table-os]');
  await advanced.waitFor({ state: 'visible' });
  assert.match(await advanced.textContent(), /Advanced table summary/);
  assert.match(await advanced.textContent(), /Advanced score/);
  assert.match(await advanced.textContent(), /Phase/);

  const archived = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-archive-v1'))?.[0]);
  assert.ok(archived?.tableOs, 'finished main game stores a Table OS summary');
  assert.ok(
    Array.isArray(archived.tableOs.scores) && archived.tableOs.scores.some(player => player.total === 11),
    'archive captures the live advanced score'
  );
  assert.equal('roles' in archived.tableOs, false, 'archive summary has no private-role payload');
  assert.equal(errors.length, 0, `archive bridge console errors: ${errors.join(' | ')}`);
  await context.close();
}

"""
companion_test = replace_once(
    companion_test,
    'async function runTouchTargetSmoke() {',
    archive_flow + 'async function runTouchTargetSmoke() {',
    'archive companion flow'
)
companion_test = replace_once(
    companion_test,
    """  await runPrimaryFlow();
  await runQuietLifecycleFlow();
  await runSessionLifecycleFlow();
  await runTouchTargetSmoke();
""",
    """  await runPrimaryFlow();
  await runQuietLifecycleFlow();
  await runSessionLifecycleFlow();
  await runArchiveSummaryFlow();
  await runTouchTargetSmoke();
""",
    'archive companion run call'
)
companion_test = replace_once(
    companion_test,
    """      'campaign tracker persistence across rematch', 'transient state reset across rematch',
      '44px live touch targets', '320px overflow'
""",
    """      'campaign tracker persistence across rematch', 'transient state reset across rematch',
      'privacy-safe Table OS archive summary', '44px live touch targets', '320px overflow'
""",
    'archive companion summary'
)
write(companion_test_path, companion_test)

print('Table OS archive migration prepared successfully.')
