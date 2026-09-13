import fs from 'node:fs';

function replaceOne(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  fs.writeFileSync(path, source.replace(from, to));
}
function appendOnce(path, marker, content) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes(marker)) return;
  fs.writeFileSync(path, `${source.trimEnd()}\n\n${content.trim()}\n`);
}

replaceOne('package.json',
`    "test:e2e": "node tests/e2e/run-e2e.js && node tests/e2e/run-table-os-e2e.js && node tests/e2e/run-table-os-companion-e2e.js && node tests/e2e/run-table-os-archive-e2e.js",`,
`    "test:e2e": "node tests/e2e/run-e2e.js && node tests/e2e/run-table-os-e2e.js && node tests/e2e/run-table-os-status-e2e.js && node tests/e2e/run-table-os-companion-e2e.js && node tests/e2e/run-table-os-archive-e2e.js",`);

appendOnce('TABLE_OS.md', '## Lightweight status toggles', `
## Lightweight status toggles

Table OS has a dedicated **Statuses / 状态** surface for boolean table state that should not be modeled as a numeric tracker. A status can be shared globally, repeated per participant, or repeated per team. Each definition has a default on/off value; **New scenario / rematch** clears live overrides and restores that default.

Examples include Alive, Poisoned, Stunned, Ready, and Objective complete. Card Battle starts with Poisoned/Stunned toggles, while Hidden Roles starts with Alive enabled for each participant.

Statuses are session state. **My Templates** save only the reusable status definition (name, scope, default), never current on/off values. Campaign-persistent information should continue to use campaign trackers, checkpoints, or notes rather than status toggles.
`);

appendOnce('docs/TABLE_OS_TEST_MATRIX.md', '### Status toggle lifecycle', `
### Status toggle lifecycle

- Unit: normalization from older schema, entity validation/pruning, shelf limit, default restoration on new scenario, localized built-in statuses.
- Unit: My Templates preserve status definitions but exclude live values and participant identifiers.
- Chromium: Card Battle Poisoned/Stunned toggles, Hidden Roles Alive default, new-scenario reset, custom global status, template privacy/fresh apply, and same-session reload persistence.
`);

console.log('status metadata staged');
