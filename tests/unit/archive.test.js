import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIVE_STORAGE_KEY, MAX_ARCHIVE_ENTRIES, normalizeArchiveEntry,
  loadArchive, saveGameToArchive, deleteArchiveEntry, clearArchive
} from '../../src/archive.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

const sampleGame = {
  name: 'Friday Night',
  locale: 'zh',
  templateId: 'strategy',
  rule: 'highest',
  target: 20,
  roundCount: 4,
  startedAt: '2024-01-01T10:00:00.000Z',
  finishedAt: '2024-01-01T12:00:00.000Z',
  timerMode: 'chess',
  baseSeconds: 600,
  fields: [{ id: 'vp', nameKey: 'field.vp', customName: '', step: 2, effect: 1 }],
  players: [
    { name: 'Alice', color: '#f97316', score: 21, rank: 1 },
    { name: 'Bob', color: 'not-a-color', score: -3, rank: 2 }
  ]
};

test('entries are normalized with safe bounds and fallbacks', () => {
  const entry = normalizeArchiveEntry(sampleGame);
  assert.equal(entry.name, 'Friday Night');
  assert.equal(entry.players[0].color, '#f97316');
  assert.equal(entry.players[1].color, '#64748b', 'invalid colors fall back');
  assert.equal(entry.players[1].score, -3);
  assert.deepEqual(entry.fields, [{ id: 'vp', nameKey: 'field.vp', customName: '', step: 2, effect: 1 }]);
  assert.equal(entry.timerMode, 'chess');
  assert.equal(entry.baseSeconds, 600);
  const broken = normalizeArchiveEntry({ name: 'x'.repeat(500), fields: [{ id: 'vp', step: 99999, effect: 7 }, 'junk'], timerMode: 'nope', baseSeconds: 1, players: [{ name: 'a'.repeat(100), score: 'NaN', rank: 0 }] });
  assert.equal(broken.name.length, 60);
  assert.equal(broken.fields.length, 1, 'malformed field entries are dropped');
  assert.equal(broken.fields[0].step, 1000, 'field steps are clamped');
  assert.equal(broken.fields[0].effect, 1, 'invalid effects fall back to plus');
  assert.equal(broken.timerMode, null, 'unknown timer modes become null');
  assert.equal(broken.baseSeconds, 5, 'out-of-range base seconds are clamped to the minimum');
  assert.equal(broken.players[0].name.length, 40);
  assert.equal(broken.players[0].score, 0);
  assert.equal(broken.players[0].rank, 1);
});

test('save prepends, dedupes by id, and persists to storage', () => {
  const storage = fakeStorage();
  saveGameToArchive({ ...sampleGame, id: 'game_first' }, storage);
  saveGameToArchive({ ...sampleGame, id: 'game_second', name: 'Second' }, storage);
  let list = loadArchive(storage);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, 'Second');

  saveGameToArchive({ ...sampleGame, id: 'game_first', name: 'Friday Night updated' }, storage);
  list = loadArchive(storage);
  assert.equal(list.length, 2, 'same entry is replaced, not duplicated');
  assert.equal(list[0].name, 'Friday Night updated');
});

test('load tolerates corrupted or unexpected payloads', () => {
  assert.deepEqual(loadArchive(fakeStorage()), []);
  assert.deepEqual(loadArchive(fakeStorage({ [ARCHIVE_STORAGE_KEY]: '{broken json' })), []);
  assert.deepEqual(loadArchive(fakeStorage({ [ARCHIVE_STORAGE_KEY]: '{"nope":true}' })), []);
  assert.deepEqual(loadArchive(fakeStorage({ [ARCHIVE_STORAGE_KEY]: JSON.stringify([null, 5, sampleGame]) })).length, 1);
});

test('the archive trims to its maximum size and supports deletion', () => {
  const storage = fakeStorage();
  for (let index = 0; index < MAX_ARCHIVE_ENTRIES + 10; index += 1) {
    saveGameToArchive({ ...sampleGame, id: `game_${index}` }, storage);
  }
  const full = loadArchive(storage);
  assert.equal(full.length, MAX_ARCHIVE_ENTRIES);
  assert.equal(full[0].id, `game_${MAX_ARCHIVE_ENTRIES + 9}`, 'oldest entries are dropped first');

  deleteArchiveEntry(full[0].id, storage);
  assert.equal(loadArchive(storage).length, MAX_ARCHIVE_ENTRIES - 1);

  clearArchive(storage);
  assert.deepEqual(loadArchive(storage), []);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), null);
});
