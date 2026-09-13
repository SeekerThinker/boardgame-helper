import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TABLE_OS_PARTICIPANTS,
  createDefaultTableOsState,
  syncParticipantsFromGame,
  addParticipantsFromText
} from '../../src/tabletop-core.js';

test('bulk roster parses common paste separators without touching the source game roster', () => {
  const state = createDefaultTableOsState();
  syncParticipantsFromGame(state, [
    { id: 'p1', name: 'Host', color: '#f97316' },
    { id: 'p2', name: 'Guest', color: '#14b8a6' }
  ]);
  const sourceIds = state.participants.map(item => item.sourcePlayerId);
  const result = addParticipantsFromText(state, '阿青\n小林, Mia；Noah\tEva');
  assert.deepEqual(result, { requested: 5, added: 5, limitReached: false });
  assert.deepEqual(state.participants.slice(-5).map(item => item.name), ['阿青', '小林', 'Mia', 'Noah', 'Eva']);
  assert.equal(state.participants.slice(-5).every(item => item.sourcePlayerId === null), true);
  assert.deepEqual(state.participants.slice(0, 2).map(item => item.sourcePlayerId), sourceIds);
});

test('bulk roster ignores blank tokens, trims names and stops safely at the participant limit', () => {
  const state = createDefaultTableOsState();
  const first = addParticipantsFromText(state, '  Ada  \n\nLin；  Mia  ');
  assert.deepEqual(first, { requested: 3, added: 3, limitReached: false });
  assert.deepEqual(state.participants.map(item => item.name), ['Ada', 'Lin', 'Mia']);

  const many = Array.from({ length: 40 }, (_, index) => `Player ${index + 1}`).join('\n');
  const second = addParticipantsFromText(state, many);
  assert.equal(second.requested, 40);
  assert.equal(second.added, MAX_TABLE_OS_PARTICIPANTS - 3);
  assert.equal(second.limitReached, true);
  assert.equal(state.participants.length, MAX_TABLE_OS_PARTICIPANTS);

  const full = addParticipantsFromText(state, 'One more');
  assert.deepEqual(full, { requested: 1, added: 0, limitReached: true });
});

test('bulk roster empty input is a no-op', () => {
  const state = createDefaultTableOsState();
  const before = state.updatedAt;
  const result = addParticipantsFromText(state, '  \n，；\t  ');
  assert.deepEqual(result, { requested: 0, added: 0, limitReached: false });
  assert.equal(state.participants.length, 0);
  assert.equal(state.updatedAt, before);
});
