import fs from 'node:fs';
const path = 'src/tabletop-core.js';
let source = fs.readFileSync(path, 'utf8');
function replace(from, to) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`expected one match, found ${count}: ${from.slice(0, 70)}`);
  source = source.replace(from, to);
}

replace(
`  state.trackers.forEach(tracker => {\n    if (tracker.scope !== 'participant') return;\n    Object.keys(tracker.values || {}).forEach(id => { if (!valid.has(id)) delete tracker.values[id]; });\n  });\n}`,
`  state.trackers.forEach(tracker => {\n    if (tracker.scope !== 'participant') return;\n    Object.keys(tracker.values || {}).forEach(id => { if (!valid.has(id)) delete tracker.values[id]; });\n  });\n  state.statuses.forEach(status => {\n    if (status.scope !== 'participant') return;\n    Object.keys(status.values || {}).forEach(id => { if (!valid.has(id)) delete status.values[id]; });\n  });\n}`);

replace('export function addPhase(state, name = \'\') {', `export function addStatus(state, { name = 'Status', scope = 'global', initial = false } = {}) {\n  if (state.statuses.length >= MAX_STATUSES) return null;\n  const status = statusFromTemplate({ name, scope, initial, values: {} }, state.statuses.length);\n  state.statuses.push(status);\n  touch(state);\n  return status;\n}\n\nexport function removeStatus(state, statusId) {\n  const index = state.statuses.findIndex(status => status.id === statusId);\n  if (index < 0) return false;\n  state.statuses.splice(index, 1);\n  touch(state);\n  return true;\n}\n\nexport function statusEntityIds(state, status) {\n  if (!status) return [];\n  if (status.scope === 'participant') return state.participants.map(participant => participant.id);\n  if (status.scope === 'team') return state.teams.map(team => team.id);\n  return ['global'];\n}\n\nexport function statusValue(status, entityId = 'global') {\n  if (!status) return false;\n  return Object.prototype.hasOwnProperty.call(status.values || {}, entityId) ? Boolean(status.values[entityId]) : Boolean(status.initial);\n}\n\nexport function setStatusValue(state, statusId, entityId, value) {\n  const status = state.statuses.find(item => item.id === statusId);\n  if (!status) return false;\n  const target = status.scope === 'global' ? 'global' : entityId;\n  if (!new Set(statusEntityIds(state, status)).has(target)) return false;\n  status.values[target] = Boolean(value);\n  touch(state);\n  return true;\n}\n\nexport function toggleStatus(state, statusId, entityId = 'global') {\n  const status = state.statuses.find(item => item.id === statusId);\n  if (!status) return false;\n  const target = status.scope === 'global' ? 'global' : entityId;\n  return setStatusValue(state, statusId, target, !statusValue(status, target));\n}\n\nexport function addPhase(state, name = '') {`);

replace(
`  state.trackers.forEach(tracker => { if (tracker.scope === 'team') delete tracker.values?.[teamId]; });\n  touch(state);`,
`  state.trackers.forEach(tracker => { if (tracker.scope === 'team') delete tracker.values?.[teamId]; });\n  state.statuses.forEach(status => { if (status.scope === 'team') delete status.values?.[teamId]; });\n  touch(state);`);

replace(
`  const trackerSource = Array.isArray(source.trackers) ? source.trackers : [];\n  const phaseSource = Array.isArray(source.phases) ? source.phases : Array.isArray(source.phases?.items) ? source.phases.items : [];`,
`  const trackerSource = Array.isArray(source.trackers) ? source.trackers : [];\n  const statusSource = Array.isArray(source.statuses) ? source.statuses : [];\n  const phaseSource = Array.isArray(source.phases) ? source.phases : Array.isArray(source.phases?.items) ? source.phases.items : [];`);
replace(
`    phases: phaseSource.slice(0, MAX_PHASES).map((phase, index) => ({`,
`    statuses: statusSource.slice(0, MAX_STATUSES).map((status, index) => {\n      const normalized = statusFromTemplate({ ...status, values: {} }, index);\n      return { name: normalized.name, scope: normalized.scope, initial: normalized.initial };\n    }),\n    phases: phaseSource.slice(0, MAX_PHASES).map((phase, index) => ({`);
replace('    trackers: state.trackers,\n    phases: state.phases.items,', '    trackers: state.trackers,\n    statuses: state.statuses,\n    phases: state.phases.items,');
replace('  state.trackers = [];\n  state.phases = { items: [], activeIndex: 0, cycle: 1 };', '  state.trackers = [];\n  state.statuses = [];\n  state.phases = { items: [], activeIndex: 0, cycle: 1 };');
replace(
`  state.phases.items = template.phases.map(phase => ({ id: uid('phase_'), name: phase.name, note: phase.note }));\n  state.trackers = template.trackers.map((tracker, index) => trackerFromTemplate({`,
`  state.phases.items = template.phases.map(phase => ({ id: uid('phase_'), name: phase.name, note: phase.note }));\n  state.statuses = template.statuses.map((status, index) => statusFromTemplate({ ...status, values: {} }, index));\n  state.trackers = template.trackers.map((tracker, index) => trackerFromTemplate({`);
replace(
`  state.trackers = template.trackers.slice(0, MAX_TRACKERS).map((tracker, index) => trackerFromTemplate({\n    ...tracker,\n    name: translated?.trackers?.[index] || tracker.name\n  }, index));\n  const usedKeys = new Set();`,
`  state.trackers = template.trackers.slice(0, MAX_TRACKERS).map((tracker, index) => trackerFromTemplate({\n    ...tracker,\n    name: translated?.trackers?.[index] || tracker.name\n  }, index));\n  state.statuses = (template.statuses || []).slice(0, MAX_STATUSES).map((status, index) => statusFromTemplate({\n    ...status,\n    name: translated?.statuses?.[index] || status.name,\n    values: {}\n  }, index));\n  const usedKeys = new Set();`);
replace(
`  state.phases.activeIndex = 0;\n  state.phases.cycle = 1;\n  state.roles = [];`,
`  state.statuses.forEach(status => { status.values = {}; });\n  state.phases.activeIndex = 0;\n  state.phases.cycle = 1;\n  state.roles = [];`);

fs.writeFileSync(path, source);
console.log('status core part 2 staged');
