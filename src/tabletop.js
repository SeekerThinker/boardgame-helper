import { STORAGE_KEY } from './core.js';
import {
  TABLE_OS_STORAGE_KEY, ASSISTANT_TEMPLATES, MAX_TABLE_OS_PARTICIPANTS, MAX_TRACKERS, MAX_PHASES,
  MAX_TEAMS, MAX_SCORE_FIELDS, MAX_CAMPAIGN_FLAGS, createDefaultTableOsState, normalizeTableOsState,
  syncParticipantsFromGame, addParticipant, renameParticipant, removeParticipant,
  addTracker, removeTracker, trackerEntityIds, trackerValue, adjustTracker, setTrackerValue, setTrackerPersistence,
  addPhase, removePhase, setActivePhase, advancePhase,
  addTeam, removeTeam, toggleTeamMember, setRole, clearRole, roleForParticipant,
  addScoreSheetField, removeScoreSheetField, setScoreSheetValue, scoreCardForParticipant,
  addCampaignFlag, toggleCampaignFlag, removeCampaignFlag,
  applyAssistantTemplate, resetTableOsSession, serializeTableOsState, parseTableOsState, touch
} from './tabletop-core.js';

const LEGACY_GAME_STATE_KEY = 'board-game-assistant-state-v1';
const SECTION_IDS = ['overview', 'trackers', 'phases', 'teams', 'score', 'campaign'];
const QUICK_TEMPLATES = ['universal', 'coop-crisis', 'hidden-role', 'card-battle', 'campaign', 'party-teams'];

const I18N = {
  zh: {
    launcher: '桌面 OS', title: '高级桌游助手', subtitle: '牌局时只保留真正要操作的内容；需要配置时再进入编辑模式。',
    close: '关闭', sync: '同步当前玩家', template: '适配模板', apply: '应用模板', reset: '新场景 / 下一局', export: '导出', import: '导入',
    playMode: '牌局模式', editMode: '编辑配置', editHint: '模板、结构和高级设置只在编辑模式出现。',
    overview: '总览', trackers: '追踪器', phases: '阶段', teams: '团队与身份', score: '计分表', campaign: '战役',
    participants: '参与者', addParticipant: '添加参与者', sourceGame: '当前对局', localOnly: '扩展参与者', remove: '删除',
    activeTemplate: '当前模板', coverage: '当前工作台', coverageText: '状态 · 阶段 · 团队 · 私密身份 · 计分 · 战役',
    emptyParticipants: '还没有参与者。可以同步主应用玩家，或在编辑模式单独添加。', savedLocal: '全部数据只保存在本机。',
    quickStart: '今天需要什么？', quickStartHelp: '先选一个最接近的场景，之后只在需要时调整。',
    addTracker: '添加追踪器', trackerName: '名称', scope: '范围', global: '公共', participant: '每位玩家', team: '每个团队', step: '步长', min: '最小', max: '最大',
    persistence: '保留到', sessionOnly: '本局', campaignPersist: '战役', noTrackers: '当前没有追踪器。',
    addPhase: '添加阶段', cycle: '循环', previous: '上一步', next: '下一步', noPhases: '当前没有阶段。', phaseNote: '备注', openTimer: '去主计时器',
    addTeam: '添加团队', noTeams: '当前没有团队。', members: '成员', role: '身份', faction: '阵营', secret: '私密', note: '主持备注', reveal: '交给玩家查看', hide: '看完了', clear: '清除',
    adoptTeams: '采用工具箱分队', noRandomTeams: '工具箱里还没有随机分队结果。', teamsAdopted: '已采用工具箱最近一次分队。',
    addScoreField: '添加计分栏', addFormula: '添加公式栏', fieldName: '栏位', key: '变量', formula: '公式', effect: '计入', total: '总分', included: '计入总分', excluded: '仅显示',
    noScoreFields: '当前没有计分栏。', formulaHelp: '公式支持变量、数字、+ − × ÷ 和括号，例如 base + bonus - penalty。',
    campaignEnabled: '启用战役记录', campaignName: '战役名称', chapter: '章节 / 场景', sessionNumber: '第几局', notes: '跨局备注', flags: '检查点 / 解锁项', addFlag: '添加检查点', noFlags: '还没有检查点。',
    imported: '已导入高级助手数据。', importFailed: '导入失败：文件不是有效的桌面 OS 数据。', exported: '已导出。', synced: '已同步当前对局玩家。',
    confirmTemplate: '应用模板会重置追踪器、阶段、团队、身份和高级计分表，但保留参与者。继续吗？', confirmReset: '开始新场景会重置“本局”追踪器、身份和高级计分值，保留“战役”追踪器，并推进战役局数。继续吗？',
    limit: '已达到上限。', customParticipant: '新参与者', customTracker: '新追踪器', customPhase: '新阶段', customTeam: '新团队', customField: '新栏位', customFormula: '计算栏', customFlag: '新检查点',
    revealFor: '仅给这位玩家看', passDevice: '请先把设备交给对应玩家。身份现在仍然隐藏。', revealNow: '这是我，查看身份', noRole: '尚未设置身份',
    templateHint: '模板只是可编辑的工作流起点，不替代官方规则。', moderatorNoteHidden: '主持备注不会显示给玩家。'
  },
  en: {
    launcher: 'Table OS', title: 'Advanced Table Assistant', subtitle: 'Play mode keeps only live table controls visible; configuration stays in Edit mode.',
    close: 'Close', sync: 'Sync game players', template: 'Assistant template', apply: 'Apply', reset: 'New scenario / rematch', export: 'Export', import: 'Import',
    playMode: 'Play', editMode: 'Edit setup', editHint: 'Templates, structure and advanced settings only appear in Edit mode.',
    overview: 'Overview', trackers: 'Trackers', phases: 'Phases', teams: 'Teams & roles', score: 'Score sheet', campaign: 'Campaign',
    participants: 'Participants', addParticipant: 'Add participant', sourceGame: 'Game roster', localOnly: 'Assistant-only', remove: 'Remove',
    activeTemplate: 'Active template', coverage: 'Active workspace', coverageText: 'State · phases · teams · private roles · scoring · campaign',
    emptyParticipants: 'No participants yet. Sync the main game roster or add assistant-only participants in Edit mode.', savedLocal: 'Everything stays on this device.',
    quickStart: 'What do you need tonight?', quickStartHelp: 'Choose the closest starting point; tune it only when necessary.',
    addTracker: 'Add tracker', trackerName: 'Name', scope: 'Scope', global: 'Shared', participant: 'Per player', team: 'Per team', step: 'Step', min: 'Min', max: 'Max',
    persistence: 'Keep for', sessionOnly: 'Session', campaignPersist: 'Campaign', noTrackers: 'No trackers yet.',
    addPhase: 'Add phase', cycle: 'Cycle', previous: 'Previous', next: 'Next', noPhases: 'No phases yet.', phaseNote: 'Note', openTimer: 'Open main timer',
    addTeam: 'Add team', noTeams: 'No teams yet.', members: 'Members', role: 'Role', faction: 'Faction', secret: 'Private', note: 'Moderator note', reveal: 'Pass to player', hide: 'Done', clear: 'Clear',
    adoptTeams: 'Use toolbox teams', noRandomTeams: 'There is no recent random-team result in the toolbox.', teamsAdopted: 'Latest toolbox teams adopted.',
    addScoreField: 'Add score field', addFormula: 'Add formula', fieldName: 'Field', key: 'Variable', formula: 'Formula', effect: 'Effect', total: 'Total', included: 'Included', excluded: 'Display only',
    noScoreFields: 'No score fields yet.', formulaHelp: 'Formulas support variables, numbers, + − × ÷ and parentheses, e.g. base + bonus - penalty.',
    campaignEnabled: 'Enable campaign record', campaignName: 'Campaign name', chapter: 'Chapter / scenario', sessionNumber: 'Session', notes: 'Persistent notes', flags: 'Checkpoints / unlocks', addFlag: 'Add checkpoint', noFlags: 'No checkpoints yet.',
    imported: 'Advanced assistant data imported.', importFailed: 'Import failed: this is not valid Table OS data.', exported: 'Exported.', synced: 'Game roster synced.',
    confirmTemplate: 'Applying a template resets trackers, phases, teams, roles and the advanced score sheet while preserving participants. Continue?', confirmReset: 'Starting a new scenario resets session trackers, roles and advanced scores, preserves campaign trackers, and advances the campaign session. Continue?',
    limit: 'Limit reached.', customParticipant: 'New participant', customTracker: 'New tracker', customPhase: 'New phase', customTeam: 'New team', customField: 'New field', customFormula: 'Calculated field', customFlag: 'New checkpoint',
    revealFor: 'For this player only', passDevice: 'Pass the device to the matching player first. The role is still hidden.', revealNow: 'This is me — reveal role', noRole: 'No role assigned',
    templateHint: 'Templates are editable workflow starters, not replacements for official rules.', moderatorNoteHidden: 'Moderator notes are never shown in player reveal.'
  }
};

let state = loadState();
let isOpen = false;
let selectedTemplateId = state.appliedTemplateId || 'universal';
let revealedParticipantId = null;
let revealArmed = false;
let toast = '';
let toastTimer = null;
let roleRevealReturnId = null;
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]):not([type=\"hidden\"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])';

function locale() {
  return document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function tr(key) {
  return I18N[locale()][key] ?? I18N.zh[key] ?? key;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function attr(value) {
  return esc(value).replace(/`/g, '&#96;');
}

function loadState() {
  try {
    const raw = localStorage.getItem(TABLE_OS_STORAGE_KEY);
    return raw ? normalizeTableOsState(JSON.parse(raw)) : createDefaultTableOsState();
  } catch (_) {
    return createDefaultTableOsState();
  }
}

function persist() {
  try { localStorage.setItem(TABLE_OS_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

function readGameState() {
  for (const key of [STORAGE_KEY, LEGACY_GAME_STATE_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }
  return null;
}

function readGamePlayers() {
  const parsed = readGameState();
  return Array.isArray(parsed?.players) ? parsed.players : [];
}

function initializeParticipants() {
  if (state.participants.length) return;
  const players = readGamePlayers();
  if (!players.length) return;
  syncParticipantsFromGame(state, players);
  persist();
}

function flash(message) {
  toast = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast = ''; render(); }, 2400);
  render();
}

function participantById(id) {
  return state.participants.find(participant => participant.id === id) || null;
}

function teamById(id) {
  return state.teams.find(team => team.id === id) || null;
}

function entityName(tracker, entityId) {
  if (tracker.scope === 'participant') return participantById(entityId)?.name || entityId;
  if (tracker.scope === 'team') return teamById(entityId)?.name || entityId;
  return tracker.name;
}

function templateName(template) {
  return template.names?.[locale()] || template.names?.zh || template.id;
}

function templateDescription(template) {
  return template.descriptions?.[locale()] || template.descriptions?.zh || '';
}

function hasConfiguredWorkspace() {
  return Boolean(state.trackers.length || state.phases.items.length || state.teams.length || state.roles.length || state.scoreSheet.fields.length || state.campaign.enabled || state.campaign.flags.length);
}

function visibleSections() {
  if (state.ui.mode === 'edit') return SECTION_IDS;
  const ids = ['overview'];
  if (state.trackers.length) ids.push('trackers');
  if (state.phases.items.length) ids.push('phases');
  if (state.teams.length || state.roles.length) ids.push('teams');
  if (state.scoreSheet.fields.length) ids.push('score');
  if (state.campaign.enabled || state.campaign.flags.length) ids.push('campaign');
  return ids;
}

function renderLauncher() {
  let launcher = document.getElementById('tableos-launcher');
  if (!launcher) {
    launcher = document.createElement('button');
    launcher.id = 'tableos-launcher';
    launcher.type = 'button';
    launcher.addEventListener('click', () => {
      isOpen = true;
      initializeParticipants();
      render();
      focusTableOsDialog();
    });
    document.body.append(launcher);
  }
  launcher.textContent = tr('launcher');
  launcher.setAttribute('aria-label', tr('title'));
  launcher.dataset.active = hasConfiguredWorkspace() ? 'true' : 'false';
}

function renderContext() {
  const sheet = document.querySelector('.tableos-sheet');
  const active = document.activeElement;
  let focusSelector = null;
  if (active instanceof HTMLElement) {
    const dataKey = Object.keys(active.dataset || {}).find(key => key.startsWith('os'));
    if (dataKey) {
      const attrName = `data-${dataKey.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}`;
      focusSelector = `[${attrName}="${CSS.escape(active.dataset[dataKey] || '')}"]`;
    }
  }
  return { scrollTop: sheet?.scrollTop || 0, focusSelector };
}

function restoreRenderContext(context) {
  const sheet = document.querySelector('.tableos-sheet');
  if (sheet) sheet.scrollTop = context.scrollTop;
  if (!context.focusSelector) return;
  const next = document.querySelector(context.focusSelector);
  if (next instanceof HTMLElement) next.focus({ preventScroll: true });
}

function visibleFocusableElements(container) {
  if (!(container instanceof HTMLElement)) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(element =>
    element instanceof HTMLElement && element.getClientRects().length > 0 && !element.hasAttribute('hidden')
  );
}

function focusElement(element) {
  if (element instanceof HTMLElement) element.focus({ preventScroll: true });
}

function focusTableOsDialog() {
  const dialog = document.querySelector('.tableos-sheet[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) return;
  const focusable = visibleFocusableElements(dialog);
  focusElement(dialog.querySelector('[data-os-action="close"]') || focusable[0] || dialog);
}

function focusRoleReveal() {
  const dialog = document.querySelector('.tableos-secret[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) return;
  focusElement(visibleFocusableElements(dialog)[0] || dialog);
}

function focusRoleTrigger(participantId) {
  if (!participantId) return;
  focusElement(document.querySelector(`[data-os-role-reveal="${CSS.escape(participantId)}"]`));
}

function closeRoleReveal() {
  const participantId = roleRevealReturnId || revealedParticipantId;
  revealedParticipantId = null;
  revealArmed = false;
  roleRevealReturnId = null;
  render();
  focusRoleTrigger(participantId);
}

function flushActiveDraft() {
  const active = document.activeElement;
  const editable = active instanceof HTMLTextAreaElement
    || (active instanceof HTMLInputElement && ['text', 'number'].includes(active.type));
  if (!editable || !active.closest('#tableos-root')) return false;
  active.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function closeTableOs() {
  flushActiveDraft();
  isOpen = false;
  revealedParticipantId = null;
  revealArmed = false;
  roleRevealReturnId = null;
  render();
  focusElement(document.getElementById('tableos-launcher'));
}

function trapModalFocus(event) {
  if (event.key !== 'Tab' || !isOpen) return false;
  const dialog = revealedParticipantId
    ? document.querySelector('.tableos-secret[role="dialog"]')
    : document.querySelector('.tableos-sheet[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) return false;
  const focusable = visibleFocusableElements(dialog);
  if (!focusable.length) {
    event.preventDefault();
    focusElement(dialog);
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!dialog.contains(active)) {
    event.preventDefault();
    focusElement(event.shiftKey ? last : first);
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    focusElement(last);
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    focusElement(first);
    return true;
  }
  return false;
}

function render() {
  renderLauncher();
  const old = document.getElementById('tableos-root');
  if (!isOpen) {
    old?.remove();
    return;
  }
  const context = renderContext();
  const root = old || document.createElement('div');
  root.id = 'tableos-root';
  root.innerHTML = renderShell();
  if (!old) document.body.append(root);
  restoreRenderContext(context);
}

function renderModeToggle() {
  return `<div class="tableos-mode" role="group" aria-label="${attr(tr('title'))}">
    <button type="button" data-os-mode="play" class="${state.ui.mode === 'play' ? 'active' : ''}">${esc(tr('playMode'))}</button>
    <button type="button" data-os-mode="edit" class="${state.ui.mode === 'edit' ? 'active' : ''}">${esc(tr('editMode'))}</button>
  </div>`;
}

function renderShell() {
  const sections = visibleSections();
  if (!sections.includes(state.ui.activeSection)) state.ui.activeSection = 'overview';
  return `
    <div class="tableos-backdrop" data-os-action="close">
      <section class="tableos-sheet ${state.ui.mode === 'edit' ? 'is-editing' : 'is-playing'}" role="dialog" aria-modal="true" aria-labelledby="tableos-title" tabindex="-1">
        <header class="tableos-header">
          <div><p class="tableos-kicker">TABLE OS</p><h2 id="tableos-title">${esc(tr('title'))}</h2><p>${esc(tr('subtitle'))}</p></div>
          <div class="tableos-header-actions">${renderModeToggle()}<button class="tableos-icon" type="button" data-os-action="close" aria-label="${attr(tr('close'))}">×</button></div>
        </header>
        ${state.ui.mode === 'edit' ? renderEditorToolbar() : `<p class="tableos-play-hint">${esc(tr('editHint'))}</p>`}
        <nav class="tableos-nav" aria-label="${attr(tr('title'))}">
          ${sections.map(id => `<button type="button" data-os-section="${id}" class="${state.ui.activeSection === id ? 'active' : ''}" aria-current="${state.ui.activeSection === id ? 'page' : 'false'}">${esc(tr(id))}</button>`).join('')}
        </nav>
        <div class="tableos-content">${renderSection()}</div>
        <footer class="tableos-footer"><span>${esc(tr('savedLocal'))}</span>${hasConfiguredWorkspace() ? `<button type="button" class="tableos-btn danger" data-os-action="reset">${esc(tr('reset'))}</button>` : ''}</footer>
        ${toast ? `<div class="tableos-toast" role="status">${esc(toast)}</div>` : ''}
        ${revealedParticipantId ? renderRoleReveal(revealedParticipantId) : ''}
      </section>
    </div>`;
}

function renderEditorToolbar() {
  return `<div class="tableos-toolbar">
    <label class="tableos-template"><span>${esc(tr('template'))}</span>
      <select data-os-template>${ASSISTANT_TEMPLATES.map(template => `<option value="${template.id}" ${selectedTemplateId === template.id ? 'selected' : ''}>${esc(templateName(template))}</option>`).join('')}</select>
    </label>
    <button type="button" class="tableos-btn primary" data-os-action="apply-template">${esc(tr('apply'))}</button>
    <button type="button" class="tableos-btn" data-os-action="sync">${esc(tr('sync'))}</button>
    <button type="button" class="tableos-btn" data-os-action="export">${esc(tr('export'))}</button>
    <button type="button" class="tableos-btn" data-os-action="import">${esc(tr('import'))}</button>
    <input id="tableos-import-file" type="file" accept="application/json,.json" hidden>
    <p class="tableos-template-note">${esc(templateDescription(ASSISTANT_TEMPLATES.find(template => template.id === selectedTemplateId) || ASSISTANT_TEMPLATES[0]))} · ${esc(tr('templateHint'))}</p>
  </div>`;
}

function renderSection() {
  if (state.ui.activeSection === 'trackers') return renderTrackers();
  if (state.ui.activeSection === 'phases') return renderPhases();
  if (state.ui.activeSection === 'teams') return renderTeamsRoles();
  if (state.ui.activeSection === 'score') return renderScoreSheet();
  if (state.ui.activeSection === 'campaign') return renderCampaign();
  return renderOverview();
}

function renderQuickStart() {
  return `<section class="tableos-card tableos-quickstart">
    <span>${esc(tr('quickStart'))}</span><h3>${esc(tr('quickStartHelp'))}</h3>
    <div class="tableos-quick-grid">${QUICK_TEMPLATES.map(id => {
      const template = ASSISTANT_TEMPLATES.find(item => item.id === id);
      return `<button type="button" data-os-quick-template="${id}"><strong>${esc(templateName(template))}</strong><span>${esc(templateDescription(template))}</span></button>`;
    }).join('')}</div>
  </section>`;
}

function renderOverview() {
  if (!hasConfiguredWorkspace() && state.ui.mode === 'play') return renderQuickStart();
  const template = ASSISTANT_TEMPLATES.find(item => item.id === state.appliedTemplateId) || ASSISTANT_TEMPLATES[0];
  const activePhase = state.phases.items[state.phases.activeIndex];
  return `
    <div class="tableos-grid two">
      <section class="tableos-card hero-card">
        <span>${esc(tr('activeTemplate'))}</span><h3>${esc(templateName(template))}</h3><p>${esc(templateDescription(template))}</p>
        <div class="tableos-statline"><strong>${state.trackers.length}</strong><span>${esc(tr('trackers'))}</span><strong>${state.phases.items.length}</strong><span>${esc(tr('phases'))}</span><strong>${state.teams.length}</strong><span>${esc(tr('teams'))}</span></div>
      </section>
      <section class="tableos-card"><span>${esc(tr('coverage'))}</span><h3>${esc(tr('coverageText'))}</h3>${activePhase ? `<p>${esc(tr('phases'))}: <strong>${esc(activePhase.name)}</strong> · ${esc(tr('cycle'))} ${state.phases.cycle}</p>` : ''}</section>
    </div>
    <section class="tableos-card">
      <div class="tableos-card-head"><div><span>${esc(tr('participants'))}</span><h3>${state.participants.length} / ${MAX_TABLE_OS_PARTICIPANTS}</h3></div>${state.ui.mode === 'edit' ? `<button class="tableos-btn" type="button" data-os-action="add-participant">${esc(tr('addParticipant'))}</button>` : ''}</div>
      ${state.participants.length ? `<div class="tableos-participants">${state.participants.map(participant => state.ui.mode === 'edit' ? `
        <div class="tableos-person" style="--person:${participant.color}"><span class="tableos-dot"></span><input value="${attr(participant.name)}" data-os-participant-name="${participant.id}" maxlength="32"><small>${esc(participant.sourcePlayerId ? tr('sourceGame') : tr('localOnly'))}</small><button class="tableos-mini danger" type="button" data-os-remove-participant="${participant.id}" aria-label="${attr(tr('remove'))}">×</button></div>` : `
        <div class="tableos-person tableos-person-readonly" style="--person:${participant.color}"><span class="tableos-dot"></span><strong>${esc(participant.name)}</strong><small>${esc(participant.sourcePlayerId ? tr('sourceGame') : tr('localOnly'))}</small></div>`).join('')}</div>` : `<p class="tableos-empty">${esc(tr('emptyParticipants'))}</p>`}
    </section>`;
}

function renderTrackers() {
  return `<section class="tableos-card">
    <div class="tableos-card-head"><div><span>${esc(tr('trackers'))}</span><h3>${state.trackers.length}${state.ui.mode === 'edit' ? ` / ${MAX_TRACKERS}` : ''}</h3></div>${state.ui.mode === 'edit' ? `<button class="tableos-btn primary" type="button" data-os-action="add-tracker">${esc(tr('addTracker'))}</button>` : ''}</div>
    <div class="tableos-stack">${state.trackers.map(tracker => renderTracker(tracker)).join('') || `<p class="tableos-empty">${esc(tr('noTrackers'))}</p>`}</div>
  </section>`;
}

function renderTracker(tracker) {
  const entities = trackerEntityIds(state, tracker);
  const editor = state.ui.mode === 'edit' ? `<div class="tableos-module-head">
      <input class="tableos-title-input" value="${attr(tracker.name)}" data-os-tracker-name="${tracker.id}" maxlength="32">
      <select data-os-tracker-scope="${tracker.id}"><option value="global" ${tracker.scope === 'global' ? 'selected' : ''}>${esc(tr('global'))}</option><option value="participant" ${tracker.scope === 'participant' ? 'selected' : ''}>${esc(tr('participant'))}</option><option value="team" ${tracker.scope === 'team' ? 'selected' : ''}>${esc(tr('team'))}</option></select>
      <label>${esc(tr('persistence'))}<select data-os-tracker-persistence="${tracker.id}"><option value="session" ${tracker.persistence !== 'campaign' ? 'selected' : ''}>${esc(tr('sessionOnly'))}</option><option value="campaign" ${tracker.persistence === 'campaign' ? 'selected' : ''}>${esc(tr('campaignPersist'))}</option></select></label>
      <label>${esc(tr('step'))}<input type="number" min="1" max="9999" value="${tracker.step}" data-os-tracker-step="${tracker.id}"></label>
      <button class="tableos-mini danger" type="button" data-os-remove-tracker="${tracker.id}">×</button>
    </div>` : `<div class="tableos-live-head"><strong>${esc(tracker.name)}</strong><span>${esc(tracker.persistence === 'campaign' ? tr('campaignPersist') : tr('sessionOnly'))}</span></div>`;
  return `<article class="tableos-module">${editor}
    <div class="tableos-counter-grid">${entities.length ? entities.map(entityId => `<div class="tableos-counter"><span>${esc(entityName(tracker, entityId))}</span><div><button type="button" data-os-tracker-delta="${tracker.id}|${entityId}|-${tracker.step}">−</button><strong>${trackerValue(tracker, entityId)}</strong><button type="button" data-os-tracker-delta="${tracker.id}|${entityId}|${tracker.step}">+</button></div><input type="number" value="${trackerValue(tracker, entityId)}" min="${tracker.min}" max="${tracker.max}" data-os-tracker-value="${tracker.id}|${entityId}" aria-label="${attr(entityName(tracker, entityId))}"></div>`).join('') : `<p class="tableos-empty">${tracker.scope === 'team' ? esc(tr('noTeams')) : esc(tr('emptyParticipants'))}</p>`}</div>
  </article>`;
}

function renderPhases() {
  const active = state.phases.items[state.phases.activeIndex];
  return `<section class="tableos-card">
    <div class="tableos-card-head"><div><span>${esc(tr('phases'))}</span><h3>${active ? esc(active.name) : '—'} · ${esc(tr('cycle'))} ${state.phases.cycle}</h3></div>${state.ui.mode === 'edit' ? `<button class="tableos-btn primary" type="button" data-os-action="add-phase">${esc(tr('addPhase'))}</button>` : ''}</div>
    ${state.phases.items.length ? `<div class="tableos-phase-controls"><button class="tableos-btn" type="button" data-os-action="prev-phase">← ${esc(tr('previous'))}</button><button class="tableos-btn primary" type="button" data-os-action="next-phase">${esc(tr('next'))} →</button><button class="tableos-btn" type="button" data-os-action="open-timer">${esc(tr('openTimer'))}</button></div>` : ''}
    <div class="tableos-phase-list">${state.phases.items.map((phase, index) => state.ui.mode === 'edit' ? `<article class="tableos-phase ${index === state.phases.activeIndex ? 'active' : ''}"><button class="tableos-phase-index" type="button" data-os-phase-active="${index}">${index + 1}</button><div><input value="${attr(phase.name)}" data-os-phase-name="${phase.id}" maxlength="32"><input value="${attr(phase.note)}" data-os-phase-note="${phase.id}" maxlength="120" placeholder="${attr(tr('phaseNote'))}"></div><button class="tableos-mini danger" type="button" data-os-remove-phase="${phase.id}">×</button></article>` : `<article class="tableos-phase tableos-phase-live ${index === state.phases.activeIndex ? 'active' : ''}"><button class="tableos-phase-index" type="button" data-os-phase-active="${index}">${index + 1}</button><div><strong>${esc(phase.name)}</strong>${phase.note ? `<span>${esc(phase.note)}</span>` : ''}</div></article>`).join('') || `<p class="tableos-empty">${esc(tr('noPhases'))}</p>`}</div>
  </section>`;
}

function renderTeamsRoles() {
  if (state.ui.mode === 'play') return renderTeamsRolesPlay();
  return `<div class="tableos-grid two align-start">
    <section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('teams'))}</span><h3>${state.teams.length} / ${MAX_TEAMS}</h3></div><div class="tableos-inline-actions"><button class="tableos-btn" type="button" data-os-action="adopt-teams">${esc(tr('adoptTeams'))}</button><button class="tableos-btn primary" type="button" data-os-action="add-team">${esc(tr('addTeam'))}</button></div></div>
      ${state.teams.map(team => `<article class="tableos-team"><div class="tableos-module-head"><input value="${attr(team.name)}" data-os-team-name="${team.id}" maxlength="28"><button class="tableos-mini danger" type="button" data-os-remove-team="${team.id}">×</button></div><div class="tableos-check-grid">${state.participants.map(participant => `<label><input type="checkbox" data-os-team-member="${team.id}|${participant.id}" ${team.memberIds.includes(participant.id) ? 'checked' : ''}><span>${esc(participant.name)}</span></label>`).join('') || esc(tr('emptyParticipants'))}</div></article>`).join('') || `<p class="tableos-empty">${esc(tr('noTeams'))}</p>`}
    </section>
    <section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('role'))}</span><h3>${state.roles.length} / ${state.participants.length}</h3></div></div>
      <div class="tableos-stack">${state.participants.map(participant => { const role = roleForParticipant(state, participant.id) || { role: '', faction: '', note: '', secret: true }; return `<article class="tableos-role"><strong>${esc(participant.name)}</strong><div class="tableos-form-grid"><label>${esc(tr('role'))}<input value="${attr(role.role)}" data-os-role-name="${participant.id}" maxlength="40"></label><label>${esc(tr('faction'))}<input value="${attr(role.faction)}" data-os-role-faction="${participant.id}" maxlength="32"></label><label class="wide">${esc(tr('note'))}<input value="${attr(role.note)}" data-os-role-note="${participant.id}" maxlength="160"></label><label class="checkbox"><input type="checkbox" data-os-role-secret="${participant.id}" ${role.secret ? 'checked' : ''}> ${esc(tr('secret'))}</label></div><div class="tableos-inline-actions"><button class="tableos-btn" type="button" data-os-role-reveal="${participant.id}">${esc(tr('reveal'))}</button><button class="tableos-btn danger" type="button" data-os-role-clear="${participant.id}">${esc(tr('clear'))}</button></div></article>`; }).join('') || `<p class="tableos-empty">${esc(tr('emptyParticipants'))}</p>`}</div>
    </section>
  </div>`;
}

function renderTeamsRolesPlay() {
  return `<div class="tableos-grid two align-start">
    <section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('teams'))}</span><h3>${state.teams.length}</h3></div><button class="tableos-btn" type="button" data-os-action="adopt-teams">${esc(tr('adoptTeams'))}</button></div>${state.teams.map(team => `<article class="tableos-team tableos-team-live"><strong>${esc(team.name)}</strong><div>${team.memberIds.map(id => `<span>${esc(participantById(id)?.name || id)}</span>`).join('') || '—'}</div></article>`).join('') || `<p class="tableos-empty">${esc(tr('noTeams'))}</p>`}</section>
    <section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('role'))}</span><h3>${state.roles.length} / ${state.participants.length}</h3></div></div><div class="tableos-stack">${state.participants.map(participant => `<article class="tableos-role tableos-role-live"><strong>${esc(participant.name)}</strong><button class="tableos-btn" type="button" data-os-role-reveal="${participant.id}">${esc(tr('reveal'))}</button></article>`).join('') || `<p class="tableos-empty">${esc(tr('emptyParticipants'))}</p>`}</div></section>
  </div>`;
}

function renderScoreSheet() {
  return `<section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('score'))}</span><h3>${state.scoreSheet.fields.length}${state.ui.mode === 'edit' ? ` / ${MAX_SCORE_FIELDS}` : ''}</h3></div>${state.ui.mode === 'edit' ? `<div class="tableos-inline-actions"><button class="tableos-btn" type="button" data-os-action="add-score-field">${esc(tr('addScoreField'))}</button><button class="tableos-btn primary" type="button" data-os-action="add-formula-field">${esc(tr('addFormula'))}</button></div>` : ''}</div>
    ${state.ui.mode === 'edit' ? `<p class="tableos-help">${esc(tr('formulaHelp'))}</p>${state.scoreSheet.fields.length ? `<div class="tableos-score-config">${state.scoreSheet.fields.map(field => `<article><input value="${attr(field.name)}" data-os-score-name="${field.id}" maxlength="28"><input value="${attr(field.key)}" data-os-score-key="${field.id}" maxlength="24" aria-label="${attr(tr('key'))}">${field.kind === 'formula' ? `<input value="${attr(field.formula)}" data-os-score-formula="${field.id}" maxlength="120" placeholder="base + bonus">` : `<input type="number" min="1" max="9999" value="${field.step}" data-os-score-step="${field.id}" aria-label="${attr(tr('step'))}">`}<select data-os-score-effect="${field.id}"><option value="1" ${field.effect === 1 ? 'selected' : ''}>＋</option><option value="-1" ${field.effect === -1 ? 'selected' : ''}>−</option></select><label class="checkbox"><input type="checkbox" data-os-score-total="${field.id}" ${field.includeInTotal ? 'checked' : ''}>${esc(tr('included'))}</label><button class="tableos-mini danger" type="button" data-os-remove-score="${field.id}">×</button></article>`).join('')}</div>` : `<p class="tableos-empty">${esc(tr('noScoreFields'))}</p>`}` : ''}
    ${state.participants.length && state.scoreSheet.fields.length ? `<div class="tableos-score-table">${state.participants.map(participant => { const card = scoreCardForParticipant(state, participant.id); return `<article><header><strong>${esc(participant.name)}</strong><span>${esc(tr('total'))} <b>${card.total}</b></span></header><div class="tableos-score-values">${state.scoreSheet.fields.map(field => `<label><span>${esc(field.name)}</span>${field.kind === 'formula' ? `<output>${card.values[field.id] ?? 0}</output>` : `<input type="number" value="${card.values[field.id] ?? 0}" data-os-score-value="${participant.id}|${field.id}">`}</label>`).join('')}</div></article>`; }).join('')}</div>` : ''}
  </section>`;
}

function renderCampaign() {
  if (state.ui.mode === 'play') return `<section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('campaign'))}</span><h3>${esc(state.campaign.name || tr('campaign'))}</h3></div><strong>${esc(tr('sessionNumber'))} ${state.campaign.sessionNumber}</strong></div>${state.campaign.chapter ? `<p><strong>${esc(state.campaign.chapter)}</strong></p>` : ''}${state.campaign.notes ? `<p class="tableos-campaign-notes">${esc(state.campaign.notes)}</p>` : ''}<div class="tableos-card-head sub"><div><span>${esc(tr('flags'))}</span><h3>${state.campaign.flags.filter(flag => flag.checked).length} / ${state.campaign.flags.length}</h3></div></div><div class="tableos-flag-list">${state.campaign.flags.map(flag => `<div class="tableos-flag-live"><label><input type="checkbox" data-os-flag-toggle="${flag.id}" ${flag.checked ? 'checked' : ''}><span>${esc(flag.name)}</span></label></div>`).join('') || `<p class="tableos-empty">${esc(tr('noFlags'))}</p>`}</div></section>`;
  return `<section class="tableos-card"><div class="tableos-card-head"><div><span>${esc(tr('campaign'))}</span><h3>${state.campaign.enabled ? esc(state.campaign.name || tr('campaign')) : 'OFF'}</h3></div><label class="tableos-switch"><input type="checkbox" data-os-campaign-enabled ${state.campaign.enabled ? 'checked' : ''}><span>${esc(tr('campaignEnabled'))}</span></label></div><div class="tableos-form-grid campaign-form"><label>${esc(tr('campaignName'))}<input value="${attr(state.campaign.name)}" data-os-campaign="name" maxlength="60"></label><label>${esc(tr('chapter'))}<input value="${attr(state.campaign.chapter)}" data-os-campaign="chapter" maxlength="60"></label><label>${esc(tr('sessionNumber'))}<input type="number" min="1" max="9999" value="${state.campaign.sessionNumber}" data-os-campaign="sessionNumber"></label><label class="wide">${esc(tr('notes'))}<textarea rows="6" maxlength="4000" data-os-campaign="notes">${esc(state.campaign.notes)}</textarea></label></div><div class="tableos-card-head sub"><div><span>${esc(tr('flags'))}</span><h3>${state.campaign.flags.filter(flag => flag.checked).length} / ${state.campaign.flags.length}</h3></div><button class="tableos-btn" type="button" data-os-action="add-flag">${esc(tr('addFlag'))}</button></div><div class="tableos-flag-list">${state.campaign.flags.map(flag => `<div><label><input type="checkbox" data-os-flag-toggle="${flag.id}" ${flag.checked ? 'checked' : ''}><input value="${attr(flag.name)}" data-os-flag-name="${flag.id}" maxlength="50"></label><button class="tableos-mini danger" type="button" data-os-flag-remove="${flag.id}">×</button></div>`).join('') || `<p class="tableos-empty">${esc(tr('noFlags'))}</p>`}</div></section>`;
}

function renderRoleReveal(participantId) {
  const participant = participantById(participantId);
  if (!participant) return '';
  const role = roleForParticipant(state, participantId);
  if (!revealArmed) return `<div class="tableos-secret" role="dialog" aria-modal="true" aria-label="${attr(tr('revealFor'))}" tabindex="-1"><div><p>${esc(tr('revealFor'))}</p><h3>${esc(participant.name)}</h3><p class="tableos-secret-warning">${esc(tr('passDevice'))}</p><button class="tableos-btn primary wide" type="button" data-os-action="reveal-role-now">${esc(tr('revealNow'))}</button><button class="tableos-btn wide" type="button" data-os-action="hide-role">${esc(tr('close'))}</button></div></div>`;
  return `<div class="tableos-secret" role="dialog" aria-modal="true" aria-label="${attr(tr('revealFor'))}" tabindex="-1"><div><p>${esc(tr('revealFor'))}</p><h3>${esc(participant.name)}</h3><div class="tableos-secret-role"><strong>${esc(role?.role || tr('noRole'))}</strong>${role?.faction ? `<span>${esc(role.faction)}</span>` : ''}</div><p class="tableos-secret-warning">${esc(tr('moderatorNoteHidden'))}</p><button class="tableos-btn primary wide" type="button" data-os-action="hide-role">${esc(tr('hide'))}</button></div></div>`;
}

function saveAndRender() {
  touch(state);
  persist();
  render();
}

function setRolePart(participantId, part, value) {
  const current = roleForParticipant(state, participantId) || { role: '', faction: '', note: '', secret: true };
  setRole(state, participantId, { ...current, [part]: value });
}

function mutateTracker(trackerId, patch) {
  const tracker = state.trackers.find(item => item.id === trackerId);
  if (!tracker) return;
  Object.assign(tracker, patch);
  tracker.min = Number.isFinite(Number(tracker.min)) ? Number(tracker.min) : 0;
  tracker.max = Number.isFinite(Number(tracker.max)) ? Math.max(tracker.min, Number(tracker.max)) : 999999;
  tracker.step = Math.max(1, Math.round(Number(tracker.step) || 1));
}

function mutateScoreField(fieldId, patch) {
  const field = state.scoreSheet.fields.find(item => item.id === fieldId);
  if (!field) return;
  Object.assign(field, patch);
}

function applyTemplate(templateId, confirmReset = true) {
  if (confirmReset && hasConfiguredWorkspace() && !confirm(tr('confirmTemplate'))) return false;
  selectedTemplateId = templateId;
  applyAssistantTemplate(state, templateId, { preserveParticipants: true });
  persist();
  render();
  return true;
}

function adoptRandomTeams() {
  const game = readGameState();
  const sourceTeams = Array.isArray(game?.tools?.teams) ? game.tools.teams : [];
  if (!sourceTeams.length) { flash(tr('noRandomTeams')); return; }
  const bySource = new Map(state.participants.filter(item => item.sourcePlayerId).map(item => [item.sourcePlayerId, item.id]));
  state.teams = [];
  sourceTeams.slice(0, MAX_TEAMS).forEach((sourceTeam, index) => {
    const team = addTeam(state, locale() === 'zh' ? `${index + 1}队` : `Team ${index + 1}`);
    if (!team) return;
    team.memberIds = (Array.isArray(sourceTeam.playerIds) ? sourceTeam.playerIds : []).map(id => bySource.get(String(id))).filter(Boolean);
  });
  persist();
  flash(tr('teamsAdopted'));
}

async function exportState() {
  const blob = new Blob([serializeTableOsState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `boardgame-table-os-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  flash(tr('exported'));
}

async function importFile(file) {
  if (!file) return;
  try {
    state = parseTableOsState(await file.text());
    selectedTemplateId = state.appliedTemplateId;
    persist();
    flash(tr('imported'));
  } catch (_) {
    flash(tr('importFailed'));
  }
}

function bindEvents() {
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-os-action],[data-os-mode],[data-os-section],[data-os-quick-template],[data-os-remove-participant],[data-os-tracker-delta],[data-os-remove-tracker],[data-os-phase-active],[data-os-remove-phase],[data-os-remove-team],[data-os-role-reveal],[data-os-role-clear],[data-os-remove-score],[data-os-flag-toggle],[data-os-flag-remove]') : null;
    if (!target) return;
    const d = target.dataset;
    if (d.osAction === 'close') { if (event.target.closest('.tableos-sheet') && !event.target.closest('[data-os-action="close"]')) return; closeTableOs(); return; }
    if (d.osAction === 'hide-role') { closeRoleReveal(); return; }
    if (d.osAction === 'reveal-role-now') { revealArmed = true; render(); focusRoleReveal(); return; }
    if (d.osMode) { state.ui.mode = d.osMode === 'edit' ? 'edit' : 'play'; state.ui.activeSection = 'overview'; saveAndRender(); return; }
    if (d.osSection) { state.ui.activeSection = d.osSection; saveAndRender(); return; }
    if (d.osQuickTemplate) { applyTemplate(d.osQuickTemplate, false); return; }
    if (d.osAction === 'sync') { syncParticipantsFromGame(state, readGamePlayers()); persist(); flash(tr('synced')); return; }
    if (d.osAction === 'apply-template') { applyTemplate(selectedTemplateId, true); return; }
    if (d.osAction === 'reset') { if (confirm(tr('confirmReset'))) { resetTableOsSession(state); persist(); render(); } return; }
    if (d.osAction === 'export') { exportState(); return; }
    if (d.osAction === 'import') { document.getElementById('tableos-import-file')?.click(); return; }
    if (d.osAction === 'open-timer') { isOpen = false; render(); document.querySelector('[data-tab="flow"]')?.click(); return; }
    if (d.osAction === 'adopt-teams') { adoptRandomTeams(); return; }
    if (d.osAction === 'add-participant') { if (!addParticipant(state, tr('customParticipant'))) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osRemoveParticipant) { removeParticipant(state, d.osRemoveParticipant); persist(); render(); return; }
    if (d.osAction === 'add-tracker') { if (!addTracker(state, { name: tr('customTracker') })) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osRemoveTracker) { removeTracker(state, d.osRemoveTracker); persist(); render(); return; }
    if (d.osTrackerDelta) { const [trackerId, entityId, delta] = d.osTrackerDelta.split('|'); adjustTracker(state, trackerId, entityId, Number(delta)); persist(); render(); return; }
    if (d.osAction === 'add-phase') { if (!addPhase(state, tr('customPhase'))) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osAction === 'prev-phase') { advancePhase(state, -1); persist(); render(); return; }
    if (d.osAction === 'next-phase') { advancePhase(state, 1); persist(); render(); return; }
    if (d.osPhaseActive !== undefined) { setActivePhase(state, Number(d.osPhaseActive)); persist(); render(); return; }
    if (d.osRemovePhase) { removePhase(state, d.osRemovePhase); persist(); render(); return; }
    if (d.osAction === 'add-team') { if (!addTeam(state, tr('customTeam'))) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osRemoveTeam) { removeTeam(state, d.osRemoveTeam); persist(); render(); return; }
    if (d.osRoleReveal) { roleRevealReturnId = d.osRoleReveal; revealedParticipantId = d.osRoleReveal; revealArmed = false; render(); focusRoleReveal(); return; }
    if (d.osRoleClear) { clearRole(state, d.osRoleClear); persist(); render(); return; }
    if (d.osAction === 'add-score-field') { if (!addScoreSheetField(state, { name: tr('customField'), key: `field_${state.scoreSheet.fields.length + 1}` })) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osAction === 'add-formula-field') { if (!addScoreSheetField(state, { name: tr('customFormula'), key: `calc_${state.scoreSheet.fields.length + 1}`, kind: 'formula', formula: '', includeInTotal: false })) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osRemoveScore) { removeScoreSheetField(state, d.osRemoveScore); persist(); render(); return; }
    if (d.osAction === 'add-flag') { if (!addCampaignFlag(state, tr('customFlag'))) flash(tr('limit')); else { persist(); render(); } return; }
    if (d.osFlagToggle) { toggleCampaignFlag(state, d.osFlagToggle); persist(); render(); return; }
    if (d.osFlagRemove) { removeCampaignFlag(state, d.osFlagRemove); persist(); render(); }
  });

  document.addEventListener('change', event => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;
    const d = element.dataset;
    if (d.osTemplate !== undefined) { selectedTemplateId = element.value; render(); return; }
    if (element.id === 'tableos-import-file') { importFile(element.files?.[0]); element.value = ''; return; }
    if (d.osParticipantName) { renameParticipant(state, d.osParticipantName, element.value); persist(); return; }
    if (d.osTrackerName) { mutateTracker(d.osTrackerName, { name: element.value.trim().slice(0, 32) || tr('customTracker') }); saveAndRender(); return; }
    if (d.osTrackerScope) { mutateTracker(d.osTrackerScope, { scope: ['global', 'participant', 'team'].includes(element.value) ? element.value : 'global', values: {} }); saveAndRender(); return; }
    if (d.osTrackerPersistence) { setTrackerPersistence(state, d.osTrackerPersistence, element.value); persist(); render(); return; }
    if (d.osTrackerStep) { mutateTracker(d.osTrackerStep, { step: element.value }); saveAndRender(); return; }
    if (d.osTrackerValue) { const [trackerId, entityId] = d.osTrackerValue.split('|'); setTrackerValue(state, trackerId, entityId, Number(element.value)); persist(); render(); return; }
    if (d.osPhaseName) { const phase = state.phases.items.find(item => item.id === d.osPhaseName); if (phase) phase.name = element.value.trim().slice(0, 32) || tr('customPhase'); saveAndRender(); return; }
    if (d.osPhaseNote) { const phase = state.phases.items.find(item => item.id === d.osPhaseNote); if (phase) phase.note = element.value.trim().slice(0, 120); persist(); return; }
    if (d.osTeamName) { const team = state.teams.find(item => item.id === d.osTeamName); if (team) team.name = element.value.trim().slice(0, 28) || tr('customTeam'); saveAndRender(); return; }
    if (d.osTeamMember) { const [teamId, participantId] = d.osTeamMember.split('|'); toggleTeamMember(state, teamId, participantId); persist(); render(); return; }
    if (d.osRoleName) { setRolePart(d.osRoleName, 'role', element.value); persist(); return; }
    if (d.osRoleFaction) { setRolePart(d.osRoleFaction, 'faction', element.value); persist(); return; }
    if (d.osRoleNote) { setRolePart(d.osRoleNote, 'note', element.value); persist(); return; }
    if (d.osRoleSecret) { setRolePart(d.osRoleSecret, 'secret', element.checked); persist(); return; }
    if (d.osScoreName) { mutateScoreField(d.osScoreName, { name: element.value.trim().slice(0, 28) || tr('customField') }); saveAndRender(); return; }
    if (d.osScoreKey) { mutateScoreField(d.osScoreKey, { key: element.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || 'field' }); saveAndRender(); return; }
    if (d.osScoreFormula) { mutateScoreField(d.osScoreFormula, { formula: element.value.trim().slice(0, 120) }); saveAndRender(); return; }
    if (d.osScoreStep) { mutateScoreField(d.osScoreStep, { step: Math.max(1, Math.round(Number(element.value) || 1)) }); saveAndRender(); return; }
    if (d.osScoreEffect) { mutateScoreField(d.osScoreEffect, { effect: Number(element.value) === -1 ? -1 : 1 }); saveAndRender(); return; }
    if (d.osScoreTotal) { mutateScoreField(d.osScoreTotal, { includeInTotal: element.checked }); saveAndRender(); return; }
    if (d.osScoreValue) { const [participantId, fieldId] = d.osScoreValue.split('|'); setScoreSheetValue(state, participantId, fieldId, Number(element.value)); persist(); render(); return; }
    if (d.osCampaignEnabled !== undefined) { state.campaign.enabled = element.checked; saveAndRender(); return; }
    if (d.osCampaign) { const key = d.osCampaign; state.campaign[key] = key === 'sessionNumber' ? Math.max(1, Math.round(Number(element.value) || 1)) : element.value.slice(0, key === 'notes' ? 4000 : 60); saveAndRender(); return; }
    if (d.osFlagName) { const flag = state.campaign.flags.find(item => item.id === d.osFlagName); if (flag) flag.name = element.value.trim().slice(0, 50) || tr('customFlag'); saveAndRender(); }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Tab' && isOpen) { trapModalFocus(event); return; }
    if (event.key === 'Escape' && revealedParticipantId) { event.preventDefault(); closeRoleReveal(); return; }
    if (event.key === 'Escape' && isOpen) { event.preventDefault(); closeTableOs(); }
  });

  window.addEventListener('pagehide', flushActiveDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushActiveDraft();
  });
}

initializeParticipants();
persist();
bindEvents();
render();

const languageObserver = new MutationObserver(() => render());
languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
