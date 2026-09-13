import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STATUSES, addParticipant, addStatus, addTeam, applyAssistantTemplate, applyUserTemplate,
  createDefaultTableOsState, createUserTemplateFromState, normalizeTableOsState, removeParticipant, removeTeam,
  resetTableOsSession, setStatusValue, statusEntityIds, statusValue, toggleStatus
} from '../../src/tabletop-core.js';

test('older Table OS state normalizes with an empty status shelf', () => {
  const state = normalizeTableOsState({ schemaVersion: 2, participants: [], trackers: [] });
  assert.deepEqual(state.statuses, []);
  assert.equal(state.schemaVersion, 4);
});

test('participant and team statuses validate entities and prune removed references', () => {
  const state = createDefaultTableOsState();
  const alice = addParticipant(state, 'Alice');
  const bob = addParticipant(state, 'Bob');
  const alive = addStatus(state, { name: 'Alive', scope: 'participant', initial: true });
  assert.equal(statusValue(alive, alice.id), true);
  assert.equal(toggleStatus(state, alive.id, alice.id), true);
  assert.equal(statusValue(alive, alice.id), false);
  assert.equal(setStatusValue(state, alive.id, 'missing', true), false);
  assert.deepEqual(statusEntityIds(state, alive), [alice.id, bob.id]);
  removeParticipant(state, alice.id);
  assert.equal(Object.hasOwn(alive.values, alice.id), false);

  const team = addTeam(state, 'A');
  const ready = addStatus(state, { name: 'Ready', scope: 'team' });
  assert.equal(setStatusValue(state, ready.id, team.id, true), true);
  removeTeam(state, team.id);
  assert.equal(Object.hasOwn(ready.values, team.id), false);
});

test('status shelf enforces its limit', () => {
  const state = createDefaultTableOsState();
  for (let index = 0; index < MAX_STATUSES; index += 1) assert.ok(addStatus(state, { name: `S${index}` }));
  assert.equal(addStatus(state, { name: 'overflow' }), null);
});

test('new scenario restores status defaults', () => {
  const state = createDefaultTableOsState();
  const participant = addParticipant(state, 'Alice');
  const alive = addStatus(state, { name: 'Alive', scope: 'participant', initial: true });
  const poisoned = addStatus(state, { name: 'Poisoned', scope: 'participant', initial: false });
  setStatusValue(state, alive.id, participant.id, false);
  setStatusValue(state, poisoned.id, participant.id, true);
  resetTableOsSession(state);
  assert.deepEqual(alive.values, {});
  assert.deepEqual(poisoned.values, {});
  assert.equal(statusValue(alive, participant.id), true);
  assert.equal(statusValue(poisoned, participant.id), false);
});

test('My Templates save status definitions but never live status values', () => {
  const state = createDefaultTableOsState();
  const participant = addParticipant(state, 'Alice');
  state.campaign.enabled = true;
  state.campaign.name = 'Persistent campaign';
  const status = addStatus(state, { name: 'Objective complete', scope: 'participant', initial: false });
  setStatusValue(state, status.id, participant.id, true);
  const template = createUserTemplateFromState(state, 'Reusable setup');
  assert.deepEqual(template.statuses, [{ name: 'Objective complete', scope: 'participant', initial: false }]);
  assert.equal(JSON.stringify(template).includes(participant.id), false);
  assert.equal(JSON.stringify(template).includes('values'), false);

  applyUserTemplate(state, template, { preserveParticipants: true });
  assert.equal(state.participants[0].id, participant.id);
  assert.equal(state.campaign.name, 'Persistent campaign');
  assert.equal(state.statuses.length, 1);
  assert.deepEqual(state.statuses[0].values, {});
  assert.equal(statusValue(state.statuses[0], participant.id), false);
});

test('built-in card and hidden-role templates use localized status toggles', () => {
  const state = createDefaultTableOsState();
  addParticipant(state, 'Alice');
  applyAssistantTemplate(state, 'card-battle', { locale: 'en' });
  assert.deepEqual(state.statuses.map(status => status.name), ['Poisoned', 'Stunned']);
  assert.equal(state.trackers.some(tracker => tracker.name === 'Status'), false);
  applyAssistantTemplate(state, 'hidden-role', { locale: 'en' });
  assert.equal(state.statuses[0].name, 'Alive');
  assert.equal(state.statuses[0].initial, true);
});
