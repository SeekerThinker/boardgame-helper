import { parseTableOsState } from './tabletop-core.js';

const IMPORT_INPUT_ID = 'tableos-import-file';
const BYPASS_DATA_KEY = 'osImportGuardBypass';
const MESSAGES = {
  zh: '导入会替换当前 Table OS 工作区，包括参与者、桌面实体、状态、追踪器、阶段、团队与身份、高级计分和战役记录。当前工作区不会自动备份，且无法撤销。继续吗？',
  en: 'Importing replaces the current Table OS workspace, including participants, table entities, statuses, trackers, phases, teams and roles, advanced scoring, and campaign records. The current workspace is not automatically backed up and this cannot be undone. Continue?'
};

function confirmMessage() {
  return document.documentElement.lang?.toLowerCase().startsWith('en') ? MESSAGES.en : MESSAGES.zh;
}

async function validateThenContinue(input, file) {
  let valid = false;
  try {
    parseTableOsState(await file.text());
    valid = true;
  } catch (_) {}

  // Ignore a stale async result if the user picked another file meanwhile.
  if (input.files?.[0] !== file) return;

  // Invalid files still flow through tabletop.js so the existing localized
  // import-failure toast remains the single error path. Only valid imports ask
  // for destructive-overwrite confirmation.
  if (valid && !confirm(confirmMessage())) {
    input.value = '';
    return;
  }

  input.dataset[BYPASS_DATA_KEY] = 'true';
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

document.addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== IMPORT_INPUT_ID) return;

  if (input.dataset[BYPASS_DATA_KEY] === 'true') {
    delete input.dataset[BYPASS_DATA_KEY];
    return;
  }

  event.stopImmediatePropagation();
  const file = input.files?.[0];
  if (!file) return;
  void validateThenContinue(input, file);
}, true);
