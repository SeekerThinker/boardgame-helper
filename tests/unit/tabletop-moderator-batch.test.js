import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState, addParticipant, setRole, replaceCharacterAssignmentsFromText,
  roleForParticipant, serializeTableOsState
} from '../../src/tabletop-core.js';

test('ordered moderator batch assignment clears stale host notes', () => {
  const state = createDefaultTableOsState();
  const a = addParticipant(state, 'A');
  const b = addParticipant(state, 'B');
  const c = addParticipant(state, 'C');
  setRole(state, a.id, { role: 'Old character', faction: 'Old side', note: 'old host note' });
  const result = replaceCharacterAssignmentsFromText(state, 'Seer | Town\nWolf\tWolves\nGuard');
  assert.deepEqual(result, { requested: 3, assigned: 3, limitReached: false, changed: true });
  assert.deepEqual(state.roles.map(item => item.participantId), [a.id, b.id, c.id]);
  assert.deepEqual(state.roles.map(item => [item.role, item.faction]), [['Seer', 'Town'], ['Wolf', 'Wolves'], ['Guard', '']]);
  assert.equal(state.roles.every(item => item.note === ''), true);
  assert.equal(serializeTableOsState(state).includes('old host note'), false);
});

test('ordered moderator batch assignment is roster-bounded and empty input is non-destructive', () => {
  const state = createDefaultTableOsState();
  const a = addParticipant(state, 'A');
  addParticipant(state, 'B');
  setRole(state, a.id, { role: 'Keep me', note: 'keep note' });
  assert.deepEqual(replaceCharacterAssignmentsFromText(state, '   \n'), { requested: 0, assigned: 0, limitReached: false, changed: false });
  assert.equal(roleForParticipant(state, a.id).role, 'Keep me');
  assert.equal(roleForParticipant(state, a.id).note, 'keep note');
  const result = replaceCharacterAssignmentsFromText(state, 'One | A\nTwo | B\nThree | C');
  assert.equal(result.requested, 3);
  assert.equal(result.assigned, 2);
  assert.equal(result.limitReached, true);
  assert.deepEqual(state.roles.map(item => item.role), ['One', 'Two']);
});
