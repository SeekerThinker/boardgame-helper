import { GAME_LIBRARY_ENTRIES } from './game-library-data.js';
import { publishedGames, filterPublishedGames, GAME_MATERIALS } from './game-library-core.js';

const games = publishedGames(GAME_LIBRARY_ENTRIES);
const TEXT = {
  zh: {
    launch: '游戏图鉴', title: '低门槛游戏图鉴', intro: '寻找零道具或可自制材料的线下游戏。只有完成逐项权利与试玩审核的条目才会显示。',
    close: '关闭', search: '搜索游戏', searchHint: '按游戏名称或玩法搜索', material: '所需材料', all: '全部材料',
    none: '零道具', everyday: '普通材料', diy: '可自制', printable: '可打印', players: '参与人数', anyPlayers: '不限人数',
    results: '符合条件：{count} 款', emptyCatalog: '尚无完成审核并可公开的游戏条目。',
    emptyFilter: '没有符合筛选条件的游戏，请尝试其他关键词或材料。',
    reviewNote: '候选游戏不会自动公开；游戏名称、教学文字、图片与素材必须分别核查。',
    reset: '清除筛选', openDealer: '打开通用私密发牌', openTable: '打开 Table OS', back: '返回图鉴',
    age: '建议年龄', years: '{age} 岁起（编辑判断，见依据）', minutes: '预计 {min}–{max} 分钟', people: '{min}–{max} 人',
    goal: '目标', setup: '准备', turns: '玩法步骤', finish: '结束条件', example: '举例', space: '场地',
    accessibility: '参与提示', ageBasis: '年龄依据', materials: '材料及替代', tools: '可选辅助工具',
    editorialEstimate: '编辑估计，未实测', observation: '试玩记录', mainTools: '返回主应用使用计时／计分／随机工具',
    toolTimer: '计时', toolScore: '计分', toolRandom: '随机', toolDealer: '私密发牌', toolTable: 'Table OS'
  },
  en: {
    launch: 'Game library', title: 'Low-barrier game library', intro: 'Find in-person games that need no equipment or ordinary DIY materials. Only individually rights-reviewed and playtested entries appear.',
    close: 'Close', search: 'Search games', searchHint: 'Search titles or how-to text', material: 'Materials', all: 'Any materials',
    none: 'No equipment', everyday: 'Everyday items', diy: 'DIY materials', printable: 'Printable', players: 'Player count', anyPlayers: 'Any count',
    results: '{count} matching games', emptyCatalog: 'No games have completed editorial and rights review yet.',
    emptyFilter: 'No games match these filters. Try another search or material.',
    reviewNote: 'Candidates are never published automatically. Titles, teaching text, art and components need separate review.',
    reset: 'Clear filters', openDealer: 'Open generic secret dealer', openTable: 'Open Table OS', back: 'Back to library',
    age: 'Suggested age', years: 'Ages {age}+ (editorial judgment; see rationale)', minutes: 'About {min}–{max} minutes', people: '{min}–{max} players',
    goal: 'Goal', setup: 'Setup', turns: 'How to play', finish: 'How it ends', example: 'Example', space: 'Space',
    accessibility: 'Participation notes', ageBasis: 'Age rationale', materials: 'Materials and alternatives', tools: 'Optional tools',
    editorialEstimate: 'Editorial estimate, not measured', observation: 'Playtest observation', mainTools: 'Return to the main app for timer / score / random tools',
    toolTimer: 'Timer', toolScore: 'Score', toolRandom: 'Random', toolDealer: 'Secret dealer', toolTable: 'Table OS'
  }
};
const safe = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const lang = () => document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'zh';
const t = key => TEXT[lang()][key];
const fmt = (key, values) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), t(key));
let root;
let launcher;
let open = false;
let selectedId = null;
let query = '';
let material = 'all';
let players = '';
let returnFocus = null;

function cardsMarkup() {
  const matches = filterPublishedGames(games, { query, material, players }, lang());
  const count = `<p class="game-library-count" role="status">${safe(fmt('results', { count: matches.length }))}</p>`;
  if (!matches.length) return count + `<div class="game-library-empty"><p>${safe(t(games.length ? 'emptyFilter' : 'emptyCatalog'))}</p><p>${safe(t('reviewNote'))}</p><div class="game-library-actions"><button type="button" data-game-action="dealer">${safe(t('openDealer'))}</button><button type="button" data-game-action="table">${safe(t('openTable'))}</button></div></div>`;
  return count + `<div class="game-library-cards">${matches.map(game => {
    const copy = game.copy[lang()];
    return `<article class="game-library-card"><span>${safe(t(game.material))} · ${safe(fmt('people', game.players))}</span><h3>${safe(copy.title)}</h3><p>${safe(copy.summary)}</p><p>${safe(fmt('minutes', game.duration))}</p><button type="button" data-game-detail="${safe(game.id)}" aria-label="${safe(copy.title)}">${safe(copy.title)} →</button></article>`;
  }).join('')}</div>`;
}

function details(game) {
  const copy = game.copy[lang()];
  const section = (label, content) => `<section><h3>${safe(t(label))}</h3>${content}</section>`;
  const list = key => `<ol>${copy[key].map(step => `<li>${safe(step)}</li>`).join('')}</ol>`;
  const tools = game.tools.map(tool => `<button type="button" data-game-action="${tool === 'secret-dealer' ? 'dealer' : tool === 'table-os' ? 'table' : 'main'}">${safe(t(({ timer: 'toolTimer', score: 'toolScore', random: 'toolRandom', 'secret-dealer': 'toolDealer', 'table-os': 'toolTable' })[tool]))}</button>`).join('');
  return `<button type="button" data-game-action="back">← ${safe(t('back'))}</button><h2>${safe(copy.title)}</h2><p>${safe(copy.summary)}</p>
    <p class="game-library-meta">${safe(t(game.material))} · ${safe(fmt('people', game.players))} · ${safe(fmt('minutes', game.duration))} (${safe(t(game.duration.basis === 'editorial-estimate' ? 'editorialEstimate' : 'observation'))})</p>
    <p>${safe(fmt('years', { age: game.age.min }))}</p>
    ${section('goal', `<p>${safe(copy.goal)}</p>`)}${section('materials', `<p>${safe(copy.materials)}</p>`)}
    ${section('setup', list('setup'))}${section('turns', list('turns'))}${section('finish', `<p>${safe(copy.finish)}</p>`)}
    ${section('example', `<p>${safe(copy.example)}</p>`)}${section('ageBasis', `<p>${safe(copy.ageBasis)}</p>`)}
    ${section('space', `<p>${safe(copy.space)}</p>`)}${section('accessibility', `<p>${safe(copy.accessibility)}</p>`)}
    ${section('tools', `<div class="game-library-actions">${tools || `<p>${safe(t('mainTools'))}</p>`}</div>`)}`;
}

function renderResults() {
  const result = root?.querySelector('[data-game-results]');
  if (result) result.innerHTML = cardsMarkup();
}

function render() {
  if (!root) return;
  if (!open) { root.hidden = true; root.replaceChildren(); return; }
  root.hidden = false;
  const selected = games.find(game => game.id === selectedId);
  const materialOptions = ['all', ...GAME_MATERIALS].map(value => `<option value="${value}" ${material === value ? 'selected' : ''}>${safe(t(value))}</option>`).join('');
  root.innerHTML = `<div class="game-library-backdrop"><section class="game-library-panel" role="dialog" aria-modal="true" aria-labelledby="game-library-title" tabindex="-1">
    <header><h2 id="game-library-title">${safe(t('title'))}</h2><button type="button" data-game-action="close" aria-label="${safe(t('close'))}">×</button></header>
    ${selected ? `<div class="game-library-detail">${details(selected)}</div>` : `<p>${safe(t('intro'))}</p><div class="game-library-filters">
      <label>${safe(t('search'))}<input type="search" data-game-query maxlength="100" value="${safe(query)}" placeholder="${safe(t('searchHint'))}"></label>
      <label>${safe(t('material'))}<select data-game-material>${materialOptions}</select></label>
      <label>${safe(t('players'))}<select data-game-players><option value="">${safe(t('anyPlayers'))}</option>${Array.from({ length: 32 }, (_, i) => i + 1).map(n => `<option value="${n}" ${players === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button type="button" data-game-action="reset">${safe(t('reset'))}</button></div><div data-game-results>${cardsMarkup()}</div>`}
  </section></div>`;
  root.querySelector('[data-game-action="close"]')?.focus({ preventScroll: true });
}

function close() {
  open = false;
  selectedId = null;
  render();
  (returnFocus?.isConnected ? returnFocus : launcher)?.focus({ preventScroll: true });
  returnFocus = null;
}

function navigate(action) {
  if (action === 'close') return close();
  if (action === 'back') { selectedId = null; render(); return; }
  if (action === 'reset') { query = ''; material = 'all'; players = ''; render(); return; }
  if (['dealer', 'table', 'main'].includes(action)) {
    close();
    const target = action === 'dealer' ? 'secret-dealer-launcher' : action === 'table' ? 'tableos-launcher' : null;
    if (target) document.getElementById(target)?.click();
  }
}

function init() {
  launcher = document.createElement('button');
  launcher.id = 'game-library-launcher';
  launcher.type = 'button';
  launcher.textContent = t('launch');
  launcher.setAttribute('aria-label', t('launch'));
  launcher.addEventListener('click', () => { returnFocus = document.activeElement; open = true; render(); });
  root = document.createElement('div');
  root.id = 'game-library-root';
  root.hidden = true;
  root.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-game-action],[data-game-detail]') : null;
    if (!target) return;
    if (target.dataset.gameDetail) { selectedId = target.dataset.gameDetail; render(); return; }
    navigate(target.dataset.gameAction);
  });
  root.addEventListener('input', event => {
    if (event.target?.matches('[data-game-query]')) { query = event.target.value; renderResults(); }
  });
  root.addEventListener('change', event => {
    if (event.target?.matches('[data-game-material]')) { material = event.target.value; renderResults(); }
    if (event.target?.matches('[data-game-players]')) { players = event.target.value; renderResults(); }
  });
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll('button:not([disabled]),input,select')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!root.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // App language changes are already reflected by documentElement.lang; keep launch text in sync.
  new MutationObserver(() => {
    launcher.textContent = t('launch');
    launcher.setAttribute('aria-label', t('launch'));
    if (open) render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  document.body.append(launcher, root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
