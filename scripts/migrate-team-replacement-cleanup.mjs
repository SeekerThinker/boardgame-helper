import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, from, to) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected marker not found in ${path}`);
  if (source.indexOf(from) !== source.lastIndexOf(from)) throw new Error(`Expected marker is not unique in ${path}`);
  writeFileSync(path, source.replace(from, to));
}

replaceOnce(
  'src/tabletop-core.js',
  `export function removeTeam(state, teamId) {\n`,
  `export function replaceTeams(state, teams = []) {\n  const validParticipantIds = new Set(state.participants.map(participant => participant.id));\n  const source = Array.isArray(teams) ? teams : [];\n  state.teams = normalizeTeams(source.map(team => ({\n    ...(team && typeof team === 'object' ? team : {}),\n    id: uid('team_')\n  })), validParticipantIds);\n  state.trackers.forEach(tracker => { if (tracker.scope === 'team') tracker.values = {}; });\n  state.statuses.forEach(status => { if (status.scope === 'team') status.values = {}; });\n  touch(state);\n  return state.teams;\n}\n\nexport function removeTeam(state, teamId) {\n`
);

replaceOnce(
  'src/tabletop.js',
  `  addTeam, removeTeam, toggleTeamMember, setRole, clearRole, roleForParticipant,\n`,
  `  addTeam, replaceTeams, removeTeam, toggleTeamMember, setRole, clearRole, roleForParticipant,\n`
);

replaceOnce(
  'src/tabletop.js',
  `function adoptRandomTeams() {\n  const game = readGameState();\n  const sourceTeams = Array.isArray(game?.tools?.teams) ? game.tools.teams : [];\n  if (!sourceTeams.length) { flash(tr('noRandomTeams')); return; }\n  const bySource = new Map(state.participants.filter(item => item.sourcePlayerId).map(item => [item.sourcePlayerId, item.id]));\n  state.teams = [];\n  sourceTeams.slice(0, MAX_TEAMS).forEach((sourceTeam, index) => {\n    const team = addTeam(state, locale() === 'zh' ? \`${'${index + 1}'}队\` : \`Team ${'${index + 1}'}\`);\n    if (!team) return;\n    team.memberIds = (Array.isArray(sourceTeam.playerIds) ? sourceTeam.playerIds : []).map(id => bySource.get(String(id))).filter(Boolean);\n  });\n  persist();\n  flash(tr('teamsAdopted'));\n}\n`,
  `function adoptRandomTeams() {\n  const game = readGameState();\n  const sourceTeams = Array.isArray(game?.tools?.teams) ? game.tools.teams : [];\n  if (!sourceTeams.length) { flash(tr('noRandomTeams')); return; }\n  const bySource = new Map(state.participants.filter(item => item.sourcePlayerId).map(item => [item.sourcePlayerId, item.id]));\n  const teams = sourceTeams.slice(0, MAX_TEAMS).map((sourceTeam, index) => ({\n    name: locale() === 'zh' ? \`${'${index + 1}'}队\` : \`Team ${'${index + 1}'}\`,\n    memberIds: (Array.isArray(sourceTeam.playerIds) ? sourceTeam.playerIds : []).map(id => bySource.get(String(id))).filter(Boolean)\n  }));\n  replaceTeams(state, teams);\n  persist();\n  flash(tr('teamsAdopted'));\n}\n`
);

writeFileSync('tests/unit/tabletop-team-replacement.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {\n  addParticipant, addStatus, addTeam, addTracker, createDefaultTableOsState, replaceTeams,\n  serializeTableOsState, setStatusValue, setTrackerValue, statusValue, trackerValue\n} from '../../src/tabletop-core.js';\n\ntest('replacing the whole team roster drops retired team live values and starts fresh defaults', () => {\n  const state = createDefaultTableOsState();\n  const alice = addParticipant(state, 'Alice');\n  const oldTeam = addTeam(state, 'Old team');\n  oldTeam.memberIds = [alice.id];\n  const score = addTracker(state, { name: 'Team score', scope: 'team', initial: 2, persistence: 'campaign' });\n  const ready = addStatus(state, { name: 'Ready', scope: 'team', initial: false });\n  setTrackerValue(state, score.id, oldTeam.id, 9);\n  setStatusValue(state, ready.id, oldTeam.id, true);\n\n  const [freshTeam] = replaceTeams(state, [{ name: 'Fresh team', memberIds: [alice.id, 'missing'] }]);\n\n  assert.notEqual(freshTeam.id, oldTeam.id, 'replacement creates a fresh team identity');\n  assert.deepEqual(freshTeam.memberIds, [alice.id], 'replacement keeps only valid participant membership');\n  assert.deepEqual(score.values, {}, 'retired team tracker overrides are cleared even for campaign trackers');\n  assert.deepEqual(ready.values, {}, 'retired team status overrides are cleared');\n  assert.equal(trackerValue(score, freshTeam.id), 2, 'new team receives tracker default');\n  assert.equal(statusValue(ready, freshTeam.id), false, 'new team receives status default');\n  assert.equal(serializeTableOsState(state).includes(oldTeam.id), false, 'retired team id is absent from persisted/exported state');\n});\n`);

replaceOnce(
  'tests/e2e/run-table-os-companion-e2e.js',
  `async function runTouchTargetSmoke() {\n`,
  `async function runTeamReplacementCleanupFlow() {\n  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });\n  const page = await context.newPage();\n  const errors = [];\n  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });\n  page.on('pageerror', error => errors.push(error.message));\n  page.on('dialog', dialog => dialog.accept());\n\n  await page.goto(url, { waitUntil: 'networkidle' });\n  await page.evaluate(() => localStorage.clear());\n  await page.reload({ waitUntil: 'networkidle' });\n  await page.locator('[data-action="start-session"]').click();\n\n  await page.evaluate(() => {\n    const gameKey = 'board-game-assistant-state-v2';\n    const tableKey = 'board-game-assistant-table-os-v1';\n    const game = JSON.parse(localStorage.getItem(gameKey));\n    if (!Array.isArray(game?.players) || game.players.length < 2) throw new Error('Expected at least two main-game players');\n    const players = game.players.slice(0, 2);\n    game.tools = game.tools && typeof game.tools === 'object' ? game.tools : {};\n    game.tools.teams = [{ playerIds: [players[0].id] }, { playerIds: [players[1].id] }];\n    localStorage.setItem(gameKey, JSON.stringify(game));\n    localStorage.setItem(tableKey, JSON.stringify({\n      schemaVersion: 3,\n      participants: players.map((player, index) => ({\n        id: \`tp_seed_${'${index + 1}'}\`,\n        sourcePlayerId: String(player.id),\n        name: player.name,\n        color: player.color\n      })),\n      teams: [{ id: 'old_team', name: 'Old Team', memberIds: ['tp_seed_1', 'tp_seed_2'] }],\n      trackers: [{\n        id: 'team_tracker', name: 'Team score', scope: 'team', initial: 2, value: 2, min: 0, max: 99, step: 1,\n        persistence: 'campaign', values: { old_team: 9 }\n      }],\n      statuses: [{ id: 'team_status', name: 'Ready', scope: 'team', initial: false, values: { old_team: true }],\n      ui: { mode: 'play', activeSection: 'overview' }\n    }));\n  });\n\n  await page.reload({ waitUntil: 'networkidle' });\n  await openTableOs(page);\n  await page.getByRole('button', { name: 'Edit setup', exact: true }).click();\n  await page.getByRole('button', { name: 'Teams & roles', exact: true }).click();\n  await page.getByRole('button', { name: 'Use toolbox teams', exact: true }).click();\n  await page.getByText('Latest toolbox teams adopted.', { exact: true }).waitFor({ state: 'visible' });\n\n  const replaced = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));\n  assert.equal(replaced.teams.length, 2);\n  assert.ok(replaced.teams.every(team => team.id !== 'old_team'), 'toolbox adoption creates fresh team identities');\n  assert.deepEqual(replaced.trackers.find(tracker => tracker.id === 'team_tracker')?.values, {}, 'old team tracker values are not retained');\n  assert.deepEqual(replaced.statuses.find(status => status.id === 'team_status')?.values, {}, 'old team status values are not retained');\n  assert.equal(JSON.stringify(replaced).includes('old_team'), false, 'retired team ids do not survive persistence');\n\n  await page.getByRole('button', { name: 'Statuses', exact: true }).click();\n  const readyButtons = page.locator('.tableos-module').filter({ hasText: 'Ready' }).locator('[data-os-status-toggle]');\n  assert.equal(await readyButtons.count(), 2);\n  for (let index = 0; index < 2; index += 1) assert.equal(await readyButtons.nth(index).getAttribute('aria-pressed'), 'false');\n\n  await page.getByRole('button', { name: 'Trackers', exact: true }).click();\n  const trackerValues = await page.locator('.tableos-module').filter({ hasText: 'Team score' }).locator('[data-os-tracker-value]').allInputValues();\n  assert.deepEqual(trackerValues, ['2', '2'], 'replacement teams start from tracker defaults');\n\n  assert.equal(errors.length, 0, \`Table OS team replacement console errors: ${'${errors.join(\' | \')}'}\`);\n  await context.close();\n}\n\nasync function runTouchTargetSmoke() {\n`
);

replaceOnce(
  'tests/e2e/run-table-os-companion-e2e.js',
  `  await runSessionLifecycleFlow();\n  await runTouchTargetSmoke();\n`,
  `  await runSessionLifecycleFlow();\n  await runTeamReplacementCleanupFlow();\n  await runTouchTargetSmoke();\n`
);

replaceOnce(
  'tests/e2e/run-table-os-companion-e2e.js',
  `      'safe rematch reset', 'campaign tracker persistence across rematch', 'transient state reset across rematch',\n      '44px live touch targets', '320px overflow'\n`,
  `      'safe rematch reset', 'campaign tracker persistence across rematch', 'transient state reset across rematch',\n      'toolbox re-team stale-value cleanup', 'fresh team defaults after replacement',\n      '44px live touch targets', '320px overflow'\n`
);

const matrixPath = 'docs/TABLE_OS_TEST_MATRIX.md';
const matrix = readFileSync(matrixPath, 'utf8');
if (!matrix.includes('### Team replacement cleanup')) {
  writeFileSync(matrixPath, `${matrix.trimEnd()}\n\n### Team replacement cleanup\n\n- Unit: replacing the whole team roster creates fresh team identities, keeps only valid participant membership, and clears retired team-scoped Tracker/Status overrides before persistence/export.\n- Chromium: adopting toolbox teams removes retired team IDs and hidden live values; replacement teams render the Tracker/Status defaults instead.\n`);
}
