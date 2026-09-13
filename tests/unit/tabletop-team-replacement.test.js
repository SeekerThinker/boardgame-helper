import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addParticipant, addStatus, addTeam, addTracker, createDefaultTableOsState, replaceTeams,
  serializeTableOsState, setStatusValue, setTrackerValue, statusValue, trackerValue
} from '../../src/tabletop-core.js';

test('replacing the whole team roster drops retired team live values and starts fresh defaults', () => {
  const state = createDefaultTableOsState();
  const alice = addParticipant(state, 'Alice');
  const oldTeam = addTeam(state, 'Old team');
  oldTeam.memberIds = [alice.id];
  const score = addTracker(state, { name: 'Team score', scope: 'team', initial: 2, persistence: 'campaign' });
  const ready = addStatus(state, { name: 'Ready', scope: 'team', initial: false });
  setTrackerValue(state, score.id, oldTeam.id, 9);
  setStatusValue(state, ready.id, oldTeam.id, true);

  const [freshTeam] = replaceTeams(state, [{ name: 'Fresh team', memberIds: [alice.id, 'missing'] }]);

  assert.notEqual(freshTeam.id, oldTeam.id, 'replacement creates a fresh team identity');
  assert.deepEqual(freshTeam.memberIds, [alice.id], 'replacement keeps only valid participant membership');
  assert.deepEqual(score.values, {}, 'retired team tracker overrides are cleared even for campaign trackers');
  assert.deepEqual(ready.values, {}, 'retired team status overrides are cleared');
  assert.equal(trackerValue(score, freshTeam.id), 2, 'new team receives tracker default');
  assert.equal(statusValue(ready, freshTeam.id), false, 'new team receives status default');
  assert.equal(serializeTableOsState(state).includes(oldTeam.id), false, 'retired team id is absent from persisted/exported state');
});
