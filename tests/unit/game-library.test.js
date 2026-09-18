import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_LIBRARY_ENTRIES } from '../../src/game-library-data.js';
import { isPublishableGame, publishedGames, filterPublishedGames } from '../../src/game-library-core.js';

// Synthetic test-only fixture; it is not a real game, editorial approval or playtest.
const fakeGame = () => ({
  id: 'fixture-game', material: 'none', players: { min: 3, max: 8 },
  duration: { min: 5, max: 10, basis: 'editorial-estimate' }, age: { min: 7 },
  tools: ['timer', 'secret-dealer'],
  copy: Object.fromEntries(['zh', 'en'].map(lang => [lang, {
    title: lang === 'zh' ? '测试游戏' : 'Fixture game', summary: lang === 'zh' ? '无道具测试' : 'No equipment fixture',
    goal: 'Goal', setup: ['First'], turns: ['Then'], finish: 'Finish', example: 'Example',
    ageBasis: 'Reading required', space: 'Small table', accessibility: 'No movement required', materials: 'None'
  }])),
  provenance: { description: 'Synthetic test data only, not a source of game rules', sources: [] },
  rights: {
    jurisdiction: 'fixture jurisdiction', concerns: [],
    name: { basis: 'original', owner: 'fixture writer', evidence: 'synthetic fixture evidence', commercialUse: true, redistribution: true, adaptation: true },
    teaching: { basis: 'original', owner: 'fixture writer', evidence: 'synthetic fixture evidence', commercialUse: true, redistribution: true, adaptation: true },
    example: { basis: 'original', owner: 'fixture writer', evidence: 'synthetic fixture evidence', commercialUse: true, redistribution: true, adaptation: true },
    visuals: { basis: 'not-used', used: false, evidence: 'no visual assets in synthetic fixture' }
  },
  review: { status: 'ready', approved: true, author: 'fixture writer', reviewer: 'fixture editor', date: '2026-09-18',
    playtest: { completed: true, by: 'fixture tester', date: '2026-09-18', evidence: 'synthetic fixture only' } }
});

test('production ships no game without real rights and playtest review', () => {
  assert.deepEqual(GAME_LIBRARY_ENTRIES, []);
  assert.deepEqual(publishedGames(GAME_LIBRARY_ENTRIES), []);
});

test('only fully documented reviewed fixtures pass; publication strips internal evidence', () => {
  const fixture = fakeGame();
  assert.equal(isPublishableGame(fixture), true);
  const output = publishedGames([fixture, structuredClone(fixture)]);
  assert.equal(output.length, 1, 'duplicate stable IDs never multiply entries');
  assert.equal(output[0].copy.zh.title, '测试游戏');
  assert.equal('rights' in output[0], false, 'internal rights record is not rendered');
  assert.equal('review' in output[0], false, 'internal review record is not rendered');
  assert.equal('provenance' in output[0], false, 'internal source record is not automatically exposed');
});

test('drafts, pending reviews, missing human review or playtest and unresolved rights fail closed', () => {
  const mutations = [
    entry => { entry.review.status = 'draft'; },
    entry => { entry.review.status = 'rights-review'; },
    entry => { entry.review.status = 'blocked'; },
    entry => { entry.review.approved = false; },
    entry => { entry.review.reviewer = entry.review.author; },
    entry => { entry.review.date = ''; },
    entry => { entry.review.playtest.completed = false; },
    entry => { entry.review.playtest.evidence = ''; },
    entry => { entry.rights.concerns = ['unresolved']; },
    entry => { entry.rights.name.evidence = ''; },
    entry => { entry.rights.teaching.commercialUse = false; },
    entry => { entry.rights.example.redistribution = false; },
    entry => { entry.rights.visuals = {}; },
    entry => { entry.copy.en.example = ''; },
    entry => { entry.provenance.sources = [{ url: 'http://insecure.example', accessed: '2026-09-18', purpose: 'example' }]; }
  ];
  for (const change of mutations) {
    const candidate = fakeGame();
    change(candidate);
    assert.equal(isPublishableGame(candidate), false, JSON.stringify(candidate));
    assert.deepEqual(publishedGames([candidate]), []);
  }
});

test('invalid data, unsupported materials/tools and unrealistic metadata never render', () => {
  assert.deepEqual(publishedGames([null, {}, 'bad']), []);
  for (const change of [
    e => { e.material = 'unknown'; }, e => { e.players.max = 99; },
    e => { e.duration.min = -1; }, e => { e.age.min = -1; },
    e => { e.tools = ['untrusted-url']; }, e => { e.tools = ['timer', 'timer']; },
    e => { e.copy.zh.setup = []; }, e => { e.id = '<script>'; }
  ]) {
    const candidate = fakeGame(); change(candidate);
    assert.equal(isPublishableGame(candidate), false);
  }
});

test('material, player range and bilingual search filters work only on publishable entries', () => {
  const games = publishedGames([fakeGame(), { ...fakeGame(), id: 'unapproved', review: { ...fakeGame().review, status: 'draft' } }]);
  assert.equal(filterPublishedGames(games, { query: '测试' }, 'zh').length, 1);
  assert.equal(filterPublishedGames(games, { query: 'fixture' }, 'en').length, 1);
  assert.equal(filterPublishedGames(games, { query: 'fixture' }, 'zh').length, 0);
  assert.equal(filterPublishedGames(games, { material: 'none', players: '5' }).length, 1);
  assert.equal(filterPublishedGames(games, { material: 'diy' }).length, 0);
  assert.equal(filterPublishedGames(games, { players: '2' }).length, 0);
  assert.equal(filterPublishedGames(games, { players: '9' }).length, 0);
  assert.equal(filterPublishedGames(games, { players: 'not-a-number' }).length, 0);
});
