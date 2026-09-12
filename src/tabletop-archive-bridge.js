import { TABLE_OS_STORAGE_KEY, parseTableOsState, scoreCardForParticipant } from './tabletop-core.js';

export const TABLE_OS_COMPANION_STORAGE_KEY = 'board-game-assistant-table-os-companion-v1';

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_) {}
  return null;
}

function mainSessionIdentity(game) {
  const rounds = Array.isArray(game?.score?.rounds) ? game.score.rounds : [];
  const firstRound = rounds.find(round => Number(round?.round) === 1);
  const createdAt = typeof firstRound?.createdAt === 'string' ? firstRound.createdAt.trim() : '';
  if (createdAt) return `round:${createdAt}`;
  const startedAt = typeof game?.session?.startedAt === 'string' ? game.session.startedAt.trim() : '';
  return startedAt ? `start:${startedAt}` : '';
}

function associatedMainSessionId(storage) {
  try {
    const raw = storage?.getItem(TABLE_OS_COMPANION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return typeof parsed?.associatedMainSessionId === 'string' ? parsed.associatedMainSessionId : '';
  } catch (_) {
    return '';
  }
}

function readTableState(storage) {
  try {
    const raw = storage?.getItem(TABLE_OS_STORAGE_KEY);
    return raw ? parseTableOsState(raw) : null;
  } catch (_) {
    return null;
  }
}

export function buildTableOsArchiveSummary(mainGame, storage = defaultStorage()) {
  if (!storage) return null;
  const sessionId = mainSessionIdentity(mainGame);
  if (!sessionId || associatedMainSessionId(storage) !== sessionId) return null;
  const state = readTableState(storage);
  if (!state) return null;

  const hasWorkspace = Boolean(
    state.trackers.length || state.phases.items.length || state.teams.length ||
    state.scoreSheet.fields.length || state.campaign.enabled
  );
  if (!hasWorkspace) return null;

  const activePhase = state.phases.items[state.phases.activeIndex] || null;
  const scores = state.scoreSheet.fields.length
    ? state.participants.slice(0, 32).map(participant => ({
        name: participant.name,
        color: participant.color,
        total: scoreCardForParticipant(state, participant.id).total
      }))
    : [];

  return {
    templateId: String(state.appliedTemplateId || '').slice(0, 32),
    phaseName: String(activePhase?.name || '').slice(0, 40),
    phaseCycle: Math.max(1, Math.min(9999, Math.round(Number(state.phases.cycle) || 1))),
    campaign: state.campaign.enabled ? {
      name: String(state.campaign.name || '').slice(0, 60),
      chapter: String(state.campaign.chapter || '').slice(0, 60),
      sessionNumber: Math.max(1, Math.min(9999, Math.round(Number(state.campaign.sessionNumber) || 1)))
    } : null,
    scores
  };
}
