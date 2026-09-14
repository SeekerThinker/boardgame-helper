import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultState, normalizeState, prepareRematch, setDrawBagFromText, drawFromBag, resetDrawBag
} from '../../src/core.js';

function fixedRandom(value = 0) {
  return { getRandomValues(array) { array[0] = value; return array; } };
}

test('draw bag parses one item per line and keeps duplicate labels as distinct entries', () => {
  const state = createDefaultState('en');
  const result = setDrawBagFromText(state, 'Alpha\nBeta\nAlpha\n\nGamma');
  assert.deepEqual(result, { requested: 4, saved: 4, limitReached: false });
  assert.deepEqual(state.tools.drawBag.items.map(item => item.label), ['Alpha', 'Beta', 'Alpha', 'Gamma']);
  assert.equal(new Set(state.tools.drawBag.items.map(item => item.id)).size, 4);
  assert.equal(state.tools.drawBag.remainingIds.length, 4);
});

test('draw bag draws without replacement, exhausts, and resets', () => {
  const state = createDefaultState('en');
  setDrawBagFromText(state, 'A\nB\nC');
  const draws = [drawFromBag(state, fixedRandom(0)), drawFromBag(state, fixedRandom(0)), drawFromBag(state, fixedRandom(0))];
  assert.deepEqual(draws.map(item => item.label), ['A', 'B', 'C']);
  assert.equal(state.tools.drawBag.remainingIds.length, 0);
  assert.equal(drawFromBag(state, fixedRandom(0)), null);
  assert.equal(resetDrawBag(state), 3);
  assert.equal(state.tools.drawBag.lastDrawnId, null);
});

test('draw bag remaining state survives normalization and rejects stale ids', () => {
  const state = createDefaultState('en');
  setDrawBagFromText(state, 'A\nB\nC');
  const drawn = drawFromBag(state, fixedRandom(0));
  state.tools.drawBag.remainingIds.push('retired-id');
  const normalized = normalizeState(state, 'en');
  assert.equal(normalized.schemaVersion, 3);
  assert.equal(normalized.tools.drawBag.items.length, 3);
  assert.equal(normalized.tools.drawBag.remainingIds.length, 2);
  assert.equal(normalized.tools.drawBag.remainingIds.includes('retired-id'), false);
  assert.equal(normalized.tools.drawBag.lastDrawnId, drawn.id);
});

test('rematch preserves bag definition but resets draw progress', () => {
  const state = createDefaultState('en');
  setDrawBagFromText(state, 'A\nB\nC');
  drawFromBag(state, fixedRandom(0));
  prepareRematch(state);
  assert.deepEqual(state.tools.drawBag.items.map(item => item.label), ['A', 'B', 'C']);
  assert.equal(state.tools.drawBag.remainingIds.length, 3);
  assert.equal(state.tools.drawBag.lastDrawnId, null);
});
