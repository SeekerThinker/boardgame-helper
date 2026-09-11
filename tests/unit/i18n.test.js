import test from 'node:test';
import assert from 'node:assert/strict';
import { t, dictionaryKeys, formatClock, formatDateTime, signedNumber, localeTag } from '../../src/i18n.js';

test('zh and en dictionaries expose exactly the same keys', () => {
  const zhKeys = dictionaryKeys('zh').sort();
  const enKeys = dictionaryKeys('en').sort();
  assert.deepEqual(enKeys.filter(key => !zhKeys.includes(key)), [], 'keys missing from zh');
  assert.deepEqual(zhKeys.filter(key => !enKeys.includes(key)), [], 'keys missing from en');
  assert.ok(zhKeys.length > 100);
});

test('t interpolates values, falls back to zh, and never returns empty output', () => {
  assert.equal(t('en', 'timer.roundLabel', { round: 3 }), 'Round 3');
  assert.equal(t('zh', 'timer.roundLabel', { round: 3 }), '第 3 轮');
  assert.equal(t('fr', 'app.title'), '桌游助手');
  assert.equal(t('zh', 'nonexistent.key'), 'nonexistent.key');
  for (const key of dictionaryKeys('en')) {
    assert.ok(String(t('en', key)).trim().length > 0, `empty translation for ${key}`);
    assert.ok(String(t('zh', key)).trim().length > 0, `empty translation for ${key}`);
  }
});

test('formatClock renders minutes, seconds, and hours', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(3600), '01:00:00');
  assert.equal(formatClock(-5), '00:00');
  assert.equal(formatClock(undefined), '00:00');
});

test('signedNumber prefixes positive values and keeps negatives intact', () => {
  assert.equal(signedNumber(3), '+3');
  assert.equal(signedNumber(-2), '-2');
  assert.equal(signedNumber(0), '0');
});

test('locale tags and datetime formatting are locale aware', () => {
  assert.equal(localeTag('en'), 'en-US');
  assert.equal(localeTag('zh'), 'zh-CN');
  assert.equal(formatDateTime('zh', null), '');
  assert.equal(formatDateTime('zh', 'not-a-date'), '');
  assert.match(formatDateTime('en', '2024-03-05T10:30:00Z'), /\d/);
});
