import fs from 'node:fs';
const path = 'src/tabletop.js';
let source = fs.readFileSync(path, 'utf8');
function replace(from, to) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`expected one match, found ${count}: ${from.slice(0, 70)}`);
  source = source.replace(from, to);
}
replace(
`    const target = event.target instanceof Element ? event.target.closest('[data-os-action],[data-os-mode],[data-os-section],[data-os-quick-template],[data-os-remove-participant],[data-os-tracker-delta],[data-os-remove-tracker],[data-os-phase-active],[data-os-remove-phase],[data-os-remove-team],[data-os-role-reveal],[data-os-role-clear],[data-os-remove-score],[data-os-flag-toggle],[data-os-flag-remove]') : null;`,
`    const target = event.target instanceof Element ? event.target.closest('[data-os-action],[data-os-mode],[data-os-section],[data-os-quick-template],[data-os-remove-participant],[data-os-status-toggle],[data-os-remove-status],[data-os-tracker-delta],[data-os-remove-tracker],[data-os-phase-active],[data-os-remove-phase],[data-os-remove-team],[data-os-role-reveal],[data-os-role-clear],[data-os-remove-score],[data-os-flag-toggle],[data-os-flag-remove]') : null;`);
replace(
`    if (d.osAction === 'add-tracker') { if (!addTracker(state, { name: tr('customTracker') })) flash(tr('limit')); else { persist(); render(); } return; }`,
`    if (d.osAction === 'add-status') { if (!addStatus(state, { name: tr('customStatus') })) flash(tr('limit')); else { persist(); render(); } return; }\n    if (d.osRemoveStatus) { removeStatus(state, d.osRemoveStatus); persist(); render(); return; }\n    if (d.osStatusToggle) { const [statusId, entityId] = d.osStatusToggle.split('|'); toggleStatus(state, statusId, entityId); persist(); render(); return; }\n    if (d.osAction === 'add-tracker') { if (!addTracker(state, { name: tr('customTracker') })) flash(tr('limit')); else { persist(); render(); } return; }`);
replace(
`    if (d.osTrackerName) { mutateTracker(d.osTrackerName, { name: element.value.trim().slice(0, 32) || tr('customTracker') }); saveAndRender(); return; }`,
`    if (d.osStatusName) { const status = state.statuses.find(item => item.id === d.osStatusName); if (status) status.name = element.value.trim().slice(0, 32) || tr('customStatus'); saveAndRender(); return; }\n    if (d.osStatusScope) { const status = state.statuses.find(item => item.id === d.osStatusScope); if (status) { status.scope = ['global', 'participant', 'team'].includes(element.value) ? element.value : 'global'; status.values = {}; } saveAndRender(); return; }\n    if (d.osStatusInitial !== undefined) { const status = state.statuses.find(item => item.id === d.osStatusInitial); if (status) { status.initial = element instanceof HTMLInputElement ? element.checked : false; status.values = {}; } saveAndRender(); return; }\n    if (d.osTrackerName) { mutateTracker(d.osTrackerName, { name: element.value.trim().slice(0, 32) || tr('customTracker') }); saveAndRender(); return; }`);
fs.writeFileSync(path, source);
console.log('status events staged');
