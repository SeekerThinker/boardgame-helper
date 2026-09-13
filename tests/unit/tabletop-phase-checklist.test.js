import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PHASE_CHECKLIST_ITEMS, createDefaultTableOsState, normalizeTableOsState,
  addPhase, setActivePhase, advancePhase, setPhaseChecklistFromText, togglePhaseChecklistItem,
  resetTableOsSession, createUserTemplateFromState, applyUserTemplate
} from '../../src/tabletop-core.js';

test('phase checklist text setup is bounded and preserves matching live items', () => {
  const state = createDefaultTableOsState();
  const phase = addPhase(state, 'Action');
  const input = Array.from({ length: MAX_PHASE_CHECKLIST_ITEMS + 3 }, (_, index) => `Step ${index + 1}`).join('\n');
  const result = setPhaseChecklistFromText(state, phase.id, input);
  assert.equal(result.requested, MAX_PHASE_CHECKLIST_ITEMS + 3);
  assert.equal(result.saved, MAX_PHASE_CHECKLIST_ITEMS);
  assert.equal(result.limitReached, true);
  assert.equal(togglePhaseChecklistItem(state, phase.id, phase.checklist[1].id), true);
  const preservedId = phase.checklist[1].id;

  setPhaseChecklistFromText(state, phase.id, 'Step 2\nNew step\nStep 1');
  assert.deepEqual(phase.checklist.map(item => item.label), ['Step 2', 'New step', 'Step 1']);
  assert.equal(phase.checklist[0].id, preservedId, 'matching item keeps identity when checklist order changes');
  assert.equal(phase.checklist[0].done, true, 'matching item keeps same-cycle completion state');
  assert.equal(phase.checklist[1].done, false);
});

test('phase checklist progress resets when cycle changes and on new scenario', () => {
  const state = createDefaultTableOsState();
  const first = addPhase(state, 'Start');
  const second = addPhase(state, 'Cleanup');
  setPhaseChecklistFromText(state, first.id, 'Draw\nReady');
  setPhaseChecklistFromText(state, second.id, 'Discard');
  togglePhaseChecklistItem(state, first.id, first.checklist[0].id);
  togglePhaseChecklistItem(state, second.id, second.checklist[0].id);

  setActivePhase(state, 1);
  advancePhase(state, 1);
  assert.equal(state.phases.cycle, 2);
  assert.equal(state.phases.items.flatMap(phase => phase.checklist).every(item => item.done === false), true, 'new cycle starts with a clean checklist');

  togglePhaseChecklistItem(state, first.id, first.checklist[1].id);
  resetTableOsSession(state);
  assert.equal(state.phases.cycle, 1);
  assert.equal(state.phases.activeIndex, 0);
  assert.equal(state.phases.items.flatMap(phase => phase.checklist).every(item => item.done === false), true, 'new scenario clears completion state');
});

test('normalization accepts older phases and sanitizes checklist data', () => {
  const state = normalizeTableOsState({
    phases: {
      activeIndex: 0,
      cycle: 3,
      items: [
        { id: 'phase one', name: 'Action', note: 'Do things' },
        { id: 'phase two', name: 'Resolve', checklist: ['Pay cost', { id: 'x', label: 'Gain reward', done: true }] }
      ]
    }
  });
  assert.deepEqual(state.phases.items[0].checklist, [], 'old phase data receives an empty checklist');
  assert.deepEqual(state.phases.items[1].checklist.map(item => [item.label, item.done]), [['Pay cost', false], ['Gain reward', true]]);
  assert.equal(state.schemaVersion, 5);
});

test('My Templates keep phase checklist structure but never live completion progress', () => {
  const source = createDefaultTableOsState();
  const phase = addPhase(source, 'Action');
  setPhaseChecklistFromText(source, phase.id, 'Resolve ability\nRefill supply');
  togglePhaseChecklistItem(source, phase.id, phase.checklist[0].id);

  const saved = createUserTemplateFromState(source, 'Checklist setup');
  assert.deepEqual(saved.phases[0].checklist, [{ label: 'Resolve ability' }, { label: 'Refill supply' }]);
  assert.equal(JSON.stringify(saved).includes('"done":true'), false, 'live completion state is excluded from My Templates');
  assert.equal(JSON.stringify(saved).includes('phase_item_'), false, 'live checklist item ids are excluded from My Templates');

  const target = createDefaultTableOsState();
  applyUserTemplate(target, saved);
  assert.deepEqual(target.phases.items[0].checklist.map(item => item.label), ['Resolve ability', 'Refill supply']);
  assert.equal(target.phases.items[0].checklist.every(item => item.done === false), true, 'template apply starts clean');
  assert.notEqual(target.phases.items[0].checklist[0].id, phase.checklist[0].id, 'template apply creates fresh checklist identities');
});
