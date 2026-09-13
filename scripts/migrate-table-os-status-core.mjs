import fs from 'node:fs';

const path = 'src/tabletop-core.js';
let source = fs.readFileSync(path, 'utf8');
function replace(from, to) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`expected one match, found ${count}: ${from.slice(0, 70)}`);
  source = source.replace(from, to);
}

replace('export const TABLE_OS_SCHEMA_VERSION = 2;', 'export const TABLE_OS_SCHEMA_VERSION = 3;');
replace('export const MAX_TRACKERS = 24;\nexport const MAX_PHASES = 20;', 'export const MAX_TRACKERS = 24;\nexport const MAX_STATUSES = 24;\nexport const MAX_PHASES = 20;');
replace('export const USER_TEMPLATE_VERSION = 1;', 'export const USER_TEMPLATE_VERSION = 2;');

replace(
`    trackers: [\n      { name: '存活人数', scope: 'team', value: 0, min: 0, max: 32, step: 1 }\n    ],\n    scoreFields: [`,
`    trackers: [\n      { name: '存活人数', scope: 'team', value: 0, min: 0, max: 32, step: 1 }\n    ],\n    statuses: [\n      { name: '存活', scope: 'participant', initial: true }\n    ],\n    scoreFields: [`);
replace(
`    trackers: [\n      { name: '生命', scope: 'participant', value: 20, min: 0, max: 999, step: 1 },\n      { name: '资源', scope: 'participant', value: 0, min: 0, max: 999, step: 1 },\n      { name: '状态', scope: 'participant', value: 0, min: 0, max: 99, step: 1 }\n    ],\n    scoreFields: [`,
`    trackers: [\n      { name: '生命', scope: 'participant', value: 20, min: 0, max: 999, step: 1 },\n      { name: '资源', scope: 'participant', value: 0, min: 0, max: 999, step: 1 }\n    ],\n    statuses: [\n      { name: '中毒', scope: 'participant', initial: false },\n      { name: '眩晕', scope: 'participant', initial: false }\n    ],\n    scoreFields: [`);
replace(
`  'hidden-role': {\n    phases: ['Setup', 'Open discussion', 'Private phase', 'Vote / Resolution', 'Resolve'],\n    trackers: ['Alive count'],\n    scoreFields: ['Wins']\n  },`,
`  'hidden-role': {\n    phases: ['Setup', 'Open discussion', 'Private phase', 'Vote / Resolution', 'Resolve'],\n    trackers: ['Alive count'],\n    statuses: ['Alive'],\n    scoreFields: ['Wins']\n  },`);
replace(
`  'card-battle': {\n    phases: ['Setup', 'Main phase', 'Combat', 'End'],\n    trackers: ['Health', 'Resources', 'Status'],\n    scoreFields: ['Wins']\n  },`,
`  'card-battle': {\n    phases: ['Setup', 'Main phase', 'Combat', 'End'],\n    trackers: ['Health', 'Resources'],\n    statuses: ['Poisoned', 'Stunned'],\n    scoreFields: ['Wins']\n  },`);

replace('function scoreFieldFromTemplate(input, index = 0, usedKeys = null) {', `function statusFromTemplate(input, index = 0) {\n  const status = input && typeof input === 'object' ? input : {};\n  const scope = ['global', 'participant', 'team'].includes(status.scope) ? status.scope : 'global';\n  return { id: identifier(status.id, 'status_'), name: text(status.name || \`Status \${index + 1}\`, 32), scope, initial: Boolean(status.initial), values: status.values && typeof status.values === 'object' ? { ...status.values } : {} };\n}\n\nfunction scoreFieldFromTemplate(input, index = 0, usedKeys = null) {`);
replace('function normalizePhases(value) {', `function normalizeStatuses(value) {\n  if (!Array.isArray(value)) return [];\n  const used = new Set();\n  return value.slice(0, MAX_STATUSES).map((status, index) => {\n    const normalized = statusFromTemplate(status, index);\n    while (used.has(normalized.id)) normalized.id = uid('status_');\n    used.add(normalized.id);\n    const values = {};\n    Object.entries(normalized.values || {}).forEach(([entityId, raw]) => { values[identifier(entityId, 'entity_')] = Boolean(raw); });\n    normalized.values = values;\n    return normalized;\n  });\n}\n\nfunction normalizePhases(value) {`);
replace('    trackers: [],\n    phases: { items: [], activeIndex: 0, cycle: 1 },', '    trackers: [],\n    statuses: [],\n    phases: { items: [], activeIndex: 0, cycle: 1 },');
replace('    trackers: normalizeTrackers(input.trackers),\n    phases: normalizePhases(input.phases),', '    trackers: normalizeTrackers(input.trackers),\n    statuses: normalizeStatuses(input.statuses),\n    phases: normalizePhases(input.phases),');
replace("      activeSection: ['overview', 'trackers', 'phases', 'teams', 'score', 'campaign'].includes(input.ui?.activeSection)", "      activeSection: ['overview', 'statuses', 'trackers', 'phases', 'teams', 'score', 'campaign'].includes(input.ui?.activeSection)");

fs.writeFileSync(path, source);
console.log('status core part 1 staged');
