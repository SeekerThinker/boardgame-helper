const ARCHIVE_DELETE_SELECTOR = '[data-archive-delete]';
const BYPASS_DATA_KEY = 'archiveDeleteGuardBypass';
const MESSAGES = {
  zh: '删除这条历史对局记录？删除后无法恢复。',
  en: 'Delete this archived game? This cannot be undone.'
};

function confirmMessage() {
  return document.documentElement.lang?.toLowerCase().startsWith('en') ? MESSAGES.en : MESSAGES.zh;
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest(ARCHIVE_DELETE_SELECTOR) : null;
  if (!(target instanceof HTMLButtonElement)) return;

  if (target.dataset[BYPASS_DATA_KEY] === 'true') {
    delete target.dataset[BYPASS_DATA_KEY];
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  if (!confirm(confirmMessage())) return;

  target.dataset[BYPASS_DATA_KEY] = 'true';
  target.click();
}, true);
