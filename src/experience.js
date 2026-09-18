import { buildReadyDeal, READY_DEAL_MODES } from './ready-deal-core.js';

const TEXT = {
  zh: {
    brand: '桌游助手 · 线下聚会', intro: '选择游戏、主持一局，或直接打开计时计分工具。',
    library: '选游戏', libraryHelp: '按人数、材料和场景挑选', table: '桌面 OS', tableHelp: '主持、阶段、角色和战役', tools: '工具箱', toolsHelp: '计时、计分和随机',
    quick: '快捷主持工具', quickHelp: '选一种通用发牌方式即可开始；不必手动录入整副牌。',
    readyTitle: '快速发牌 · 无需输入', mode: '选择分配方式', count: '玩家人数',
    word: '不同词语', groups: '随机分成两组', special: '一位特殊成员',
    ready: '自动生成并发牌', custom: '也可以在下方自行填写名单、角色、词语与主持提示。',
    disclaimer: '这些是通用分配示例，不是任何具名游戏的官方角色牌、词库或完整规则。',
    minimum: '不同词语至少需要 3 位玩家。', secure: '安全随机功能不可用，无法开始发牌。',
    pick: '按所需材料选择', search: '按名称搜索（可选）', everyone: '不限', noProps: '零道具', everyday: '随手可得', diy: '自己制作', printable: '可打印',
    libraryHint: '先选择材料，再按人数缩小范围。只有完成审核与试玩的具体游戏才会显示。'
  },
  en: {
    brand: 'Board Game Assistant · In-person play', intro: 'Choose a game, host a session or open the timing and scoring tools.',
    library: 'Choose a game', libraryHelp: 'Pick by players and materials', table: 'Table OS', tableHelp: 'Roles, phases and campaigns', tools: 'Toolbox', toolsHelp: 'Timers, scores and random tools',
    quick: 'Quick host tools', quickHelp: 'Choose a generic deal and start without typing an entire deck.',
    readyTitle: 'Ready-made private deal', mode: 'Distribution', count: 'Players',
    word: 'Different words', groups: 'Two random groups', special: 'One special member',
    ready: 'Generate and deal', custom: 'Or use the custom players, cards and host prompts below.',
    disclaimer: 'These are generic distributions, not official game-specific roles, word lists or complete rules.',
    minimum: 'Different words needs at least three players.', secure: 'Secure random dealing is unavailable.',
    pick: 'Choose by materials', search: 'Search by title (optional)', everyone: 'Any', noProps: 'No equipment', everyday: 'Everyday items', diy: 'DIY', printable: 'Printable',
    libraryHint: 'Choose materials, then narrow by player count. Only reviewed and playtested games appear.'
  }
};
const isEnglish = () => document.documentElement.lang?.toLowerCase().startsWith('en');
const t = key => TEXT[isEnglish() ? 'en' : 'zh'][key];

function mountPrimaryNavigation() {
  const app = document.getElementById('app');
  const library = document.getElementById('game-library-launcher');
  const table = document.getElementById('tableos-launcher');
  const dealer = document.getElementById('secret-dealer-launcher');
  if (!app || !library || !table || !dealer || document.getElementById('primary-navigation')) return;
  const header = document.createElement('header');
  header.id = 'primary-navigation';
  header.innerHTML = '<div class="primary-navigation-heading"><p data-primary-brand></p><p data-primary-intro></p></div><nav aria-label="Main sections"></nav>';
  const nav = header.querySelector('nav');
  const toolbox = document.createElement('button');
  toolbox.type = 'button';
  toolbox.id = 'primary-toolbox';
  const quick = document.createElement('section');
  quick.id = 'quick-host-tools';
  quick.innerHTML = '<div><h2 data-quick-title></h2><p data-quick-help></p></div>';
  nav.append(library, table, toolbox);
  quick.append(dealer);
  document.body.insertBefore(header, app);
  document.body.insertBefore(quick, app);
  toolbox.addEventListener('click', () => {
    document.querySelector('[data-tab="tools"]')?.click();
    app.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function labels() {
    header.querySelector('[data-primary-brand]').textContent = t('brand');
    header.querySelector('[data-primary-intro]').textContent = t('intro');
    library.textContent = t('library');
    library.setAttribute('aria-label', `${t('library')} · ${t('libraryHelp')}`);
    toolbox.textContent = t('tools');
    toolbox.setAttribute('aria-label', `${t('tools')} · ${t('toolsHelp')}`);
    quick.querySelector('[data-quick-title]').textContent = t('quick');
    quick.querySelector('[data-quick-help]').textContent = t('quickHelp');
    dealer.textContent = isEnglish() ? 'Secret dealer & host' : '秘密发牌与主持';
  }
  labels();
  new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

function decorateLibrary() {
  const root = document.getElementById('game-library-root');
  const filters = root?.querySelector('.game-library-filters');
  if (!filters || root.querySelector('[data-library-choices]')) return;
  const select = filters.querySelector('[data-game-material]');
  const searchInput = filters.querySelector('[data-game-query]');
  if (!select || !searchInput) return;
  const shell = document.createElement('section');
  shell.className = 'library-choice-section';
  shell.dataset.libraryChoices = '';
  const buttons = [
    ['all', 'everyone'], ['none', 'noProps'], ['everyday', 'everyday'], ['diy', 'diy'], ['printable', 'printable']
  ];
  shell.innerHTML = `<h3>${t('pick')}</h3><p>${t('libraryHint')}</p><div class="library-choice-grid">${buttons.map(([value, label]) => `<button type="button" data-library-material="${value}" aria-pressed="${select.value === value}">${t(label)}</button>`).join('')}</div>`;
  filters.before(shell);
  const advanced = document.createElement('details');
  advanced.className = 'library-optional-search';
  advanced.dataset.librarySearch = '';
  const summary = document.createElement('summary');
  summary.textContent = t('search');
  advanced.append(summary, searchInput.closest('label'));
  filters.after(advanced);
}

function decorateDealer() {
  const root = document.getElementById('secret-dealer-root');
  const editor = root?.querySelector('[data-secret-input="names"]');
  if (!editor || root.querySelector('[data-ready-deal]')) return;
  const panel = editor.closest('.secret-panel');
  const intro = panel?.querySelector(':scope > p');
  if (!intro) return;
  const box = document.createElement('section');
  box.className = 'ready-deal';
  box.dataset.readyDeal = '';
  box.innerHTML = `<h3>${t('readyTitle')}</h3><div class="ready-deal-controls"><label>${t('mode')}<select data-ready-mode>
    <option value="different-word">${t('word')}</option><option value="two-groups">${t('groups')}</option><option value="one-special">${t('special')}</option>
    </select></label><label>${t('count')}<select data-ready-count>${Array.from({ length: 15 }, (_, index) => index + 2).map(count => `<option value="${count}" ${count === 5 ? 'selected' : ''}>${count}</option>`).join('')}</select></label></div>
    <button type="button" class="secret-primary ready-deal-go" data-ready-start>${t('ready')}</button>
    <p class="ready-deal-note">${t('disclaimer')}</p><p class="secret-error" data-ready-error hidden></p>`;
  intro.after(box);
  const custom = document.createElement('p');
  custom.className = 'ready-deal-custom';
  custom.textContent = t('custom');
  box.after(custom);
}

function initialize() {
  mountPrimaryNavigation();
  const library = document.getElementById('game-library-root');
  const dealer = document.getElementById('secret-dealer-root');
  if (!library || !dealer) return;
  new MutationObserver(decorateLibrary).observe(library, { childList: true, subtree: true });
  new MutationObserver(decorateDealer).observe(dealer, { childList: true, subtree: true });
  library.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-library-material]') : null;
    if (!button) return;
    const selector = library.querySelector('[data-game-material]');
    if (!selector) return;
    selector.value = button.dataset.libraryMaterial;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    library.querySelectorAll('[data-library-material]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  });
  library.addEventListener('change', event => {
    if (!event.target?.matches('[data-game-material]')) return;
    library.querySelectorAll('[data-library-material]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.libraryMaterial === event.target.value)));
  });
  dealer.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-ready-start]') : null;
    if (!trigger) return;
    const mode = dealer.querySelector('[data-ready-mode]')?.value;
    const count = dealer.querySelector('[data-ready-count]')?.value;
    const error = dealer.querySelector('[data-ready-error]');
    try {
      if (!READY_DEAL_MODES.includes(mode)) throw new RangeError('mode');
      const preset = buildReadyDeal(mode, count, isEnglish() ? 'en' : 'zh');
      for (const key of ['names', 'cards', 'steps']) dealer.querySelector(`[data-secret-input="${key}"]`).value = preset[key];
      dealer.querySelector('[data-secret-action="deal"]').click();
    } catch (cause) {
      if (error) { error.textContent = cause.message === 'players' ? t('minimum') : t('secure'); error.setAttribute('role', 'alert'); error.hidden = false; }
    }
  });
  decorateLibrary();
  decorateDealer();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
