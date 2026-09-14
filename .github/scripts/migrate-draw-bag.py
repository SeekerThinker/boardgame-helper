from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}')
    p.write_text(text.replace(old, new, 1))


# Core state + pure draw-bag mechanics.
replace_once('src/core.js', "export const SCHEMA_VERSION = 2;\n", "export const SCHEMA_VERSION = 3;\nexport const MAX_DRAW_BAG_ITEMS = 100;\n")
replace_once(
    'src/core.js',
    "      teams: []\n    },",
    "      teams: [],\n      drawBag: { items: [], remainingIds: [], lastDrawnId: null }\n    },"
)
replace_once(
    'src/core.js',
    "function normalizeToolHistory(entry, playerIdMap = null) {",
    "function normalizeDrawBag(value) {\n  const source = value && typeof value === 'object' ? value : {};\n  const used = new Set();\n  const items = (Array.isArray(source.items) ? source.items : []).slice(0, MAX_DRAW_BAG_ITEMS).map((item, index) => {\n    const sourceItem = typeof item === 'string' ? { label: item } : (item && typeof item === 'object' ? item : {});\n    let id = safeIdentifier(sourceItem.id || `bag_${index + 1}`, 'bag_');\n    id = uniqueIdentifier(id, used, 'bag_');\n    used.add(id);\n    return { id, label: String(sourceItem.label ?? '').trim().slice(0, 60) || `Item ${index + 1}` };\n  });\n  const valid = new Set(items.map(item => item.id));\n  const remainingIds = [...new Set((Array.isArray(source.remainingIds) ? source.remainingIds : items.map(item => item.id)).map(String))].filter(id => valid.has(id));\n  const lastDrawnId = valid.has(String(source.lastDrawnId ?? '')) ? String(source.lastDrawnId) : null;\n  return { items, remainingIds, lastDrawnId };\n}\n\nfunction normalizeToolHistory(entry, playerIdMap = null) {"
)
replace_once(
    'src/core.js',
    "      shuffledPlayerIds: normalizePlayerIdList(input.tools?.shuffledPlayerIds, playerIds, playerIdMap),\n      teams: normalizeTeams(input.tools?.teams, playerIds, playerIdMap)\n    },",
    "      shuffledPlayerIds: normalizePlayerIdList(input.tools?.shuffledPlayerIds, playerIds, playerIdMap),\n      teams: normalizeTeams(input.tools?.teams, playerIds, playerIdMap),\n      drawBag: normalizeDrawBag(input.tools?.drawBag)\n    },"
)
replace_once(
    'src/core.js',
    "  state.tools.teams = [];\n  ensureRound(state, state.timer.round);",
    "  state.tools.teams = [];\n  resetDrawBag(state);\n  ensureRound(state, state.timer.round);"
)
replace_once(
    'src/core.js',
    "export function addToolHistory(state, entry) {\n  state.tools.history.push({ id: uid('tool_'), at: new Date().toISOString(), ...entry });",
    "export function setDrawBagFromText(state, input = '') {\n  const labels = String(input ?? '').split(/\\r?\\n/).map(item => item.trim().slice(0, 60)).filter(Boolean);\n  const saved = labels.slice(0, MAX_DRAW_BAG_ITEMS);\n  const items = saved.map(label => ({ id: uid('bag_'), label }));\n  state.tools.drawBag = { items, remainingIds: items.map(item => item.id), lastDrawnId: null };\n  return { requested: labels.length, saved: items.length, limitReached: labels.length > items.length };\n}\n\nexport function drawFromBag(state, randomSource = globalThis.crypto) {\n  const bag = state.tools.drawBag || (state.tools.drawBag = { items: [], remainingIds: [], lastDrawnId: null });\n  if (!bag.remainingIds.length) return null;\n  const index = randomInt(bag.remainingIds.length, randomSource);\n  const [id] = bag.remainingIds.splice(index, 1);\n  const item = bag.items.find(candidate => candidate.id === id) || null;\n  bag.lastDrawnId = item?.id || null;\n  return item;\n}\n\nexport function resetDrawBag(state) {\n  const bag = state.tools.drawBag || (state.tools.drawBag = { items: [], remainingIds: [], lastDrawnId: null });\n  bag.remainingIds = bag.items.map(item => item.id);\n  bag.lastDrawnId = null;\n  return bag.remainingIds.length;\n}\n\nexport function addToolHistory(state, entry) {\n  state.tools.history.push({ id: uid('tool_'), at: new Date().toISOString(), ...entry });"
)

# Main UI and actions.
replace_once(
    'src/app.js',
    "  addScoreField, removeScoreField, rollDice, flipCoin, chooseFirstPlayer,\n  shufflePlayerOrder, applyShuffledOrder, makeTeams, addToolHistory, clamp, prepareRematch,",
    "  addScoreField, removeScoreField, rollDice, flipCoin, chooseFirstPlayer,\n  shufflePlayerOrder, applyShuffledOrder, makeTeams, setDrawBagFromText, drawFromBag, resetDrawBag, addToolHistory, clamp, prepareRematch,"
)
replace_once(
    'src/app.js',
    "function renderTools() {\n  const first = state.players.find(player => player.id === state.tools.lastFirstPlayerId);\n  const shuffled = state.tools.shuffledPlayerIds.map(id => state.players.find(player => player.id === id)).filter(Boolean);",
    "function renderTools() {\n  const first = state.players.find(player => player.id === state.tools.lastFirstPlayerId);\n  const shuffled = state.tools.shuffledPlayerIds.map(id => state.players.find(player => player.id === id)).filter(Boolean);\n  const bag = state.tools.drawBag;\n  const lastBagItem = bag.items.find(item => item.id === bag.lastDrawnId);\n  const bagRemaining = bag.remainingIds.length;"
)
replace_once(
    'src/app.js',
    "      </section>\n      <section class=\"panel tool-card\"><div class=\"section-head\"><div><h2>👆 ${tr('tools.first')}</h2>",
    "      </section>\n      <section class=\"panel tool-card\"><div class=\"section-head\"><div><h2>🎴 ${tr('tools.drawBag')}</h2><p>${tr('tools.drawBagHelp')}</p></div></div>\n        ${bag.items.length ? `<div class=\"tool-result\"><strong>${lastBagItem ? escapeHtml(lastBagItem.label) : escapeHtml(tr('tools.drawBagReady'))}</strong><span>${tr('tools.drawBagRemaining', { remaining: bagRemaining, total: bag.items.length })}</span></div><div class=\"split-actions\"><button class=\"primary-action small\" type=\"button\" data-action=\"draw-bag\" ${bagRemaining ? '' : 'disabled'}>${tr('tools.drawBagDraw')}</button><button class=\"text-btn large\" type=\"button\" data-action=\"reset-draw-bag\">${tr('tools.drawBagReset')}</button></div>` : `<p class=\"empty-state\">${tr('tools.drawBagEmpty')}</p>`}\n        <details class=\"collapsible\" ${bag.items.length ? '' : 'open'}><summary>${tr('tools.drawBagEdit')} · ${bag.items.length}</summary><div class=\"collapsible-body\"><label><span class=\"label-text\">${tr('tools.drawBagList')}</span><textarea rows=\"5\" maxlength=\"7000\" data-draw-bag-list placeholder=\"${escapeAttr(tr('tools.drawBagPlaceholder'))}\">${escapeHtml(bag.items.map(item => item.label).join('\\n'))}</textarea></label><button class=\"text-btn large\" type=\"button\" data-action=\"save-draw-bag\">${tr('tools.drawBagSave')}</button></div></details>\n      </section>\n      <section class=\"panel tool-card\"><div class=\"section-head\"><div><h2>👆 ${tr('tools.first')}</h2>"
)
replace_once(
    'src/app.js',
    "  if (item.type === 'teams') return tr('tools.historyTeams', { count: item.count });\n  return '';",
    "  if (item.type === 'teams') return tr('tools.historyTeams', { count: item.count });\n  if (item.type === 'bag') return tr('tools.historyBag', { label: item.label || '—' });\n  return '';"
)
replace_once(
    'src/app.js',
    "  if (action === 'make-teams') makeTeamsFlow();\n  if (action === 'finish-session')",
    "  if (action === 'make-teams') makeTeamsFlow();\n  if (action === 'save-draw-bag') saveDrawBagFlow();\n  if (action === 'draw-bag') drawBagFlow();\n  if (action === 'reset-draw-bag') { resetDrawBag(state); render(); }\n  if (action === 'finish-session')"
)
replace_once(
    'src/app.js',
    "function finishTurnFlow() {",
    "function saveDrawBagFlow() {\n  const input = document.querySelector('[data-draw-bag-list]');\n  const result = setDrawBagFromText(state, input instanceof HTMLTextAreaElement ? input.value : '');\n  showToast('tools.drawBagSaved', { count: result.saved });\n  render();\n}\n\nfunction drawBagFlow() {\n  const item = drawFromBag(state);\n  if (!item) return;\n  addToolHistory(state, { type: 'bag', label: item.label });\n  sFinish();\n  render();\n}\n\nfunction finishTurnFlow() {"
)

# Bilingual strings.
replace_once(
    'src/i18n.js',
    "    'tools.needPlayers': '至少需要 2 位玩家', 'tools.history': '最近结果', 'tools.noHistory': '还没有随机结果',\n    'tools.historyDice': '{count}d{sides}{modifier} = {total}', 'tools.historyCoin': '硬币：{result}',",
    "    'tools.needPlayers': '至少需要 2 位玩家', 'tools.history': '最近结果', 'tools.noHistory': '还没有随机结果',\n    'tools.drawBag': '不放回抽取', 'tools.drawBagHelp': '自定义袋子或牌堆；每项在重置前最多抽到一次。',\n    'tools.drawBagReady': '准备抽取', 'tools.drawBagRemaining': '剩余 {remaining} / {total}', 'tools.drawBagDraw': '抽一项',\n    'tools.drawBagReset': '重置袋子', 'tools.drawBagEmpty': '先添加要抽取的项目。', 'tools.drawBagEdit': '编辑项目',\n    'tools.drawBagList': '每行一项', 'tools.drawBagPlaceholder': '事件 A\\n事件 B\\n事件 C', 'tools.drawBagSave': '保存并重置袋子',\n    'tools.drawBagSaved': '已保存 {count} 项并重置抽取进度。', 'tools.historyBag': '抽取：{label}',\n    'tools.historyDice': '{count}d{sides}{modifier} = {total}', 'tools.historyCoin': '硬币：{result}',"
)
replace_once(
    'src/i18n.js',
    "    'tools.needPlayers': 'At least 2 players are required', 'tools.history': 'Recent results', 'tools.noHistory': 'No random results yet',\n    'tools.historyDice': '{count}d{sides}{modifier} = {total}', 'tools.historyCoin': 'Coin: {result}',",
    "    'tools.needPlayers': 'At least 2 players are required', 'tools.history': 'Recent results', 'tools.noHistory': 'No random results yet',\n    'tools.drawBag': 'Draw without replacement', 'tools.drawBagHelp': 'Create a custom bag or deck; each item can be drawn once until reset.',\n    'tools.drawBagReady': 'Ready to draw', 'tools.drawBagRemaining': '{remaining} / {total} remaining', 'tools.drawBagDraw': 'Draw one',\n    'tools.drawBagReset': 'Reset bag', 'tools.drawBagEmpty': 'Add items before drawing.', 'tools.drawBagEdit': 'Edit items',\n    'tools.drawBagList': 'One item per line', 'tools.drawBagPlaceholder': 'Event A\\nEvent B\\nEvent C', 'tools.drawBagSave': 'Save and reset bag',\n    'tools.drawBagSaved': 'Saved {count} items and reset draw progress.', 'tools.historyBag': 'Draw: {label}',\n    'tools.historyDice': '{count}d{sides}{modifier} = {total}', 'tools.historyCoin': 'Coin: {result}',"
)

# README feature list.
replace_once(
    'README.md',
    "- 工具：掷骰/硬币（结果大屏展示）、随机首家、行动顺序洗牌、2–4 队均衡分队\n",
    "- 工具：掷骰/硬币（结果大屏展示）、随机首家、行动顺序洗牌、2–4 队均衡分队、自定义袋子/牌堆无放回抽取（跨刷新保留剩余项目，新一局只重置抽取进度）\n"
)

# Unit coverage.
Path('tests/unit/draw-bag.test.js').write_text("""import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {\n  createDefaultState, normalizeState, prepareRematch, setDrawBagFromText, drawFromBag, resetDrawBag\n} from '../../src/core.js';\n\nfunction fixedRandom(value = 0) {\n  return { getRandomValues(array) { array[0] = value; return array; } };\n}\n\ntest('draw bag parses one item per line and keeps duplicate labels as distinct entries', () => {\n  const state = createDefaultState('en');\n  const result = setDrawBagFromText(state, 'Alpha\\nBeta\\nAlpha\\n\\nGamma');\n  assert.deepEqual(result, { requested: 4, saved: 4, limitReached: false });\n  assert.deepEqual(state.tools.drawBag.items.map(item => item.label), ['Alpha', 'Beta', 'Alpha', 'Gamma']);\n  assert.equal(new Set(state.tools.drawBag.items.map(item => item.id)).size, 4);\n  assert.equal(state.tools.drawBag.remainingIds.length, 4);\n});\n\ntest('draw bag draws without replacement, exhausts, and resets', () => {\n  const state = createDefaultState('en');\n  setDrawBagFromText(state, 'A\\nB\\nC');\n  const draws = [drawFromBag(state, fixedRandom(0)), drawFromBag(state, fixedRandom(0)), drawFromBag(state, fixedRandom(0))];\n  assert.deepEqual(draws.map(item => item.label), ['A', 'B', 'C']);\n  assert.equal(state.tools.drawBag.remainingIds.length, 0);\n  assert.equal(drawFromBag(state, fixedRandom(0)), null);\n  assert.equal(resetDrawBag(state), 3);\n  assert.equal(state.tools.drawBag.lastDrawnId, null);\n});\n\ntest('draw bag remaining state survives normalization and rejects stale ids', () => {\n  const state = createDefaultState('en');\n  setDrawBagFromText(state, 'A\\nB\\nC');\n  const drawn = drawFromBag(state, fixedRandom(0));\n  state.tools.drawBag.remainingIds.push('retired-id');\n  const normalized = normalizeState(state, 'en');\n  assert.equal(normalized.schemaVersion, 3);\n  assert.equal(normalized.tools.drawBag.items.length, 3);\n  assert.equal(normalized.tools.drawBag.remainingIds.length, 2);\n  assert.equal(normalized.tools.drawBag.remainingIds.includes('retired-id'), false);\n  assert.equal(normalized.tools.drawBag.lastDrawnId, drawn.id);\n});\n\ntest('rematch preserves bag definition but resets draw progress', () => {\n  const state = createDefaultState('en');\n  setDrawBagFromText(state, 'A\\nB\\nC');\n  drawFromBag(state, fixedRandom(0));\n  prepareRematch(state);\n  assert.deepEqual(state.tools.drawBag.items.map(item => item.label), ['A', 'B', 'C']);\n  assert.equal(state.tools.drawBag.remainingIds.length, 3);\n  assert.equal(state.tools.drawBag.lastDrawnId, null);\n});\n""")

# Chromium regression: configure, draw, reload, exhaust, reset, and verify rematch keeps configuration.
replace_once(
    'tests/e2e/run-e2e.js',
    "  await page.getByRole('button', { name: '抛硬币' }).click();\n  assert.match(await page.locator('.random-result strong').textContent(), /^(正面|反面)$/);\n  await page.getByRole('button', { name: '开始', exact: true }).click();",
    "  await page.getByRole('button', { name: '抛硬币' }).click();\n  assert.match(await page.locator('.random-result strong').textContent(), /^(正面|反面)$/);\n\n  const bagEditor = page.locator('[data-draw-bag-list]');\n  await bagEditor.fill('红门\\n蓝门\\n绿门');\n  await page.getByRole('button', { name: '保存并重置袋子' }).click();\n  assert.ok(await page.getByText('剩余 3 / 3', { exact: true }).isVisible());\n  await page.getByRole('button', { name: '抽一项', exact: true }).click();\n  let bagState = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).tools.drawBag);\n  assert.equal(bagState.remainingIds.length, 2);\n  const firstBagDrawId = bagState.lastDrawnId;\n  await page.reload({ waitUntil: 'networkidle' });\n  await page.getByRole('tab', { name: '工具', exact: true }).click();\n  bagState = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).tools.drawBag);\n  assert.equal(bagState.remainingIds.length, 2, 'bag remaining state survives reload');\n  assert.equal(bagState.lastDrawnId, firstBagDrawId);\n  await page.getByRole('button', { name: '抽一项', exact: true }).click();\n  await page.getByRole('button', { name: '抽一项', exact: true }).click();\n  assert.equal(await page.getByRole('button', { name: '抽一项', exact: true }).isDisabled(), true);\n  const exhausted = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).tools.drawBag);\n  assert.equal(exhausted.remainingIds.length, 0);\n  assert.equal(new Set(exhausted.items.map(item => item.id)).size, 3);\n  await page.getByRole('button', { name: '重置袋子', exact: true }).click();\n  assert.ok(await page.getByText('剩余 3 / 3', { exact: true }).isVisible());\n\n  await page.getByRole('button', { name: '开始', exact: true }).click();"
)
replace_once(
    'tests/e2e/run-e2e.js',
    "  assert.equal(await page.locator('#runningBadge').count(), 0);\n\n  // Share button and archive rematch:",
    "  assert.equal(await page.locator('#runningBadge').count(), 0);\n  await page.getByRole('tab', { name: 'Tools', exact: true }).click();\n  const rematchBag = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).tools.drawBag);\n  assert.deepEqual(rematchBag.items.map(item => item.label), ['红门', '蓝门', '绿门']);\n  assert.equal(rematchBag.remainingIds.length, 3, 'rematch resets bag progress but preserves bag definition');\n\n  // Share button and archive rematch:"
)
replace_once(
    'tests/e2e/run-e2e.js',
    "'toolbox', 'dice and coin result display', 'session finish/resume'",
    "'toolbox', 'dice and coin result display', 'draw bag without replacement', 'session finish/resume'"
)

print('draw bag migration applied')
