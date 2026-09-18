import { createSecretDeal, parsePublicSteps, MAX_DEAL_PLAYERS } from './secret-dealer-core.js';

// This independent, opt-in session deliberately never reads or writes localStorage,
// archives, telemetry or Table OS backups. Closing/reloading discards every card.
const WORDS = {
  zh: {
    launch: '秘密发牌与主持', title: '私密发牌 · 主持辅助', close: '关闭',
    intro: '通用工具：自己输入身份或词语，每人一行；不附带任何特定游戏的角色卡、词库或规则。仅保存在当前页面内存，刷新或关闭即清除。',
    names: '玩家名单（每行一人）', namesPlaceholder: '玩家甲\n玩家乙\n玩家丙',
    cards: '私密内容（每行一张／一个词，重复内容请重复填写）', cardsPlaceholder: '自定义词条 A\n自定义词条 A\n自定义词条 B',
    steps: '公开主持提示（可选，每行一步；不要填入秘密）', stepsPlaceholder: '宣布开始\n轮流发言\n由主持人确认结果',
    hint: '人数 2–16；私密内容条数必须与人数相同。请仅输入你有权使用或自行创作的内容。',
    deal: '随机分配并开始', invalidPlayers: '请输入 2–16 名玩家，每个名字最多 32 个字符。',
    invalidCards: '私密内容必须与人数逐条对应，每条最多 80 个字符。', invalidSteps: '公开提示最多 12 步，每步最多 100 个字符。',
    error: '无法开始，请检查输入。', randomError: '当前设备无法安全地随机发牌，请检查浏览器环境。',
    pass: '第 {current} / {total} 位：{name}', cover: '内容已遮住；请先把设备交给本人。',
    arm: '已交给本人，准备查看', ready: '请确认设备只由本人观看。', reveal: '我是本人，显示内容',
    secret: '你的私密内容', hide: '看完了，遮住', next: '下一位玩家', finish: '完成发牌',
    done: '所有玩家均已查看。请由主持人继续流程。', host: '公开主持流程',
    noSteps: '没有预设流程；请由主持人按现场约定推进。本工具不会自动裁决胜负。',
    previous: '上一步', following: '下一步', step: '第 {current} / {total} 步', last: '已到最后一步',
    clear: '结束并清除所有秘密', clearConfirm: '结束后会立即清除本次发牌与主持提示，无法恢复。继续吗？',
    closeConfirm: '关闭会清除本次全部私密分配，无法恢复。继续吗？', privacy: '不联网、不保存、不导出秘密；刷新页面也会清除。本机轮流查看时请防止旁人窥屏。'
  },
  en: {
    launch: 'Secret dealer & host', title: 'Private dealer · Host prompts', close: 'Close',
    intro: 'Generic tool: enter your own roles or words, one per line. No branded cards, word lists or rules are included. In-memory only; closing or refreshing erases everything.',
    names: 'Players (one per line)', namesPlaceholder: 'Player A\nPlayer B\nPlayer C',
    cards: 'Private cards or words (one per line; repeat a line for duplicates)', cardsPlaceholder: 'Your word A\nYour word A\nYour word B',
    steps: 'Public host prompts (optional, one per line; never enter secrets)', stepsPlaceholder: 'Announce the start\nTake turns speaking\nHost confirms the result',
    hint: '2–16 players, exactly one private item per player. Enter only original content or content you have permission to use.',
    deal: 'Shuffle and start', invalidPlayers: 'Enter 2–16 players, with names up to 32 characters.',
    invalidCards: 'Enter exactly one private item per player, each up to 80 characters.', invalidSteps: 'Up to 12 public prompts, each up to 100 characters.',
    error: 'Could not start; check the input.', randomError: 'Secure random dealing is unavailable in this browser.',
    pass: 'Player {current} / {total}: {name}', cover: 'Content is hidden. Pass the device to this player first.',
    arm: 'Device passed to player', ready: 'Make sure only the intended player can see the screen.', reveal: 'I am this player — show mine',
    secret: 'Your private item', hide: 'Done — hide it', next: 'Next player', finish: 'Finish dealing',
    done: 'Every player has seen their item. The host can now run the game.', host: 'Public host prompts',
    noSteps: 'No scripted steps. The host follows the agreed rules; this tool does not decide a winner.',
    previous: 'Previous', following: 'Next', step: 'Step {current} / {total}', last: 'Last step reached',
    clear: 'End and erase all secrets', clearConfirm: 'This irreversibly erases the deal and host prompts. Continue?',
    closeConfirm: 'Closing irreversibly erases all private assignments. Continue?', privacy: 'No network, storage or export of secrets. Refreshing also erases them. Prevent shoulder-surfing when passing the device.'
  }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
let open = false;
let deal = null;
let publicSteps = [];
let playerIndex = 0;
let stepIndex = 0;
let stage = 'cover';
let viewedAndHidden = false;
let error = '';
let draft = { names: '', cards: '', steps: '' };
let root = null;
let launcher = null;
let previousFocus = null;
const lang = () => document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'zh';
const tr = key => WORDS[lang()][key];
const fmt = (key, values) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), tr(key));

function reset() {
  deal = null;
  publicSteps = [];
  playerIndex = 0;
  stepIndex = 0;
  stage = 'cover';
  viewedAndHidden = false;
  error = '';
  draft = { names: '', cards: '', steps: '' };
}

function editor() {
  return `<p>${esc(tr('intro'))}</p>
    <label>${esc(tr('names'))}<textarea data-secret-input="names" rows="4" maxlength="640" placeholder="${esc(tr('namesPlaceholder'))}">${esc(draft.names)}</textarea></label>
    <label>${esc(tr('cards'))}<textarea data-secret-input="cards" rows="4" maxlength="1500" placeholder="${esc(tr('cardsPlaceholder'))}">${esc(draft.cards)}</textarea></label>
    <label>${esc(tr('steps'))}<textarea data-secret-input="steps" rows="3" maxlength="1300" placeholder="${esc(tr('stepsPlaceholder'))}">${esc(draft.steps)}</textarea></label>
    <p class="secret-help">${esc(tr('hint'))}</p>
    ${error ? `<p class="secret-error" role="alert">${esc(error)}</p>` : ''}
    <button type="button" class="secret-primary" data-secret-action="deal">${esc(tr('deal'))}</button>`;
}

function hostView() {
  return `<section class="secret-host"><h3>${esc(tr('host'))}</h3>${publicSteps.length
    ? `<p aria-live="polite">${esc(fmt('step', { current: stepIndex + 1, total: publicSteps.length }))}</p><p class="secret-step">${esc(publicSteps[stepIndex])}</p><div class="secret-actions"><button type="button" data-secret-action="previous" ${stepIndex === 0 ? 'disabled' : ''}>${esc(tr('previous'))}</button><button type="button" data-secret-action="following" ${stepIndex === publicSteps.length - 1 ? 'disabled' : ''}>${esc(tr('following'))}</button></div>`
    : `<p>${esc(tr('noSteps'))}</p>`}</section>`;
}

function playing() {
  if (playerIndex >= deal.length) return `<p role="status">${esc(tr('done'))}</p>${hostView()}<button type="button" class="secret-danger" data-secret-action="clear">${esc(tr('clear'))}</button>`;
  const player = deal[playerIndex];
  const heading = `<h3>${esc(fmt('pass', { current: playerIndex + 1, total: deal.length, name: player.name }))}</h3>`;
  if (stage === 'shown') {
    // The only path that ever inserts an assigned secret into the DOM.
    return `<section class="secret-private">${heading}<p>${esc(tr('secret'))}</p><output data-secret-revealed>${esc(player.secret)}</output><button type="button" class="secret-primary" data-secret-action="hide">${esc(tr('hide'))}</button></section>`;
  }
  return `<section class="secret-private">${heading}<p>${esc(stage === 'armed' ? tr('ready') : tr('cover'))}</p><button type="button" class="secret-primary" data-secret-action="${stage === 'armed' ? 'reveal' : 'arm'}">${esc(tr(stage === 'armed' ? 'reveal' : 'arm'))}</button>${stage === 'cover' && playerIndex > 0 ? `<p class="secret-help">${esc(tr('privacy'))}</p>` : ''}</section>`;
}

function render(focusAction = '') {
  if (!root) return;
  if (!open) { root.replaceChildren(); root.hidden = true; return; }
  root.hidden = false;
  root.innerHTML = `<div class="secret-backdrop"><section class="secret-panel" role="dialog" aria-modal="true" aria-labelledby="secret-title" tabindex="-1">
    <header><h2 id="secret-title">${esc(tr('title'))}</h2><button type="button" data-secret-action="close" aria-label="${esc(tr('close'))}">×</button></header>
    ${deal ? playing() : editor()}
    ${deal && playerIndex < deal.length && stage === 'cover' && viewedAndHidden ? `<div class="secret-actions"><button type="button" data-secret-action="next">${esc(playerIndex === deal.length - 1 ? tr('finish') : tr('next'))}</button><button type="button" class="secret-danger" data-secret-action="clear">${esc(tr('clear'))}</button></div>` : ''}
    <footer>${esc(tr('privacy'))}</footer>
  </section></div>`;
  if (!document.hidden) (root.querySelector(`[data-secret-action="${focusAction}"]`) || root.querySelector('.secret-panel'))?.focus({ preventScroll: true });
}

function close() {
  if (deal && !confirm(tr('closeConfirm'))) return;
  reset();
  open = false;
  render();
  (previousFocus?.isConnected ? previousFocus : launcher)?.focus({ preventScroll: true });
  previousFocus = null;
}

function captureDraft() {
  for (const key of ['names', 'cards', 'steps']) draft[key] = root.querySelector(`[data-secret-input="${key}"]`)?.value ?? '';
}

function handle(action) {
  if (action === 'close') { close(); return; }
  if (action === 'clear') { if (confirm(tr('clearConfirm'))) { reset(); render('deal'); } return; }
  if (action === 'deal' && !deal) {
    captureDraft();
    try {
      const nextSteps = parsePublicSteps(draft.steps);
      const nextDeal = createSecretDeal(draft.names, draft.cards);
      deal = nextDeal;
      publicSteps = nextSteps;
      // Editor input, including the whole deck, is no longer present in the DOM.
      draft = { names: '', cards: '', steps: '' };
      error = '';
      render('arm');
    } catch (cause) {
      error = cause.message === 'players' ? tr('invalidPlayers') : cause.message === 'cards' ? tr('invalidCards') : cause.message === 'steps' ? tr('invalidSteps') : cause.message === 'Secure random generator unavailable' ? tr('randomError') : tr('error');
      render('deal');
    }
    return;
  }
  if (!deal) return;
  if (action === 'arm' && stage === 'cover' && playerIndex < deal.length) { stage = 'armed'; render('reveal'); return; }
  if (action === 'reveal' && stage === 'armed' && playerIndex < deal.length) { stage = 'shown'; render('hide'); return; }
  if (action === 'hide' && stage === 'shown') { stage = 'cover'; viewedAndHidden = true; render('next'); return; }
  if (action === 'next' && stage === 'cover' && viewedAndHidden && playerIndex < deal.length) { playerIndex += 1; viewedAndHidden = false; render(playerIndex < deal.length ? 'arm' : 'clear'); return; }
  if (action === 'previous' && playerIndex >= deal.length && stepIndex > 0) { stepIndex -= 1; render('previous'); return; }
  if (action === 'following' && playerIndex >= deal.length && stepIndex < publicSteps.length - 1) { stepIndex += 1; render('following'); }
}

function init() {
  launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.id = 'secret-dealer-launcher';
  launcher.textContent = tr('launch');
  launcher.setAttribute('aria-label', tr('launch'));
  launcher.addEventListener('click', () => { previousFocus = document.activeElement; open = true; render('deal'); });
  root = document.createElement('div');
  root.id = 'secret-dealer-root';
  root.hidden = true;
  root.addEventListener('click', event => {
    const action = event.target instanceof Element ? event.target.closest('[data-secret-action]')?.dataset.secretAction : null;
    if (action) handle(action);
  });
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (stage !== 'cover' && deal && playerIndex < deal.length) { stage = 'cover'; render('arm'); }
      else close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll('button:not([disabled]),textarea')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!root.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (open && deal && stage !== 'cover') { stage = 'cover'; render('arm'); }
  });
  window.addEventListener('pagehide', () => { reset(); open = false; render(); });
  document.body.append(launcher, root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
