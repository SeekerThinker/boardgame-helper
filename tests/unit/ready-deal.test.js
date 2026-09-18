import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadyDeal, READY_DEAL_MODES } from '../../src/ready-deal-core.js';
import { createSecretDeal } from '../../src/secret-dealer-core.js';

test('ready-made modes are bounded and never depend on branded game data', () => {
  assert.deepEqual(READY_DEAL_MODES, ['different-word', 'two-groups', 'one-special']);
  assert.throws(() => buildReadyDeal('unknown', 5), /mode/);
  assert.throws(() => buildReadyDeal('different-word', 2), /players/);
  assert.throws(() => buildReadyDeal('two-groups', 17), /players/);
  assert.throws(() => buildReadyDeal('one-special', 3.5), /players/);
});

test('different-word preset creates one distinct private word per round with original prompts', () => {
  const round = buildReadyDeal('different-word', 5, 'zh', () => 0);
  const words = round.cards.split('\n');
  assert.equal(round.names.split('\n').length, 5);
  assert.equal(words.length, 5);
  assert.equal(new Set(words).size, 2);
  assert.equal(words.filter(word => word === words[4]).length, 1);
  assert.equal(round.steps.split('\n').length, 3);
  const dealt = createSecretDeal(round.names, round.cards, () => 0);
  assert.equal(dealt.length, 5);
  assert.deepEqual(dealt.map(entry => entry.secret).sort(), words.sort());
});

test('two-group preset handles odd counts and English labels', () => {
  const round = buildReadyDeal('two-groups', 7, 'en-US');
  const cards = round.cards.split('\n');
  assert.equal(round.names.split('\n')[0], 'Player 1');
  assert.equal(cards.filter(card => card === 'Group A').length, 4);
  assert.equal(cards.filter(card => card === 'Group B').length, 3);
});

test('single-special preset produces exactly one special member', () => {
  const round = buildReadyDeal('one-special', 16, 'zh');
  assert.equal(round.cards.split('\n').filter(card => card === '特殊成员').length, 1);
  assert.equal(round.cards.split('\n').filter(card => card === '普通成员').length, 15);
});

test('word-pair random choice is range checked', () => {
  assert.throws(() => buildReadyDeal('different-word', 3, 'en', () => -1), /random/);
  assert.throws(() => buildReadyDeal('different-word', 3, 'en', () => 999), /random/);
  assert.notEqual(buildReadyDeal('different-word', 3, 'en', () => 0).cards, buildReadyDeal('different-word', 3, 'en', () => 1).cards);
});
