from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'{path}: anchor mismatch')
    file.write_text(text.replace(old, new, 1))

replace_once('src/core.js', 'export const MAX_PLAYERS = 16;\n', 'export const MAX_PLAYERS = 16;\nexport const MAX_DRAW_BAG_ITEMS = 120;\n')

replace_once(
    'src/core.js',
    "    tools: {\n      history: [],\n      lastFirstPlayerId: null,\n      shuffledPlayerIds: [],\n      teams: []\n    },",
    "    tools: {\n      history: [],\n      lastFirstPlayerId: null,\n      shuffledPlayerIds: [],\n      teams: [],\n      drawBag: { items: [], remainingItems: [], drawnItems: [] }\n    },"
)

replace_once(
    'src/core.js',
    'function normalizeTeams(value, validIds, idMap = null) {',
    """function cleanDrawBagItem(value) {
  return String(value ?? '').trim().slice(0, 80);
}

function normalizeDrawBagItems(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanDrawBagItem).filter(Boolean).slice(0, MAX_DRAW_BAG_ITEMS);
}

function normalizeDrawBag(value) {
  const source = value && typeof value === 'object' ? value : {};
  const items = normalizeDrawBagItems(source.items);
  const remainingItems = items.slice();
  const drawnItems = [];
  normalizeDrawBagItems(source.drawnItems).forEach(item => {
    const index = remainingItems.indexOf(item);
    if (index < 0) return;
    remainingItems.splice(index, 1);
    drawnItems.push(item);
  });
  return { items, remainingItems, drawnItems };
}

function normalizeTeams(value, validIds, idMap = null) {"""
)

replace_once(
    'src/core.js',
    "      teams: normalizeTeams(input.tools?.teams, playerIds, playerIdMap)\n    },",
    "      teams: normalizeTeams(input.tools?.teams, playerIds, playerIdMap),\n      drawBag: normalizeDrawBag(input.tools?.drawBag)\n    },"
)

replace_once(
    'src/core.js',
    "  state.tools.shuffledPlayerIds = [];\n  state.tools.teams = [];\n  ensureRound(state, state.timer.round);",
    "  state.tools.shuffledPlayerIds = [];\n  state.tools.teams = [];\n  resetDrawBag(state);\n  ensureRound(state, state.timer.round);"
)

replace_once(
    'src/core.js',
    'export function addToolHistory(state, entry) {',
    """export function parseDrawBagItems(input = '') {
  return String(input ?? '').split(/\\r?\\n/).map(cleanDrawBagItem).filter(Boolean).slice(0, MAX_DRAW_BAG_ITEMS);
}

export function setDrawBagItems(state, input = '') {
  const requestedItems = String(input ?? '').split(/\\r?\\n/).map(cleanDrawBagItem).filter(Boolean);
  const items = requestedItems.slice(0, MAX_DRAW_BAG_ITEMS);
  const bag = state.tools.drawBag ||= { items: [], remainingItems: [], drawnItems: [] };
  const changed = JSON.stringify(bag.items) !== JSON.stringify(items);
  if (changed) {
    bag.items = items;
    bag.remainingItems = items.slice();
    bag.drawnItems = [];
  }
  return { requested: requestedItems.length, saved: items.length, limitReached: requestedItems.length > items.length, changed };
}

export function drawBagItem(state, randomSource = globalThis.crypto) {
  const bag = state.tools.drawBag ||= { items: [], remainingItems: [], drawnItems: [] };
  if (!bag.remainingItems.length) return null;
  const index = randomInt(bag.remainingItems.length, randomSource);
  const [item] = bag.remainingItems.splice(index, 1);
  bag.drawnItems.push(item);
  return item;
}

export function resetDrawBag(state) {
  const bag = state.tools.drawBag ||= { items: [], remainingItems: [], drawnItems: [] };
  const changed = bag.drawnItems.length > 0 || bag.remainingItems.length !== bag.items.length;
  bag.remainingItems = bag.items.slice();
  bag.drawnItems = [];
  return changed;
}

export function addToolHistory(state, entry) {"""
)

print('core migration prepared')
