// Enhance the reviewed catalog's existing exact-player filter, without duplicating its
// filtering or publishing logic. This never reads candidate drafts or stores user data.
const LABELS = {
  zh: { heading: '有几个人一起玩？', help: '直接点人数，或使用下方选择框填写其他人数。', any: '不限' },
  en: { heading: 'How many people are playing?', help: 'Tap a number, or use the selector below for other group sizes.', any: 'Any' }
};
const COUNTS = ['', '2', '3', '4', '5', '6', '8', '10'];
const language = () => document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'zh';

function sync(root) {
  const value = root.querySelector('[data-game-players]')?.value ?? '';
  root.querySelectorAll('[data-library-player-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.libraryPlayerChoice === value));
  });
}

function decorate() {
  const root = document.getElementById('game-library-root');
  const filters = root?.querySelector('.game-library-filters');
  const select = filters?.querySelector('[data-game-players]');
  if (!select || root.querySelector('[data-library-player-choices]')) return;
  const text = LABELS[language()];
  const section = document.createElement('section');
  section.className = 'library-player-choices';
  section.dataset.libraryPlayerChoices = '';
  const title = document.createElement('h3');
  title.textContent = text.heading;
  const hint = document.createElement('p');
  hint.textContent = text.help;
  const choices = document.createElement('div');
  choices.className = 'library-player-choice-grid';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', text.heading);
  for (const value of COUNTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.libraryPlayerChoice = value;
    button.textContent = value || text.any;
    button.setAttribute('aria-pressed', 'false');
    choices.append(button);
  }
  section.append(title, hint, choices);
  filters.before(section);
  sync(root);
}

function init() {
  const root = document.getElementById('game-library-root');
  if (!root) return;
  // Library redraws its dialog on open, reset, detail/back and locale changes.
  new MutationObserver(decorate).observe(root, { childList: true, subtree: true });
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-library-player-choice]') : null;
    if (!button) return;
    const select = root.querySelector('[data-game-players]');
    if (!select) return;
    select.value = button.dataset.libraryPlayerChoice;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    sync(root);
  });
  root.addEventListener('change', event => {
    if (event.target?.matches('[data-game-players]')) sync(root);
  });
  decorate();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
