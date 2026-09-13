import fs from 'node:fs';
const path = 'src/tabletop.js';
let source = fs.readFileSync(path, 'utf8');
function replace(from, to) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`expected one match, found ${count}: ${from.slice(0, 70)}`);
  source = source.replace(from, to);
}

replace(
`  TABLE_OS_STORAGE_KEY, ASSISTANT_TEMPLATES, MAX_TABLE_OS_PARTICIPANTS, MAX_TRACKERS, MAX_PHASES,\n  MAX_TEAMS, MAX_SCORE_FIELDS, MAX_CAMPAIGN_FLAGS, MAX_USER_TEMPLATES, uid, createDefaultTableOsState, normalizeTableOsState,`,
`  TABLE_OS_STORAGE_KEY, ASSISTANT_TEMPLATES, MAX_TABLE_OS_PARTICIPANTS, MAX_TRACKERS, MAX_STATUSES, MAX_PHASES,\n  MAX_TEAMS, MAX_SCORE_FIELDS, MAX_CAMPAIGN_FLAGS, MAX_USER_TEMPLATES, uid, createDefaultTableOsState, normalizeTableOsState,`);
replace(
`  addTracker, removeTracker, trackerEntityIds, trackerValue, adjustTracker, setTrackerValue, setTrackerPersistence,\n  addPhase, removePhase, setActivePhase, advancePhase,`,
`  addTracker, removeTracker, trackerEntityIds, trackerValue, adjustTracker, setTrackerValue, setTrackerPersistence,\n  addStatus, removeStatus, statusEntityIds, statusValue, toggleStatus,\n  addPhase, removePhase, setActivePhase, advancePhase,`);
replace("const SECTION_IDS = ['overview', 'trackers', 'phases', 'teams', 'score', 'campaign'];", "const SECTION_IDS = ['overview', 'statuses', 'trackers', 'phases', 'teams', 'score', 'campaign'];");

replace("    overview: '总览', trackers: '追踪器', phases: '阶段', teams: '团队与身份', score: '计分表', campaign: '战役',", "    overview: '总览', statuses: '状态', trackers: '追踪器', phases: '阶段', teams: '团队与身份', score: '计分表', campaign: '战役',");
replace(
`    persistence: '保留到', sessionOnly: '本局', campaignPersist: '战役', noTrackers: '当前没有追踪器。',`,
`    persistence: '保留到', sessionOnly: '本局', campaignPersist: '战役', noTrackers: '当前没有追踪器。',\n    addStatus: '添加状态', noStatuses: '还没有状态开关。', statusHint: '状态是轻量开关；“新场景 / 下一局”会恢复到默认值。', defaultOn: '默认开启', customStatus: '新状态', on: '开启', off: '关闭',`);
replace(
`    confirmTemplate: '应用模板会重置追踪器、阶段、团队、身份和高级计分表，但保留参与者。继续吗？', confirmReset: '开始新场景会重置“本局”追踪器、身份和高级计分值，保留“战役”追踪器，并推进战役局数。继续吗？',`,
`    confirmTemplate: '应用模板会重置状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者。继续吗？', confirmReset: '开始新场景会把状态恢复到默认值，重置“本局”追踪器、身份和高级计分值，保留“战役”追踪器，并推进战役局数。继续吗？',`);
replace(
`    myTemplateHint: '只保存在本机，只保存追踪器、阶段、团队结构和计分公式；不保存玩家、身份、当前数值或战役内容。', myTemplateEmpty: '还没有我的模板', myTemplateDefault: '我的模板', customSetup: '自定义配置',`,
`    myTemplateHint: '只保存在本机，只保存状态定义、追踪器、阶段、团队结构和计分公式；不保存玩家、身份、当前状态/数值或战役内容。', myTemplateEmpty: '还没有我的模板', myTemplateDefault: '我的模板', customSetup: '自定义配置',`);
replace(
`    confirmMyTemplate: '应用我的模板会重置追踪器、阶段、团队、身份和高级计分表，但保留参与者与战役记忆。继续吗？', confirmDeleteMyTemplate: '删除这个本机模板吗？'`,
`    confirmMyTemplate: '应用我的模板会重置状态、追踪器、阶段、团队、身份和高级计分表，但保留参与者与战役记忆。继续吗？', confirmDeleteMyTemplate: '删除这个本机模板吗？'`);

replace("    overview: 'Overview', trackers: 'Trackers', phases: 'Phases', teams: 'Teams & roles', score: 'Score sheet', campaign: 'Campaign',", "    overview: 'Overview', statuses: 'Statuses', trackers: 'Trackers', phases: 'Phases', teams: 'Teams & roles', score: 'Score sheet', campaign: 'Campaign',");
replace(
`    persistence: 'Keep for', sessionOnly: 'Session', campaignPersist: 'Campaign', noTrackers: 'No trackers yet.',`,
`    persistence: 'Keep for', sessionOnly: 'Session', campaignPersist: 'Campaign', noTrackers: 'No trackers yet.',\n    addStatus: 'Add status', noStatuses: 'No status toggles yet.', statusHint: 'Statuses are lightweight toggles; New scenario / rematch restores their defaults.', defaultOn: 'Default on', customStatus: 'New status', on: 'On', off: 'Off',`);
replace(
`    confirmTemplate: 'Applying a template resets trackers, phases, teams, roles and the advanced score sheet while preserving participants. Continue?', confirmReset: 'Starting a new scenario resets session trackers, roles and advanced scores, preserves campaign trackers, and advances the campaign session. Continue?',`,
`    confirmTemplate: 'Applying a template resets statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants. Continue?', confirmReset: 'Starting a new scenario restores status defaults, resets session trackers, roles and advanced scores, preserves campaign trackers, and advances the campaign session. Continue?',`);
replace(
`    myTemplateHint: 'Stored only on this device. Saves tracker, phase, team structure and score formulas — never players, roles, live values or campaign content.', myTemplateEmpty: 'No saved templates yet', myTemplateDefault: 'My template', customSetup: 'Custom setup',`,
`    myTemplateHint: 'Stored only on this device. Saves status definitions, tracker, phase, team structure and score formulas — never players, roles, live status/value state or campaign content.', myTemplateEmpty: 'No saved templates yet', myTemplateDefault: 'My template', customSetup: 'Custom setup',`);
replace(
`    confirmMyTemplate: 'Applying My template resets trackers, phases, teams, roles and the advanced score sheet while preserving participants and campaign memory. Continue?', confirmDeleteMyTemplate: 'Delete this local template?'`,
`    confirmMyTemplate: 'Applying My template resets statuses, trackers, phases, teams, roles and the advanced score sheet while preserving participants and campaign memory. Continue?', confirmDeleteMyTemplate: 'Delete this local template?'`);

replace('  return Boolean(state.trackers.length || state.phases.items.length || state.teams.length || state.roles.length || state.scoreSheet.fields.length || state.campaign.enabled || state.campaign.flags.length);', '  return Boolean(state.statuses.length || state.trackers.length || state.phases.items.length || state.teams.length || state.roles.length || state.scoreSheet.fields.length || state.campaign.enabled || state.campaign.flags.length);');
replace("  const ids = ['overview'];\n  if (state.trackers.length) ids.push('trackers');", "  const ids = ['overview'];\n  if (state.statuses.length) ids.push('statuses');\n  if (state.trackers.length) ids.push('trackers');");
replace("function renderSection() {\n  if (state.ui.activeSection === 'trackers') return renderTrackers();", "function renderSection() {\n  if (state.ui.activeSection === 'statuses') return renderStatuses();\n  if (state.ui.activeSection === 'trackers') return renderTrackers();");

fs.writeFileSync(path, source);
console.log('status UI part 1 staged');
