import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState, normalizeTableOsState, addPhase, setPhaseTimerSeconds,
  resetTableOsSession, createUserTemplateFromState, applyUserTemplate
} from '../../src/tabletop-core.js';

test('phase timer duration is optional, bounded, and preserved by session reset', () => {
  const state = createDefaultTableOsState();
  const phase = addPhase(state, 'Action');
  assert.equal(phase.timerSeconds, 0);
  assert.equal(setPhaseTimerSeconds(state, phase.id, 75), true);
  assert.equal(phase.timerSeconds, 75);
  assert.equal(setPhaseTimerSeconds(state, phase.id, 999999), true);
  assert.equal(phase.timerSeconds, 86400);
  assert.equal(setPhaseTimerSeconds(state, phase.id, -5), true);
  assert.equal(phase.timerSeconds, 0);
  setPhaseTimerSeconds(state, phase.id, 90);
  resetTableOsSession(state);
  assert.equal(phase.timerSeconds, 90, 'new scenario preserves structural phase timer configuration');
});

test('normalization upgrades older phases and sanitizes timer duration', () => {
  const state = normalizeTableOsState({
    phases: { items: [
      { id: 'old', name: 'Old phase' },
      { id: 'timed', name: 'Timed phase', timerSeconds: 95 },
      { id: 'huge', name: 'Huge phase', timerSeconds: 999999 }
    ] }
  });
  assert.equal(state.schemaVersion, 7);
  assert.deepEqual(state.phases.items.map(phase => phase.timerSeconds), [0, 95, 86400]);
});

test('My Templates save phase timer structure but no live main-timer state', () => {
  const source = createDefaultTableOsState();
  const phase = addPhase(source, 'Resolve');
  setPhaseTimerSeconds(source, phase.id, 45);
  const saved = createUserTemplateFromState(source, 'Timed phases');
  assert.equal(saved.version, 6);
  assert.equal(saved.phases[0].timerSeconds, 45);
  assert.equal(JSON.stringify(saved).includes('deadlineMs'), false);
  assert.equal(JSON.stringify(saved).includes('remainingSeconds'), false);

  const target = createDefaultTableOsState();
  applyUserTemplate(target, saved);
  assert.equal(target.phases.items[0].timerSeconds, 45);
  assert.notEqual(target.phases.items[0].id, phase.id, 'template apply creates a fresh phase identity');
});
