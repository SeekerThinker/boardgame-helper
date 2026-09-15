import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState,
  syncParticipantsFromGame,
  addTeam,
  toggleTeamMember,
  setRole,
  roleForParticipant,
  addTracker,
  setTrackerValue,
  addScoreSheetField,
  setScoreSheetValue
} from '../../src/tabletop-core.js';

test('game roster sync prunes retired source-player data while preserving current source players', () => {
  const state = createDefaultTableOsState();
  syncParticipantsFromGame(state, [
    { id: 'p1', name: 'Alice', color: '#f97316' },
    { id: 'p2', name: 'Bob', color: '#14b8a6' }
  ]);

  const alice = state.participants[0];
  const retired = state.participants[1];
  const team = addTeam(state, 'Town');
  toggleTeamMember(state, team.id, alice.id);
  toggleTeamMember(state, team.id, retired.id);
  setRole(state, retired.id, { role: 'Seer', faction: 'Town', note: 'Moderator secret', secret: true });

  const health = addTracker(state, { name: 'Health', scope: 'participant', initial: 10, min: 0, max: 20, step: 1 });
  setTrackerValue(state, health.id, retired.id, 4);
  const points = addScoreSheetField(state, { name: 'Points', key: 'points' });
  setScoreSheetValue(state, retired.id, points.id, 9);

  syncParticipantsFromGame(state, [
    { id: 'p1', name: 'Alice Updated', color: '#3b82f6' }
  ]);

  assert.equal(state.participants.length, 1);
  assert.equal(state.participants[0].id, alice.id, 'surviving source player keeps its Table OS identity');
  assert.equal(state.participants[0].name, 'Alice Updated');
  assert.deepEqual(team.memberIds, [alice.id], 'retired participant is removed from team membership');
  assert.equal(roleForParticipant(state, retired.id), null, 'retired participant private role is pruned');
  assert.equal(Object.hasOwn(health.values || {}, retired.id), false, 'retired participant tracker value is pruned');
  assert.equal(state.scoreSheet.values?.[retired.id], undefined, 'retired participant score row is pruned');
});
