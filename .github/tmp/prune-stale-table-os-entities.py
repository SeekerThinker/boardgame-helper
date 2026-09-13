from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

core_path = ROOT / 'src' / 'tabletop-core.js'
core = core_path.read_text()
start = core.index('export function normalizeTableOsState(input) {')
end = core.index('export function touch(state) {')
replacement = '''function pruneScopedEntityValues(items, participantIds, teamIds) {
  const validByScope = {
    global: new Set(['global']),
    participant: participantIds,
    team: teamIds
  };
  items.forEach(item => {
    const valid = validByScope[item.scope] || validByScope.global;
    const next = {};
    Object.entries(item.values || {}).forEach(([entityId, value]) => {
      if (valid.has(entityId)) next[entityId] = value;
    });
    item.values = next;
  });
  return items;
}

export function normalizeTableOsState(input) {
  const base = createDefaultTableOsState();
  if (!input || typeof input !== 'object') return base;
  const participants = normalizeParticipants(input.participants);
  const participantIds = new Set(participants.map(participant => participant.id));
  const teams = normalizeTeams(input.teams, participantIds);
  const teamIds = new Set(teams.map(team => team.id));
  const trackers = pruneScopedEntityValues(normalizeTrackers(input.trackers), participantIds, teamIds);
  const statuses = pruneScopedEntityValues(normalizeStatuses(input.statuses), participantIds, teamIds);
  return {
    schemaVersion: TABLE_OS_SCHEMA_VERSION,
    appliedTemplateId: normalizeAppliedTemplateId(input.appliedTemplateId),
    participants,
    trackers,
    statuses,
    phases: normalizePhases(input.phases),
    teams,
    roles: normalizeRoles(input.roles, participantIds),
    scoreSheet: normalizeScoreSheet(input.scoreSheet, participantIds),
    campaign: normalizeCampaign(input.campaign),
    ui: {
      activeSection: ['overview', 'statuses', 'trackers', 'phases', 'teams', 'score', 'campaign'].includes(input.ui?.activeSection)
        ? input.ui.activeSection
        : 'overview',
      // Edit mode is intentionally ephemeral. Reload/import always returns to the safer live-play surface.
      mode: 'play'
    },
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : base.updatedAt
  };
}

'''
core_path.write_text(core[:start] + replacement + core[end:])

unit_path = ROOT / 'tests' / 'unit' / 'tabletop-normalization-cleanup.test.js'
unit_path.write_text('''import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTableOsState, parseTableOsState, serializeTableOsState } from '../../src/tabletop-core.js';

function staleState() {
  return {
    schemaVersion: 3,
    participants: [{ id: 'tp_alice', name: 'Alice', color: '#f97316' }],
    teams: [{ id: 'team_red', name: 'Red', memberIds: ['tp_alice'] }],
    trackers: [
      { id: 'global_tracker', name: 'Round', scope: 'global', value: 1, min: 0, max: 99, step: 1, values: { global: 3, tp_alice: 88, retired_global: 77 } },
      { id: 'player_tracker', name: 'Health', scope: 'participant', value: 10, min: 0, max: 99, step: 1, values: { tp_alice: 7, tp_retired: 1 } },
      { id: 'team_tracker', name: 'Score', scope: 'team', value: 0, min: 0, max: 99, step: 1, values: { team_red: 4, team_retired: 9 } }
    ],
    statuses: [
      { id: 'global_status', name: 'Ready', scope: 'global', initial: false, values: { global: true, tp_alice: true } },
      { id: 'player_status', name: 'Alive', scope: 'participant', initial: true, values: { tp_alice: false, tp_retired: false } },
      { id: 'team_status', name: 'Objective', scope: 'team', initial: false, values: { team_red: true, team_retired: true } }
    ]
  };
}

test('normalization prunes invisible Tracker/Status entity values while preserving valid live state', () => {
  const normalized = normalizeTableOsState(staleState());

  assert.deepEqual(normalized.trackers.find(item => item.id === 'global_tracker').values, { global: 3 });
  assert.deepEqual(normalized.trackers.find(item => item.id === 'player_tracker').values, { tp_alice: 7 });
  assert.deepEqual(normalized.trackers.find(item => item.id === 'team_tracker').values, { team_red: 4 });
  assert.deepEqual(normalized.statuses.find(item => item.id === 'global_status').values, { global: true });
  assert.deepEqual(normalized.statuses.find(item => item.id === 'player_status').values, { tp_alice: false });
  assert.deepEqual(normalized.statuses.find(item => item.id === 'team_status').values, { team_red: true });

  const serialized = serializeTableOsState(normalized);
  assert.equal(serialized.includes('tp_retired'), false);
  assert.equal(serialized.includes('team_retired'), false);
  assert.equal(serialized.includes('retired_global'), false);
});

test('import parsing applies the same stale-entity cleanup boundary', () => {
  const parsed = parseTableOsState(JSON.stringify(staleState()));
  assert.equal(JSON.stringify(parsed).includes('tp_retired'), false);
  assert.equal(JSON.stringify(parsed).includes('team_retired'), false);
  assert.equal(parsed.trackers.find(item => item.id === 'player_tracker').values.tp_alice, 7);
  assert.equal(parsed.statuses.find(item => item.id === 'team_status').values.team_red, true);
});
''')

e2e_path = ROOT / 'tests' / 'e2e' / 'run-table-os-status-e2e.js'
e2e = e2e_path.read_text()
marker = "  assert.deepEqual(errors, [], `browser should stay error-free: ${errors.join(' | ')}`);\n"
insert = '''  await page.evaluate(() => {
    const key = 'board-game-assistant-table-os-v1';
    const stored = JSON.parse(localStorage.getItem(key));
    const participantId = stored.participants[0]?.id;
    if (!participantId) throw new Error('Expected a participant for stale-entity normalization regression');
    stored.teams = [{ id: 'team_current', name: 'Current', memberIds: [participantId] }];
    stored.trackers.push({
      id: 'prune_team_tracker', name: 'Prune team tracker', scope: 'team', persistence: 'session',
      min: 0, max: 99, step: 1, initial: 2, values: { team_current: 5, team_retired: 8 }
    });
    stored.statuses.push({
      id: 'prune_player_status', name: 'Prune player status', scope: 'participant', initial: false,
      values: { [participantId]: true, tp_retired: true }
    });
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload({ waitUntil: 'networkidle' });
  const prunedReload = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  const reloadParticipantId = prunedReload.participants[0].id;
  assert.deepEqual(prunedReload.trackers.find(item => item.id === 'prune_team_tracker').values, { team_current: 5 }, 'reload prunes stale team-scoped tracker values');
  assert.deepEqual(prunedReload.statuses.find(item => item.id === 'prune_player_status').values, { [reloadParticipantId]: true }, 'reload prunes stale participant-scoped status values');
  assert.equal(JSON.stringify(prunedReload).includes('team_retired'), false, 'retired team ids do not survive reload normalization');
  assert.equal(JSON.stringify(prunedReload).includes('tp_retired'), false, 'retired participant ids do not survive reload normalization');

'''
if marker not in e2e:
  raise SystemExit('E2E insertion marker not found')
e2e = e2e.replace(marker, insert + marker, 1)
e2e = e2e.replace("'reload persistence']", "'reload persistence', 'stale entity cleanup on reload']", 1)
e2e_path.write_text(e2e)

docs_path = ROOT / 'docs' / 'TABLE_OS_TEST_MATRIX.md'
docs = docs_path.read_text()
correctness_marker = '- My Templates must remain local-only structural snapshots: no participants, team membership, roles/factions/moderator notes, live tracker/score values or campaign content may be copied into them.\n'
correctness_line = '- Normalization/import must drop Tracker/Status live values for entities that do not exist in the current participant/team roster; invisible stale IDs must never survive persistence or re-export.\n'
if correctness_line not in docs:
  docs = docs.replace(correctness_marker, correctness_marker + correctness_line, 1)
section = '''\n### Normalization stale-entity cleanup\n\n- Unit: global / participant / team Tracker and Status maps preserve only entity IDs valid for their current scope.\n- Unit: parse + serialize cannot retain retired participant/team IDs or values from an old scope.\n- Chromium: reload normalization removes hidden retired team/player values from local persistence while keeping valid live values.\n'''
if '### Normalization stale-entity cleanup' not in docs:
  docs = docs.rstrip() + '\n' + section
docs_path.write_text(docs)
