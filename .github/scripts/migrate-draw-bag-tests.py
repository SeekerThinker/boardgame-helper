from pathlib import Path

Path('tests/unit/draw-bag.test.js').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DRAW_BAG_ITEMS, createDefaultState, normalizeState, setDrawBagItems,
  drawBagItem, resetDrawBag, prepareRematch
} from '../../src/core.js';

function deterministicCrypto(values) {
  let index = 0;
  return { getRandomValues(array) { array[0] = values[index++ % values.length] >>> 0; return array; } };
}

test('draw bag accepts line items, keeps duplicates, and enforces its cap', () => {
  const state = createDefaultState();
  const source = [' Attack ', '', 'Heal', 'Attack', ...Array.from({ length: MAX_DRAW_BAG_ITEMS }, (_, index) => `Item ${index}`)].join('\\n');
  const result = setDrawBagItems(state, source);
  assert.equal(result.limitReached, true);
  assert.equal(result.saved, MAX_DRAW_BAG_ITEMS);
  assert.deepEqual(state.tools.drawBag.items.slice(0, 3), ['Attack', 'Heal', 'Attack']);
  assert.deepEqual(state.tools.drawBag.remainingItems, state.tools.drawBag.items);
});

test('draw bag draws without replacement and reset returns every copy', () => {
  const state = createDefaultState();
  setDrawBagItems(state, 'Attack\\nHeal\\nAttack');
  const random = deterministicCrypto([0, 0, 0]);
  assert.equal(drawBagItem(state, random), 'Attack');
  assert.equal(drawBagItem(state, random), 'Heal');
  assert.equal(drawBagItem(state, random), 'Attack');
  assert.equal(drawBagItem(state, random), null);
  assert.deepEqual(state.tools.drawBag.remainingItems, []);
  assert.deepEqual(state.tools.drawBag.drawnItems, ['Attack', 'Heal', 'Attack']);
  assert.equal(resetDrawBag(state), true);
  assert.deepEqual(state.tools.drawBag.remainingItems, ['Attack', 'Heal', 'Attack']);
  assert.deepEqual(state.tools.drawBag.drawnItems, []);
});

test('normalization rebuilds remaining items from valid drawn copies only', () => {
  const state = normalizeState({ tools: { drawBag: { items: ['A', 'A', 'B'], remainingItems: ['forged'], drawnItems: ['A', 'ghost', 'A', 'A', 'B'] } } });
  assert.deepEqual(state.tools.drawBag.items, ['A', 'A', 'B']);
  assert.deepEqual(state.tools.drawBag.drawnItems, ['A', 'A', 'B']);
  assert.deepEqual(state.tools.drawBag.remainingItems, []);
});

test('rematch keeps bag structure but resets live draw progress', () => {
  const state = createDefaultState();
  setDrawBagItems(state, 'One\\nTwo\\nThree');
  drawBagItem(state, deterministicCrypto([1]));
  prepareRematch(state);
  assert.deepEqual(state.tools.drawBag.items, ['One', 'Two', 'Three']);
  assert.deepEqual(state.tools.drawBag.remainingItems, ['One', 'Two', 'Three']);
  assert.deepEqual(state.tools.drawBag.drawnItems, []);
});
""")
print('draw bag unit tests prepared')
