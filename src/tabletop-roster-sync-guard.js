import { LEGACY_STORAGE_KEY, STORAGE_KEY } from './core.js';
import { MAX_TABLE_OS_PARTICIPANTS, TABLE_OS_STORAGE_KEY, parseTableOsState } from './tabletop-core.js';

const SYNC_SELECTOR = '[data-os-action="sync"]';
const BYPASS_DATA_KEY = 'osRosterSyncGuardBypass';
const MESSAGES = {
  zh: '同步当前玩家会移除 Table OS 中已不在主应用玩家名单里的参与者，并同时清除这些参与者的团队归属、私密身份、计分和相关状态/追踪值。此操作无法撤销。继续吗？',
  en: 'Syncing game players will remove Table OS participants who are no longer in the main game roster, along with their team membership, private roles, scores, and related status/tracker values. This cannot be undone. Continue?'
};

function confirmMessage() {
  return document.documentElement.lang?.toLowerCase().startsWith('en') ? MESSAGES.en : MESSAGES.zh;
}

function readGamePlayers() {
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(parsed?.players)) return parsed.players;
    } catch (_) {}
  }
  return [];
}

function normalizedSourceId(player, index) {
  return String(player?.id ?? `player_${index + 1}`)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
}

function syncWouldRemoveParticipants() {
  let tableState;
  try {
    const raw = localStorage.getItem(TABLE_OS_STORAGE_KEY);
    if (!raw) return false;
    tableState = parseTableOsState(raw);
  } catch (_) {
    return false;
  }

  const sourceIds = new Set(
    readGamePlayers()
      .slice(0, MAX_TABLE_OS_PARTICIPANTS)
      .map(normalizedSourceId)
      .filter(Boolean)
  );

  return tableState.participants.some(participant => participant.sourcePlayerId && !sourceIds.has(participant.sourcePlayerId));
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest(SYNC_SELECTOR) : null;
  if (!(target instanceof HTMLButtonElement)) return;

  if (target.dataset[BYPASS_DATA_KEY] === 'true') {
    delete target.dataset[BYPASS_DATA_KEY];
    return;
  }

  if (!syncWouldRemoveParticipants()) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (!confirm(confirmMessage())) return;

  target.dataset[BYPASS_DATA_KEY] = 'true';
  target.click();
}, true);
