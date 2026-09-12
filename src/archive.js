// Persistent local archive of finished games. Stored separately from the
// live game state so starting a new game never erases past results.
// All storage access is defensive: the module works in Node tests and in
// private-mode browsers by falling back to an in-memory store.
import { STORAGE_KEY, uid } from './core.js';

export const ARCHIVE_STORAGE_KEY = 'board-game-assistant-archive-v1';
export const MAX_ARCHIVE_ENTRIES = 30;

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem(ARCHIVE_STORAGE_KEY);
      return localStorage;
    }
  } catch (_) {}
  return createMemoryStorage();
}

function safeStorage(storage) {
  return storage || defaultStorage();
}

function clampInt(value, min, max, fallback = min) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#64748b';
}

function safeScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(Math.min(1000000, Math.max(-1000000, number)) * 100) / 100;
}

export function normalizeArchiveEntry(input) {
  const source = input && typeof input === 'object' ? input : {};
  const players = Array.isArray(source.players) ? source.players.slice(0, 16) : [];
  const fields = Array.isArray(source.fields) ? source.fields.slice(0, 12) : [];
  return {
    id: String(source.id || uid('game_')).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
    name: String(source.name ?? '').slice(0, 60) || 'Game',
    locale: source.locale === 'en' ? 'en' : 'zh',
    templateId: String(source.templateId ?? '').slice(0, 32),
    rule: source.rule === 'lowest' ? 'lowest' : 'highest',
    target: clampInt(source.target, 0, 999999, 0),
    roundCount: clampInt(source.roundCount, 1, 9999, 1),
    startedAt: typeof source.startedAt === 'string' ? source.startedAt.slice(0, 40) : null,
    finishedAt: typeof source.finishedAt === 'string' ? source.finishedAt.slice(0, 40) : null,
    players: players.map(player => ({
      name: String(player?.name ?? '').slice(0, 40),
      color: safeColor(player?.color),
      score: safeScore(player?.score),
      rank: clampInt(player?.rank, 1, 9999, 1)
    })),
    fields: fields.filter(field => field && typeof field === 'object').map(field => ({
      id: String(field?.id || uid('field_')).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48),
      nameKey: typeof field?.nameKey === 'string' ? field.nameKey.slice(0, 32) : '',
      customName: String(field?.customName ?? '').slice(0, 20),
      step: clampInt(field?.step, 1, 1000, 1),
      effect: Number(field?.effect) === -1 ? -1 : 1
    })),
    timerMode: ['turn', 'chess', 'pool', 'round'].includes(source.timerMode) ? source.timerMode : null,
    baseSeconds: clampInt(source.baseSeconds, 5, 86400, 90)
  };
}

function enrichMissingConfig(entry, storage) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const needsFields = !Array.isArray(source.fields) || source.fields.length === 0;
  const needsTimerMode = !['turn', 'chess', 'pool', 'round'].includes(source.timerMode);
  const baseSeconds = Number(source.baseSeconds);
  const needsBaseSeconds = !Number.isFinite(baseSeconds) || baseSeconds < 5;
  if (!needsFields && !needsTimerMode && !needsBaseSeconds) return source;

  try {
    const raw = safeStorage(storage).getItem(STORAGE_KEY);
    if (!raw) return source;
    const live = JSON.parse(raw);
    if (!live || typeof live !== 'object') return source;
    return {
      ...source,
      fields: needsFields && Array.isArray(live.score?.fields) ? live.score.fields : source.fields,
      timerMode: needsTimerMode ? live.timer?.mode : source.timerMode,
      baseSeconds: needsBaseSeconds ? live.timer?.baseSeconds : source.baseSeconds
    };
  } catch (_) {
    return source;
  }
}

export function loadArchive(storage = defaultStorage()) {
  try {
    const raw = safeStorage(storage).getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, MAX_ARCHIVE_ENTRIES)
      .filter(entry => entry && typeof entry === 'object')
      .map(normalizeArchiveEntry);
  } catch (_) {
    return [];
  }
}

export function persistArchive(entries, storage = defaultStorage()) {
  const list = entries.slice(0, MAX_ARCHIVE_ENTRIES);
  try { safeStorage(storage).setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(list)); } catch (_) {}
  return list;
}

export function saveGameToArchive(entry, storage = defaultStorage()) {
  const normalized = normalizeArchiveEntry(enrichMissingConfig(entry, storage));
  const rest = loadArchive(storage).filter(item => item.id !== normalized.id);
  return persistArchive([normalized, ...rest], storage);
}

export function deleteArchiveEntry(id, storage = defaultStorage()) {
  return persistArchive(loadArchive(storage).filter(item => item.id !== String(id)), storage);
}

export function clearArchive(storage = defaultStorage()) {
  try { safeStorage(storage).removeItem(ARCHIVE_STORAGE_KEY); } catch (_) {}
  return [];
}
