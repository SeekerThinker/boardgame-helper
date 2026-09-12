import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TABLE_OS_PARTICIPANTS, createDefaultTableOsState, normalizeTableOsState,
  syncParticipantsFromGame, addParticipant, removeParticipant,
  addTracker, trackerValue, adjustTracker, setTrackerValue,
  addPhase, setActivePhase, advancePhase,
  addTeam, toggleTeamMember, setRole, roleForParticipant,
  addScoreSheetField, setScoreSheetValue, evaluateFormula, scoreCardForParticipant,
  addCampaignFlag, toggleCampaignFlag, applyAssistantTemplate, resetTableOsSession,
  serializeTableOsState, parseTableOsState
} from '../../src/tabletop-core.js';

function participantNames(state) {
  return state.participants.map(item => item.name);
}

test('game roster sync preserves stable source participants and assistant-only extras', () => {
  const state = createDefaultTableOsState();
  syncParticipantsFromGame(state, [
    { id: 'p1', name: 'Alice', color: '#f97316' },
    { id: 'p2', name: 'Bob', color: '#14b8a6' }
  ]);
  const aliceId = state.participants[0].id;
  addParticipant(state, 'Guest');

  syncParticipantsFromGame(state, [
    { id: 'p1', name: 'Alice 2', color: '#3b82f6' },
    { id: 'p3', name: 'Carol', color: '#eab308' }
  ]);

  assert.equal(state.participants[0].id, aliceId, 'source player keeps the Table OS participant id');
  assert.deepEqual(participantNames(state), ['Alice 2', 'Carol', 'Guest']);
  assert.equal(state.participants[2].sourcePlayerId, null);
});

test('participant capacity is bounded for large moderator games', () => {
  const state = createDefaultTableOsState();
  for (let index = 0; index < MAX_TABLE_OS_PARTICIPANTS + 5; index += 1) addParticipant(state, `P${index}`);
  assert.equal(state.participants.length, MAX_TABLE_OS_PARTICIPANTS);
});

test('template application creates mechanism workspace without deleting participants', () => {
  const state = createDefaultTableOsState();
  addParticipant(state, 'A');
  addParticipant(state, 'B');
  applyAssistantTemplate(state, 'coop-crisis');

  assert.deepEqual(participantNames(state), ['A', 'B']);
  assert.equal(state.appliedTemplateId, 'coop-crisis');
  assert.ok(state.trackers.some(tracker => tracker.scope === 'global'));
  assert.ok(state.trackers.some(tracker => tracker.scope === 'participant'));
  assert.ok(state.phases.items.length >= 4);
  assert.equal(state.teams.length, 1);
});

test('universal trackers support global, participant and team scopes with clamps', () => {
  const state = createDefaultTableOsState();
  const p1 = addParticipant(state, 'A');
  const p2 = addParticipant(state, 'B');
  const team = addTeam(state, 'Blue');
  toggleTeamMember(state, team.id, p1.id);
  toggleTeamMember(state, team.id, p2.id);

  const shared = addTracker(state, { name: 'Threat', scope: 'global', initial: 3, min: 0, max: 10, step: 2 });
  const health = addTracker(state, { name: 'Health', scope: 'participant', initial: 10, min: 0, max: 20, step: 1 });
  const teamScore = addTracker(state, { name: 'Team score', scope: 'team', initial: 0, min: 0, max: 99, step: 1 });

  assert.equal(trackerValue(shared), 3);
  adjustTracker(state, shared.id, 'global', 20);
  assert.equal(trackerValue(shared), 10, 'global tracker clamps to max');
  setTrackerValue(state, health.id, p1.id, 7);
  assert.equal(trackerValue(health, p1.id), 7);
  assert.equal(trackerValue(health, p2.id), 10, 'unwritten entity receives initial value');
  adjustTracker(state, teamScore.id, team.id, 4);
  assert.equal(trackerValue(teamScore, team.id), 4);
  assert.equal(setTrackerValue(state, teamScore.id, 'missing-team', 5), false);
});

test('phase engine wraps and advances cycle deterministically', () => {
  const state = createDefaultTableOsState();
  addPhase(state, 'Start');
  addPhase(state, 'Action');
  addPhase(state, 'Cleanup');
  setActivePhase(state, 2);
  const wrapped = advancePhase(state, 1);
  assert.equal(wrapped.name, 'Start');
  assert.equal(state.phases.cycle, 2);
  const backwards = advancePhase(state, -1);
  assert.equal(backwards.name, 'Cleanup');
  assert.equal(state.phases.cycle, 1);
});

test('team membership and private role references are pruned with participant removal', () => {
  const state = createDefaultTableOsState();
  const a = addParticipant(state, 'A');
  const b = addParticipant(state, 'B');
  const team = addTeam(state, 'Town');
  toggleTeamMember(state, team.id, a.id);
  toggleTeamMember(state, team.id, b.id);
  setRole(state, b.id, { role: 'Seer', faction: 'Town', note: 'Private', secret: true });
  assert.equal(roleForParticipant(state, b.id).role, 'Seer');

  removeParticipant(state, b.id);
  assert.deepEqual(team.memberIds, [a.id]);
  assert.equal(roleForParticipant(state, b.id), null);
});

test('formula evaluator only accepts arithmetic and variables', () => {
  assert.deepEqual(evaluateFormula('base + bonus * 2 - penalty', { base: 10, bonus: 3, penalty: 1 }), { ok: true, value: 15, error: null });
  assert.equal(evaluateFormula('(a + b) / 2', { a: 10, b: 6 }).value, 8);
  assert.equal(evaluateFormula('-5 + a', { a: 8 }).value, 3);
  assert.equal(evaluateFormula('globalThis.alert(1)', {}).ok, false, 'function calls are rejected');
  assert.equal(evaluateFormula('1 / 0', {}).ok, false, 'division by zero is rejected');
});

test('score sheet combines manual and calculated fields without double-counting display formulas', () => {
  const state = createDefaultTableOsState();
  const player = addParticipant(state, 'A');
  const base = addScoreSheetField(state, { name: 'Base', key: 'base' });
  const bonus = addScoreSheetField(state, { name: 'Bonus', key: 'bonus' });
  const penalty = addScoreSheetField(state, { name: 'Penalty', key: 'penalty', effect: -1 });
  addScoreSheetField(state, { name: 'Net', key: 'net', kind: 'formula', formula: 'base + bonus - penalty', includeInTotal: false });

  setScoreSheetValue(state, player.id, base.id, 12);
  setScoreSheetValue(state, player.id, bonus.id, 4);
  setScoreSheetValue(state, player.id, penalty.id, 3);
  const card = scoreCardForParticipant(state, player.id);

  assert.equal(card.variables.net, 13);
  assert.equal(card.total, 13, 'manual included fields use their effects; display formula is not counted again');
});

test('campaign checkpoints and session reset preserve campaign memory while clearing session state', () => {
  const state = createDefaultTableOsState();
  const player = addParticipant(state, 'A');
  applyAssistantTemplate(state, 'campaign');
  state.campaign.name = 'Friday Campaign';
  state.campaign.notes = 'Persistent note';
  const flag = addCampaignFlag(state, 'Unlocked gate');
  toggleCampaignFlag(state, flag.id);
  const tracker = state.trackers.find(item => item.scope === 'participant');
  setTrackerValue(state, tracker.id, player.id, 4);
  setRole(state, player.id, { role: 'Scout', secret: true });
  const scoreField = state.scoreSheet.fields[0];
  setScoreSheetValue(state, player.id, scoreField.id, 9);

  resetTableOsSession(state);

  assert.equal(state.campaign.sessionNumber, 2);
  assert.equal(state.campaign.name, 'Friday Campaign');
  assert.equal(state.campaign.notes, 'Persistent note');
  assert.equal(state.campaign.flags[0].checked, true, 'campaign checkpoint survives');
  assert.equal(trackerValue(tracker, player.id), tracker.initial, 'session tracker value resets');
  assert.equal(state.roles.length, 0);
  assert.equal(scoreCardForParticipant(state, player.id).total, 0);
});

test('normalization drops dangling references and round-trips exported state', () => {
  const raw = {
    participants: [{ id: 'p one', name: 'A' }],
    teams: [{ id: 'team one', name: 'T', memberIds: ['p one', 'missing'] }],
    roles: [{ participantId: 'missing', role: 'Bad' }, { participantId: 'p one', role: 'Good' }],
    scoreSheet: { fields: [{ id: 's1', key: 'points', name: 'Points' }], values: { missing: { s1: 5 }, 'p one': { s1: 3 } } }
  };
  const state = normalizeTableOsState(raw);
  const participantId = state.participants[0].id;
  assert.deepEqual(state.teams[0].memberIds, [participantId]);
  assert.equal(state.roles.length, 1);
  assert.equal(state.roles[0].participantId, participantId);
  assert.equal(scoreCardForParticipant(state, participantId).total, 3);

  const restored = parseTableOsState(serializeTableOsState(state));
  assert.deepEqual(restored.participants, state.participants);
  assert.deepEqual(restored.teams, state.teams);
});
