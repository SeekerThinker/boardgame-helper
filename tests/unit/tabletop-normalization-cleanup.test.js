import test from 'node:test';
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
