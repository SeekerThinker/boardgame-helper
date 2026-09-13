import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState, addParticipant, addScoreSheetField, setScoreSheetFieldKey,
  setScoreSheetValue, scoreCardForParticipant
} from '../../src/tabletop-core.js';

test('score keys remain unique even when a 24-character candidate is duplicated', () => {
  const state = createDefaultTableOsState();
  const longKey = 'abcdefghijklmnopqrstuvwx';
  const first = addScoreSheetField(state, { name: 'First', key: longKey });
  const second = addScoreSheetField(state, { name: 'Second', key: longKey });

  assert.equal(first.key, longKey);
  assert.notEqual(second.key, first.key);
  assert.equal(second.key.endsWith('_2'), true);
  assert.ok(second.key.length <= 24);
});

test('renaming score variables keeps keys formula-safe, unique and rewrites exact formula references', () => {
  const state = createDefaultTableOsState();
  const player = addParticipant(state, 'A');
  const base = addScoreSheetField(state, { name: 'Base', key: 'base' });
  const bonus = addScoreSheetField(state, { name: 'Bonus', key: 'bonus' });
  const total = addScoreSheetField(state, { name: 'Net', key: 'net', kind: 'formula', formula: '-(base + bonus) / -2', includeInTotal: false });
  setScoreSheetValue(state, player.id, base.id, 10);
  setScoreSheetValue(state, player.id, bonus.id, 4);
  assert.equal(scoreCardForParticipant(state, player.id).values[total.id], 7);

  assert.equal(setScoreSheetFieldKey(state, base.id, 'points'), 'points');
  assert.equal(total.formula, '-(points + bonus) / -2');
  assert.equal(setScoreSheetFieldKey(state, bonus.id, 'points'), 'points_2');
  assert.equal(total.formula, '-(points + points_2) / -2');
  assert.equal(scoreCardForParticipant(state, player.id).values[total.id], 7, 'formula result survives both variable renames');

  assert.equal(setScoreSheetFieldKey(state, base.id, '123'), 'field_123');
  assert.equal(total.formula, '-(field_123 + points_2) / -2');
  assert.equal(scoreCardForParticipant(state, player.id).values[total.id], 7, 'numeric-leading input is normalized to a formula-safe variable');
});
