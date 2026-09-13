import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultTableOsState, addPhase, setActivePhase, removePhase } from '../../src/tabletop-core.js';

function stateWithPhases(names = ['A', 'B', 'C', 'D']) {
  const state = createDefaultTableOsState();
  names.forEach(name => addPhase(state, name));
  return state;
}

test('removing an earlier phase preserves the active phase identity', () => {
  const state = stateWithPhases();
  setActivePhase(state, 2);
  const activeId = state.phases.items[2].id;
  const removedId = state.phases.items[0].id;

  assert.equal(removePhase(state, removedId), true);
  assert.equal(state.phases.activeIndex, 1);
  assert.equal(state.phases.items[state.phases.activeIndex].id, activeId);
  assert.equal(state.phases.items[state.phases.activeIndex].name, 'C');
});

test('removing the active phase selects the nearest surviving phase without changing cycle', () => {
  const middle = stateWithPhases();
  middle.phases.cycle = 7;
  setActivePhase(middle, 1);
  assert.equal(removePhase(middle, middle.phases.items[1].id), true);
  assert.equal(middle.phases.items[middle.phases.activeIndex].name, 'C');
  assert.equal(middle.phases.cycle, 7);

  const last = stateWithPhases(['A', 'B', 'C']);
  setActivePhase(last, 2);
  assert.equal(removePhase(last, last.phases.items[2].id), true);
  assert.equal(last.phases.activeIndex, 1);
  assert.equal(last.phases.items[last.phases.activeIndex].name, 'B');
});
