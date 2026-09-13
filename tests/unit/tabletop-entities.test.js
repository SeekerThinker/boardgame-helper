import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ENTITIES, createDefaultTableOsState, normalizeTableOsState,
  addEntity, renameEntity, removeEntity, addTracker, setTrackerValue, trackerValue,
  addStatus, toggleStatus, statusValue, resetTableOsSession, serializeTableOsState,
  createUserTemplateFromState, applyUserTemplate
} from '../../src/tabletop-core.js';

test('table entities are bounded and clean entity-scoped live values on removal', () => {
  const state = createDefaultTableOsState();
  const boss = addEntity(state, 'Boss');
  const objective = addEntity(state, 'Objective');
  assert.equal(renameEntity(state, objective.id, 'Gate'), true);
  const health = addTracker(state, { name: 'HP', scope: 'entity', initial: 10, min: 0, max: 99 });
  const marked = addStatus(state, { name: 'Marked', scope: 'entity', initial: false });
  setTrackerValue(state, health.id, boss.id, 7);
  setTrackerValue(state, health.id, objective.id, 4);
  toggleStatus(state, marked.id, boss.id);
  toggleStatus(state, marked.id, objective.id);
  assert.equal(removeEntity(state, boss.id), true);
  assert.equal(state.entities.length, 1);
  assert.equal(state.entities[0].name, 'Gate');
  assert.equal(boss.id in health.values, false);
  assert.equal(health.values[objective.id], 4);
  assert.equal(boss.id in marked.values, false);
  assert.equal(marked.values[objective.id], true);
  assert.equal(serializeTableOsState(state).includes(boss.id), false, 'retired entity IDs do not survive export');

  for (let index = state.entities.length; index < MAX_ENTITIES; index += 1) addEntity(state, `E${index}`);
  assert.equal(state.entities.length, MAX_ENTITIES);
  assert.equal(addEntity(state, 'Too many'), null);
});

test('entity normalization prunes stale IDs and reset respects tracker/status lifecycle', () => {
  const state = normalizeTableOsState({
    schemaVersion: 3,
    entities: [{ id: 'boss', name: 'Boss' }],
    trackers: [
      { id: 'session-hp', name: 'HP', scope: 'entity', value: 10, persistence: 'session', values: { boss: 6, retired: 1 } },
      { id: 'campaign-xp', name: 'XP', scope: 'entity', value: 0, persistence: 'campaign', values: { boss: 3, retired: 9 } }
    ],
    statuses: [{ id: 'stunned', name: 'Stunned', scope: 'entity', initial: false, values: { boss: true, retired: true } }]
  });
  const boss = state.entities[0];
  assert.deepEqual(Object.keys(state.trackers[0].values), [boss.id]);
  assert.deepEqual(Object.keys(state.trackers[1].values), [boss.id]);
  assert.deepEqual(Object.keys(state.statuses[0].values), [boss.id]);
  resetTableOsSession(state);
  assert.equal(trackerValue(state.trackers[0], boss.id), 10, 'session entity tracker resets');
  assert.equal(trackerValue(state.trackers[1], boss.id), 3, 'campaign entity tracker survives');
  assert.equal(statusValue(state.statuses[0], boss.id), false, 'entity status restores default');
});

test('My Templates keep entity structure but never copy entity identity or live values', () => {
  const state = createDefaultTableOsState();
  const boss = addEntity(state, 'Boss');
  addEntity(state, 'Objective');
  const hp = addTracker(state, { name: 'HP', scope: 'entity', initial: 12 });
  const stunned = addStatus(state, { name: 'Stunned', scope: 'entity', initial: false });
  setTrackerValue(state, hp.id, boss.id, 5);
  toggleStatus(state, stunned.id, boss.id);

  const saved = createUserTemplateFromState(state, 'Encounter');
  assert.deepEqual(saved.entities, [{ name: 'Boss' }, { name: 'Objective' }]);
  assert.equal(JSON.stringify(saved).includes(boss.id), false);
  assert.equal('values' in saved.trackers[0], false);
  assert.equal('values' in saved.statuses[0], false);

  applyUserTemplate(state, saved);
  assert.deepEqual(state.entities.map(item => item.name), ['Boss', 'Objective']);
  assert.equal(state.entities.some(item => item.id === boss.id), false, 'applied template creates fresh entity IDs');
  assert.deepEqual(state.trackers[0].values, {});
  assert.deepEqual(state.statuses[0].values, {});
  assert.equal(state.trackers[0].scope, 'entity');
  assert.equal(state.statuses[0].scope, 'entity');
});
