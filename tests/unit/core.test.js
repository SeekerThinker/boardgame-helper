import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultState, normalizeState, applyPreset, ensureRound, setRoundScore,
  addRoundScore, undoScore, recalculateScores, rankedPlayers, targetReached,
  startTimer, pauseTimer, reconcileTimer, adjustTimer, setActivePlayer,
  currentTimerSeconds, rollDice, shuffle, makeTeams, addPlayer, removePlayer,
  addScoreField, prepareRematch, nextRound, roundScoreValue, chooseFirstPlayer,
  shufflePlayerOrder, movePlayer, setPlayerColor, activePlayer
} from '../../src/core.js';

function deterministicCrypto(values) {
  let index = 0;
  return {
    getRandomValues(array) {
      array[0] = values[index % values.length] >>> 0;
      index += 1;
      return array;
    }
  };
}

test('default state uses schema v3 and subtracting preset fields', () => {
  const state = createDefaultState();
  assert.equal(state.schemaVersion, 3);
  assert.equal(state.score.fields.find(field => field.id === 'penalty').effect, -1);
  assert.equal(state.players.length, 4);
});

test('legacy state migrates without changing visible legacy totals', () => {
  const legacy = {
    lang: 'en',
    sessionName: 'Legacy Game',
    players: [{ id: 'p1', name: 'A', scoreBreakdown: { score: 7 }, score: 7 }],
    timer: { mode: 'turn', seconds: 60, remaining: 42, activePlayer: 0, round: 2 },
    score: { presetId: 'party', rule: 'highest', target: 30, fields: [{ id: 'score', name: 'Score', step: 1 }], rounds: [], history: [] }
  };
  const state = normalizeState(legacy);
  assert.equal(state.locale, 'en');
  assert.equal(state.session.name, 'Legacy Game');
  assert.equal(state.score.rounds.length, 1);
  assert.equal(state.players[0].score, 7);
  assert.equal(state.timer.running, false);
});

test('invalid persisted deadlines cannot leave a frozen running timer', () => {
  for (const deadlineMs of [null, 0, 'not-a-date']) {
    const state = normalizeState({ timer: { running: true, deadlineMs } });
    assert.equal(state.timer.running, false);
    assert.equal(state.timer.deadlineMs, null);
  }
});

test('malformed identifiers and tool data are normalized safely', () => {
  const state = normalizeState({
    players: [{ id: 7, name: 'A' }, { id: 7, name: 'B' }],
    timer: { activePlayerId: 7 },
    score: {
      fields: [{ id: 'same', name: 'One' }, { id: 'same', name: 'Two' }],
      rounds: [{ round: 1, scores: { 7: { same: 4 } } }]
    },
    tools: {
      history: [{ type: 'order' }, null],
      lastFirstPlayerId: null,
      shuffledPlayerIds: [7, 'missing'],
      teams: [{ playerIds: null }, { playerIds: [7, 'missing'] }]
    }
  });
  assert.equal(state.players[0].id, '7');
  assert.equal(new Set(state.players.map(player => player.id)).size, 2);
  assert.equal(new Set(state.score.fields.map(field => field.id)).size, 2);
  assert.deepEqual(state.tools.history[0].playerIds, []);
  assert.equal(state.tools.lastFirstPlayerId, null);
  assert.deepEqual(state.tools.shuffledPlayerIds, ['7']);
  assert.doesNotThrow(() => addScoreField(state, 'Extra'));
});

test('unsafe persisted identifiers are sanitized and references stay connected', () => {
  const rawPlayerId = 'player:1" data-x="boom';
  const rawFieldId = 'victory points:main';
  const state = normalizeState({
    players: [
      { id: rawPlayerId, name: 'Alice' },
      { id: 'player:2', name: 'Bob' }
    ],
    timer: { activePlayerId: rawPlayerId },
    score: {
      fields: [{ id: rawFieldId, customName: 'VP', step: 1, effect: 1 }],
      rounds: [{ round: 1, scores: { [rawPlayerId]: { [rawFieldId]: 9 } } }],
      undoStack: [{ kind: 'score', round: 1, playerId: rawPlayerId, fieldId: rawFieldId, previous: 4, next: 9, label: 'score.edit' }]
    },
    tools: {
      lastFirstPlayerId: rawPlayerId,
      shuffledPlayerIds: ['player:2', rawPlayerId],
      teams: [{ playerIds: [rawPlayerId, 'player:2'] }],
      history: [{ type: 'first', playerId: rawPlayerId }]
    }
  });

  const [alice, bob] = state.players;
  const [field] = state.score.fields;
  assert.match(alice.id, /^[a-zA-Z0-9_-]+$/);
  assert.match(bob.id, /^[a-zA-Z0-9_-]+$/);
  assert.match(field.id, /^[a-zA-Z0-9_-]+$/);
  assert.equal(state.timer.activePlayerId, alice.id);
  assert.equal(roundScoreValue(state.score.rounds[0], alice.id, field.id), 9);
  assert.equal(alice.score, 9);
  assert.equal(state.tools.lastFirstPlayerId, alice.id);
  assert.deepEqual(state.tools.shuffledPlayerIds, [bob.id, alice.id]);
  assert.deepEqual(state.tools.teams[0].playerIds, [alice.id, bob.id]);
  assert.equal(state.tools.history[0].playerId, alice.id);

  const change = undoScore(state);
  assert.equal(change.playerId, alice.id);
  assert.equal(change.fieldId, field.id);
  assert.equal(roundScoreValue(state.score.rounds[0], alice.id, field.id), 4);
});

test('roster changes invalidate stale order and team previews', () => {
  const state = createDefaultState();
  state.tools.shuffledPlayerIds = state.players.map(player => player.id);
  state.tools.teams = [{ index: 0, playerIds: state.players.map(player => player.id) }];
  addPlayer(state);
  assert.deepEqual(state.tools.shuffledPlayerIds, []);
  assert.deepEqual(state.tools.teams, []);

  state.tools.shuffledPlayerIds = state.players.map(player => player.id);
  state.tools.teams = [{ index: 0, playerIds: state.players.map(player => player.id) }];
  removePlayer(state, state.players[0].id);
  assert.deepEqual(state.tools.shuffledPlayerIds, []);
  assert.deepEqual(state.tools.teams, []);
});

test('score effects, quick adjustment, and undo are consistent', () => {
  const state = createDefaultState();
  const player = state.players[0];
  const round = ensureRound(state, 1);
  setRoundScore(state, 1, player.id, 'vp', 10);
  setRoundScore(state, 1, player.id, 'penalty', 3);
  assert.equal(player.score, 7);
  addRoundScore(state, 1, player.id, 'vp', 5);
  assert.equal(player.score, 12);
  const change = undoScore(state);
  assert.equal(change.next, 15);
  assert.equal(player.score, 7);
  assert.equal(round.scores[player.id].vp, 10);
});

test('preset replacement creates the correct low-score model', () => {
  const state = createDefaultState();
  applyPreset(state, 'penalty');
  assert.equal(state.score.rule, 'lowest');
  assert.ok(state.score.fields.every(field => field.effect === 1));
});

test('timer reconciles against a wall-clock deadline', () => {
  const state = createDefaultState();
  state.timer.baseSeconds = 90;
  state.timer.remainingSeconds = 90;
  assert.equal(startTimer(state, 1_000), true);
  assert.equal(state.timer.deadlineMs, 91_000);
  let result = reconcileTimer(state, 31_000);
  assert.equal(result.remaining, 60);
  result = reconcileTimer(state, 92_000);
  assert.equal(result.expired, true);
  assert.equal(state.timer.running, false);
  assert.equal(currentTimerSeconds(state, 92_000), 0);
});

test('chess and shared-pool timers preserve independent sources', () => {
  const chess = createDefaultState();
  chess.timer.mode = 'chess';
  chess.players[0].poolSeconds = 120;
  chess.players[1].poolSeconds = 80;
  startTimer(chess, 0);
  pauseTimer(chess, 30_000);
  assert.equal(chess.players[0].poolSeconds, 90);
  setActivePlayer(chess, chess.players[1].id);
  assert.equal(currentTimerSeconds(chess), 80);

  const pool = createDefaultState();
  pool.timer.mode = 'pool';
  pool.timer.sharedRemainingSeconds = 300;
  startTimer(pool, 0);
  adjustTimer(pool, 30, 60_000);
  assert.equal(pool.timer.sharedRemainingSeconds, 270);
});

test('rankings use competition ranks for ties and target detection', () => {
  const state = createDefaultState();
  const round = ensureRound(state, 1);
  state.score.target = 10;
  state.players.forEach((player, index) => { round.scores[player.id].vp = index < 2 ? 10 : 2; });
  recalculateScores(state);
  const ranked = rankedPlayers(state);
  assert.deepEqual(ranked.map(item => item.rank), [1, 1, 3, 3]);
  assert.equal(targetReached(state), true);
});

test('dice, shuffle, and team assignment stay within their contracts', () => {
  const random = deterministicCrypto([0, 1, 2, 3, 4, 5, 6, 7]);
  const dice = rollDice({ sides: 6, count: 4, modifier: 2 }, random);
  assert.deepEqual(dice.rolls, [1, 2, 3, 4]);
  assert.equal(dice.total, 12);
  const order = shuffle(['a', 'b', 'c', 'd'], deterministicCrypto([0, 1, 2]));
  assert.deepEqual([...order].sort(), ['a', 'b', 'c', 'd']);

  const state = createDefaultState();
  const teams = makeTeams(state, 3, deterministicCrypto([0, 1, 2, 3, 4]));
  const sizes = teams.map(team => team.playerIds.length);
  assert.equal(Math.max(...sizes) - Math.min(...sizes), 1);
  assert.equal(new Set(teams.flatMap(team => team.playerIds)).size, state.players.length);
});

test('roster supports recoloring and manual reordering within bounds', () => {
  const state = createDefaultState();
  const [p0, p1, p2, p3] = state.players.map(player => player.id);
  assert.equal(movePlayer(state, p0, -1), false, 'cannot move first player up');
  assert.equal(movePlayer(state, p3, 1), false, 'cannot move last player down');
  assert.equal(movePlayer(state, p1, -1), true);
  assert.deepEqual(state.players.map(player => player.id), [p1, p0, p2, p3]);
  setActivePlayer(state, p0);
  movePlayer(state, p0, 1);
  assert.equal(activePlayer(state).id, p0, 'active player follows its id across reorder');
  assert.equal(setPlayerColor(state, p0, '#12345z'), false, 'rejects invalid colors');
  assert.equal(setPlayerColor(state, p0, '#f97316'), true);
  assert.equal(state.players.find(player => player.id === p0).color, '#f97316');
});

test('rematch keeps roster and configuration but clears all play data', () => {
  const state = createDefaultState();
  state.players[0].name = 'Alice';
  ensureRound(state, 1);
  setRoundScore(state, 1, state.players[0].id, 'vp', 12);
  setRoundScore(state, 1, state.players[1].id, 'penalty', 3);
  nextRound(state);
  chooseFirstPlayer(state);
  shufflePlayerOrder(state);
  makeTeams(state, 3);
  state.session.name = 'Friday Night';
  state.session.finishedAt = new Date().toISOString();
  const templateBefore = state.templateId;
  const presetBefore = state.score.presetId;
  const targetBefore = state.score.target;

  prepareRematch(state);

  assert.equal(state.timer.round, 1);
  assert.equal(state.players.length, 4);
  assert.equal(state.players[0].name, 'Alice');
  assert.equal(state.players[0].score, 0, 'points are cleared');
  assert.equal(roundScoreValue(state.score.rounds[0], state.players[0].id, 'vp'), 0, 'fresh round 1');
  assert.deepEqual(state.score.rounds.map(round => round.round), [1]);
  assert.equal(state.players[1].poolSeconds, state.timer.baseSeconds, 'pools reset');
  assert.deepEqual(state.tools.shuffledPlayerIds, []);
  assert.deepEqual(state.tools.teams, []);
  assert.equal(state.tools.lastFirstPlayerId, null);
  assert.equal(state.timer.activePlayerId, state.players[0].id);
  assert.equal(state.session.status, 'active');
  assert.equal(state.session.startedAt, null);
  assert.equal(state.session.name, 'Friday Night', 'session name survives');
  assert.equal(state.templateId, templateBefore);
  assert.equal(state.score.presetId, presetBefore);
  assert.equal(state.score.target, targetBefore);
});
