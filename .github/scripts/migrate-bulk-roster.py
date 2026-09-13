from pathlib import Path


def replace_once(path, before, after):
    p = Path(path)
    source = p.read_text()
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement target, found {count}")
    p.write_text(source.replace(before, after, 1))

core = 'src/tabletop-core.js'
replace_once(core, '''export function addParticipant(state, name = '') {
  if (state.participants.length >= MAX_TABLE_OS_PARTICIPANTS) return null;
  const participant = participantTemplate(name || `Player ${state.participants.length + 1}`, state.participants.length);
  state.participants.push(participant);
  touch(state);
  return participant;
}
''', '''export function addParticipant(state, name = '') {
  if (state.participants.length >= MAX_TABLE_OS_PARTICIPANTS) return null;
  const participant = participantTemplate(name || `Player ${state.participants.length + 1}`, state.participants.length);
  state.participants.push(participant);
  touch(state);
  return participant;
}

export function addParticipantsFromText(state, input = '') {
  const names = String(input ?? '')
    .split(/[\\r\\n,，;；\\t]+/)
    .map(item => text(item, 32))
    .filter(Boolean);
  const available = Math.max(0, MAX_TABLE_OS_PARTICIPANTS - state.participants.length);
  const accepted = names.slice(0, available);
  const start = state.participants.length;
  accepted.forEach((name, index) => {
    state.participants.push(participantTemplate(name, start + index));
  });
  if (accepted.length) touch(state);
  return { requested: names.length, added: accepted.length, limitReached: names.length > accepted.length };
}
''')

ui = 'src/tabletop.js'
replace_once(ui,
'''  syncParticipantsFromGame, addParticipant, renameParticipant, removeParticipant,''',
'''  syncParticipantsFromGame, addParticipant, addParticipantsFromText, renameParticipant, removeParticipant,''')
replace_once(ui,
'''    participants: '参与者', addParticipant: '添加参与者', sourceGame: '当前对局', localOnly: '扩展参与者', remove: '删除',''',
'''    participants: '参与者', addParticipant: '添加参与者', bulkParticipants: '批量添加名单', bulkParticipantsHelp: '每行一位，也支持逗号、分号或制表符；只追加到 Table OS，不改动主应用玩家。', bulkParticipantsPlaceholder: '阿青\\n小林\\nMia', bulkAddParticipants: '添加名单', bulkAdded: '已批量添加参与者：', bulkNoNames: '没有可添加的名字。', sourceGame: '当前对局', localOnly: '扩展参与者', remove: '删除',''')
replace_once(ui,
'''    participants: 'Participants', addParticipant: 'Add participant', sourceGame: 'Game roster', localOnly: 'Assistant-only', remove: 'Remove',''',
'''    participants: 'Participants', addParticipant: 'Add participant', bulkParticipants: 'Paste roster', bulkParticipantsHelp: 'One name per line; commas, semicolons and tabs also work. This only appends Table OS participants and never changes the main game roster.', bulkParticipantsPlaceholder: 'Ada\\nLin\\nMia', bulkAddParticipants: 'Add roster', bulkAdded: 'Participants added:', bulkNoNames: 'No names to add.', sourceGame: 'Game roster', localOnly: 'Assistant-only', remove: 'Remove',''')
replace_once(ui,
'''      <div class="tableos-card-head"><div><span>${esc(tr('participants'))}</span><h3>${state.participants.length} / ${MAX_TABLE_OS_PARTICIPANTS}</h3></div>${state.ui.mode === 'edit' ? `<button class="tableos-btn" type="button" data-os-action="add-participant">${esc(tr('addParticipant'))}</button>` : ''}</div>
      ${state.participants.length ? `<div class="tableos-participants">${state.participants.map(participant => state.ui.mode === 'edit' ? `''',
'''      <div class="tableos-card-head"><div><span>${esc(tr('participants'))}</span><h3>${state.participants.length} / ${MAX_TABLE_OS_PARTICIPANTS}</h3></div>${state.ui.mode === 'edit' ? `<button class="tableos-btn" type="button" data-os-action="add-participant">${esc(tr('addParticipant'))}</button>` : ''}</div>
      ${state.ui.mode === 'edit' ? `<details class="tableos-module"><summary><strong>${esc(tr('bulkParticipants'))}</strong></summary><p class="tableos-help">${esc(tr('bulkParticipantsHelp'))}</p><textarea rows="5" maxlength="1600" data-os-bulk-participants aria-label="${attr(tr('bulkParticipants'))}" placeholder="${attr(tr('bulkParticipantsPlaceholder'))}"></textarea><div class="tableos-inline-actions"><button class="tableos-btn primary" type="button" data-os-action="bulk-add-participants">${esc(tr('bulkAddParticipants'))}</button></div></details>` : ''}
      ${state.participants.length ? `<div class="tableos-participants">${state.participants.map(participant => state.ui.mode === 'edit' ? `''')
replace_once(ui,
'''    if (d.osAction === 'add-participant') { if (!addParticipant(state, tr('customParticipant'))) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osRemoveParticipant) { removeParticipant(state, d.osRemoveParticipant); persist(); render(); return; }''',
'''    if (d.osAction === 'add-participant') { if (!addParticipant(state, tr('customParticipant'))) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osAction === 'bulk-add-participants') {
      const input = document.querySelector('[data-os-bulk-participants]');
      const result = addParticipantsFromText(state, input instanceof HTMLTextAreaElement ? input.value : '');
      if (!result.requested) { flash(tr('bulkNoNames')); return; }
      persist();
      if (!result.added) { flash(tr('limit')); return; }
      flash(`${tr('bulkAdded')} ${result.added}${result.limitReached ? ` · ${tr('limit')}` : ''}`);
      return;
    }
    if (d.osRemoveParticipant) { removeParticipant(state, d.osRemoveParticipant); persist(); render(); return; }''')

e2e = 'tests/e2e/run-table-os-e2e.js'
replace_once(e2e,
'''  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'main game roster is synchronized on first open');
  assert.ok(await page.locator('[data-os-template]').isVisible());''',
'''  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'main game roster is synchronized on first open');
  assert.ok(await page.locator('[data-os-template]').isVisible());

  // Large-table setup: paste a mixed-separator roster once instead of adding assistant-only players one by one.
  await page.getByText('批量添加名单', { exact: true }).click();
  const bulkRoster = page.locator('[data-os-bulk-participants]');
  await bulkRoster.fill('阿青\\n小林, Mia；Noah\\tEva');
  await page.getByRole('button', { name: '添加名单' }).click();
  assert.equal(await page.locator('[data-os-participant-name]').count(), 9, 'bulk roster appends all parsed participants');
  const bulkSnapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('board-game-assistant-table-os-v1')));
  assert.deepEqual(bulkSnapshot.participants.slice(-5).map(item => item.name), ['阿青', '小林', 'Mia', 'Noah', 'Eva']);
  assert.equal(bulkSnapshot.participants.slice(-5).every(item => item.sourcePlayerId === null), true, 'bulk roster creates assistant-only participants');
  assert.equal(JSON.parse(localStorage.getItem('board-game-assistant-state-v2')).players.length, 4, 'bulk roster never mutates the main game roster');
  for (let index = 0; index < 5; index += 1) await page.locator('[data-os-remove-participant]').last().click();
  assert.equal(await page.locator('[data-os-participant-name]').count(), 4, 'test cleanup returns to the synchronized four-player roster');''')

Path('tests/unit/tabletop-bulk-roster.test.js').write_text('''import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TABLE_OS_PARTICIPANTS,
  createDefaultTableOsState,
  syncParticipantsFromGame,
  addParticipantsFromText
} from '../../src/tabletop-core.js';

test('bulk roster parses common paste separators without touching the source game roster', () => {
  const state = createDefaultTableOsState();
  syncParticipantsFromGame(state, [
    { id: 'p1', name: 'Host', color: '#f97316' },
    { id: 'p2', name: 'Guest', color: '#14b8a6' }
  ]);
  const sourceIds = state.participants.map(item => item.sourcePlayerId);
  const result = addParticipantsFromText(state, '阿青\\n小林, Mia；Noah\\tEva');
  assert.deepEqual(result, { requested: 5, added: 5, limitReached: false });
  assert.deepEqual(state.participants.slice(-5).map(item => item.name), ['阿青', '小林', 'Mia', 'Noah', 'Eva']);
  assert.equal(state.participants.slice(-5).every(item => item.sourcePlayerId === null), true);
  assert.deepEqual(state.participants.slice(0, 2).map(item => item.sourcePlayerId), sourceIds);
});

test('bulk roster ignores blank tokens, trims names and stops safely at the participant limit', () => {
  const state = createDefaultTableOsState();
  const first = addParticipantsFromText(state, '  Ada  \\n\\nLin；  Mia  ');
  assert.deepEqual(first, { requested: 3, added: 3, limitReached: false });
  assert.deepEqual(state.participants.map(item => item.name), ['Ada', 'Lin', 'Mia']);

  const many = Array.from({ length: 40 }, (_, index) => `Player ${index + 1}`).join('\\n');
  const second = addParticipantsFromText(state, many);
  assert.equal(second.requested, 40);
  assert.equal(second.added, MAX_TABLE_OS_PARTICIPANTS - 3);
  assert.equal(second.limitReached, true);
  assert.equal(state.participants.length, MAX_TABLE_OS_PARTICIPANTS);

  const full = addParticipantsFromText(state, 'One more');
  assert.deepEqual(full, { requested: 1, added: 0, limitReached: true });
});

test('bulk roster empty input is a no-op', () => {
  const state = createDefaultTableOsState();
  const before = state.updatedAt;
  const result = addParticipantsFromText(state, '  \\n，；\\t  ');
  assert.deepEqual(result, { requested: 0, added: 0, limitReached: false });
  assert.equal(state.participants.length, 0);
  assert.equal(state.updatedAt, before);
});
''')

docs = 'TABLE_OS.md'
replace_once(docs, '- 玩家同步 / 扩展参与者', '- 玩家同步 / 单个或批量扩展参与者')
replace_once(docs,
'- 可从主应用同步当前玩家，也可额外添加只属于高级助手的参与者。',
'- 可从主应用同步当前玩家，也可额外添加只属于高级助手的参与者。编辑模式支持直接粘贴多人名单（换行、逗号、分号或制表符分隔），一次追加到 32 人上限，不会改动主应用玩家。')
replace_once(docs,
'  - 编辑模式与主对局玩家同步',
'  - 编辑模式与主对局玩家同步、批量名单粘贴')

matrix = 'docs/TABLE_OS_TEST_MATRIX.md'
replace_once(matrix,
'| Node unit tests | roster sync, participant bounds, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |',
'| Node unit tests | roster sync, participant bounds, bulk roster parsing/cap safety, built-in templates, privacy-safe My Templates snapshots/apply, template-safe campaign persistence, tracker scopes/clamps, session-vs-campaign tracker persistence, phase cycles, team/role reference cleanup, safe formula parsing, score calculations, campaign persistence, serialization/normalization |')
replace_once(matrix,
'| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |',
'| Table OS Chromium E2E | default Play mode, purpose-first quick start, Edit mode, roster sync, bulk roster paste without main-roster mutation, universal trackers, phase engine, toolbox-team bridge, two-stage private role reveal, moderator-note isolation, formula score sheet, campaign tracker lifetime, campaign reload persistence, campaign survival across built-in/My Template changes, local My Templates save/rename/apply/delete with transient/private-data exclusion, dynamic bilingual UI |')
with Path(matrix).open('a') as fh:
    fh.write('''\n### Large-table roster setup\n\n- Unit: mixed newline/comma/semicolon/tab paste parsing, blank-token trimming, assistant-only identity, and safe truncation at 32 participants.\n- Chromium: Edit setup can paste several participants in one action, persists them locally as assistant-only participants, and leaves the main game roster unchanged.\n''')

print('bulk roster migration applied')
