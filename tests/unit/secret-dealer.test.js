import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecretDeal, parsePublicSteps, secureRandomInt, MAX_DEAL_PLAYERS } from '../../src/secret-dealer-core.js';

test('generic deck deals exactly once per person without editing the inputs', () => {
  const names = '甲\n乙\n丙';
  const cards = '自写词 A\n自写词 A\n自写词 B';
  const indexes = [0, 1];
  const result = createSecretDeal(names, cards, max => { const value = indexes.shift(); assert.ok(value < max); return value; });
  assert.deepEqual(result.map(item => item.name), ['甲', '乙', '丙']);
  assert.deepEqual(result.map(item => item.secret).sort(), ['自写词 A', '自写词 A', '自写词 B']);
  assert.equal(cards, '自写词 A\n自写词 A\n自写词 B');
  result[0].secret = 'changed';
  assert.equal(cards.includes('changed'), false);
});

test('reject missing, extra and oversized cards and players', () => {
  assert.throws(() => createSecretDeal('one', 'card'), /players/);
  assert.throws(() => createSecretDeal('one\ntwo', 'card'), /cards/);
  assert.throws(() => createSecretDeal('one\ntwo', 'a\nb\nc'), /cards/);
  assert.throws(() => createSecretDeal('x'.repeat(33) + '\ntwo', 'a\nb'), /players/);
  const names = Array.from({ length: MAX_DEAL_PLAYERS + 1 }, (_, i) => `P${i}`).join('\n');
  assert.throws(() => createSecretDeal(names, names), /players/);
  assert.throws(() => createSecretDeal('one\ntwo', 'a'.repeat(81) + '\nb'), /cards/);
  assert.throws(() => createSecretDeal('one\ntwo', 'a\nb', () => -1), /random/);
  assert.throws(() => createSecretDeal('one\ntwo', 'a\nb', () => 2), /random/);
});

test('public moderator steps are optional, bounded and never define game rules', () => {
  assert.deepEqual(parsePublicSteps('\n Start \nNext\n'), ['Start', 'Next']);
  assert.deepEqual(parsePublicSteps(''), []);
  assert.throws(() => parsePublicSteps(Array(13).fill('step').join('\n')), /steps/);
  assert.throws(() => parsePublicSteps('a'.repeat(101)), /steps/);
});

test('secure random index is always in range or fails closed', () => {
  assert.throws(() => secureRandomInt(0), /range/);
  assert.throws(() => secureRandomInt(2.5), /range/);
  assert.equal(secureRandomInt(1), 0);
  for (let i = 0; i < 32; i++) {
    const index = secureRandomInt(5);
    assert.ok(index >= 0 && index < 5);
  }
});
