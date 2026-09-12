import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState, syncParticipantsFromGame, applyAssistantTemplate,
  setScoreSheetValue, setRole, setActivePhase, serializeTableOsState
} from '../../src/tabletop-core.js';
import {
  buildTableOsArchiveSummary, TABLE_OS_COMPANION_STORAGE_KEY
} from '../../src/tabletop-archive-bridge.js';
import { TABLE_OS_STORAGE_KEY } from '../../src/tabletop-core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}

test('Table OS archive summary is session-bound and strips private role data', () => {
  const storage = memoryStorage();
  const game = {
    session: { startedAt: '2026-09-12T12:00:00.000Z' },
    score: { rounds: [{ round: 1, createdAt: '2026-09-12T12:00:01.000Z' }] }
  };
  const state = createDefaultTableOsState();
  syncParticipantsFromGame(state, [{ id: 'p1', name: 'Alice', color: '#f97316' }]);
  applyAssistantTemplate(state, 'campaign');
  const player = state.participants[0];
  const scoreField = state.scoreSheet.fields[0];
  setScoreSheetValue(state, player.id, scoreField.id, 12.5);
  setRole(state, player.id, { role: 'Secret Agent', faction: 'Hidden', note: 'Moderator only', secret: true });
  state.campaign.name = 'Friday Legacy';
  state.campaign.chapter = 'Chapter 3';
  state.campaign.sessionNumber = 4;
  setActivePhase(state, 2);
  state.phases.cycle = 3;
  storage.setItem(TABLE_OS_STORAGE_KEY, serializeTableOsState(state));
  storage.setItem(TABLE_OS_COMPANION_STORAGE_KEY, JSON.stringify({ associatedMainSessionId: 'round:2026-09-12T12:00:01.000Z' }));

  const summary = buildTableOsArchiveSummary(game, storage);
  assert.equal(summary.phaseName, '遭遇');
  assert.equal(summary.phaseCycle, 3);
  assert.equal(summary.campaign.name, 'Friday Legacy');
  assert.equal(summary.campaign.chapter, 'Chapter 3');
  assert.equal(summary.campaign.sessionNumber, 4);
  assert.equal(summary.scores[0].name, 'Alice');
  assert.equal(summary.scores[0].total, 12.5);
  assert.equal(JSON.stringify(summary).includes('Secret Agent'), false);
  assert.equal(JSON.stringify(summary).includes('Moderator only'), false);

  storage.setItem(TABLE_OS_COMPANION_STORAGE_KEY, JSON.stringify({ associatedMainSessionId: 'round:other' }));
  assert.equal(buildTableOsArchiveSummary(game, storage), null, 'stale Table OS state is not attached to a different main session');
});
