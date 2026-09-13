from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/tabletop.js',
    "  addTeam, replaceTeams, removeTeam, toggleTeamMember, setRole, clearRole, roleForParticipant,\n",
    "  addTeam, replaceTeams, removeTeam, toggleTeamMember, setRole, replaceCharacterAssignmentsFromText, clearRole, roleForParticipant,\n"
)

replace_once(
    'src/tabletop.js',
    "    addTeam: '添加团队', noTeams: '当前没有团队。', members: '成员', role: '身份', faction: '阵营', secret: '私密', note: '主持备注', reveal: '交给玩家查看', hide: '看完了', clear: '清除',\n",
    "    addTeam: '添加团队', noTeams: '当前没有团队。', members: '成员', role: '身份', faction: '阵营', secret: '私密', note: '主持备注', reveal: '交给玩家查看', hide: '看完了', clear: '清除', bulkCharacters: '批量设置身份', bulkCharactersHelp: '每行对应一位参与者（按当前顺序）；可写“身份 | 阵营”或用制表符分隔。应用后会替换全部身份/阵营并清除旧主持备注；玩家查看流程保持不变。', bulkCharactersPlaceholder: '预言家 | 村民\\n狼人 | 狼人阵营\\n守卫 | 村民', replaceCharacters: '替换身份列表', charactersReplaced: '已批量设置身份：', bulkCharactersEmpty: '没有可应用的身份。', confirmBulkCharacters: '这会替换全部现有身份/阵营并清除旧主持备注。继续吗？',\n"
)

replace_once(
    'src/tabletop.js',
    "    addTeam: 'Add team', noTeams: 'No teams yet.', members: 'Members', role: 'Role', faction: 'Faction', secret: 'Private', note: 'Moderator note', reveal: 'Pass to player', hide: 'Done', clear: 'Clear',\n",
    "    addTeam: 'Add team', noTeams: 'No teams yet.', members: 'Members', role: 'Role', faction: 'Faction', secret: 'Private', note: 'Moderator note', reveal: 'Pass to player', hide: 'Done', clear: 'Clear', bulkCharacters: 'Paste character list', bulkCharactersHelp: 'One line per participant in current order. Use “Role | Faction” or a tab separator. Applying replaces all assignments and clears old moderator notes; player reveal behavior stays unchanged.', bulkCharactersPlaceholder: 'Seer | Town\\nWolf | Wolves\\nGuard | Town', replaceCharacters: 'Replace character list', charactersReplaced: 'Assignments applied:', bulkCharactersEmpty: 'No assignments to apply.', confirmBulkCharacters: 'This replaces all existing assignments and clears old moderator notes. Continue?',\n"
)

replace_once(
    'src/tabletop.js',
    """    <section class=\"tableos-card\"><div class=\"tableos-card-head\"><div><span>${esc(tr('role'))}</span><h3>${state.roles.length} / ${state.participants.length}</h3></div></div>\n      <div class=\"tableos-stack\">""",
    """    <section class=\"tableos-card\"><div class=\"tableos-card-head\"><div><span>${esc(tr('role'))}</span><h3>${state.roles.length} / ${state.participants.length}</h3></div></div>\n      <details class=\"tableos-module\"><summary><strong>${esc(tr('bulkCharacters'))}</strong></summary><p class=\"tableos-help\">${esc(tr('bulkCharactersHelp'))}</p><textarea rows=\"6\" maxlength=\"2600\" data-os-bulk-characters aria-label=\"${attr(tr('bulkCharacters'))}\" placeholder=\"${attr(tr('bulkCharactersPlaceholder'))}\"></textarea><div class=\"tableos-inline-actions\"><button class=\"tableos-btn primary\" type=\"button\" data-os-action=\"replace-characters\">${esc(tr('replaceCharacters'))}</button></div></details>\n      <div class=\"tableos-stack\">"""
)

replace_once(
    'src/tabletop.js',
    """    if (d.osRemoveTeam) { removeTeam(state, d.osRemoveTeam); persist(); render(); return; }\n    if (d.osRoleReveal) { roleRevealReturnId = d.osRoleReveal; revealedParticipantId = d.osRoleReveal; revealArmed = false; render(); focusRoleReveal(); return; }\n""",
    """    if (d.osRemoveTeam) { removeTeam(state, d.osRemoveTeam); persist(); render(); return; }\n    if (d.osAction === 'replace-characters') {\n      const input = document.querySelector('[data-os-bulk-characters]');\n      const raw = input instanceof HTMLTextAreaElement ? input.value : '';\n      if (!raw.split(/\\r?\\n/).some(line => line.trim())) { flash(tr('bulkCharactersEmpty')); return; }\n      if (state.roles.length && !confirm(tr('confirmBulkCharacters'))) return;\n      const result = replaceCharacterAssignmentsFromText(state, raw);\n      if (!result.changed) { flash(tr('bulkCharactersEmpty')); return; }\n      persist();\n      flash(`${tr('charactersReplaced')} ${result.assigned}${result.limitReached ? ` · ${tr('limit')}` : ''}`);\n      return;\n    }\n    if (d.osRoleReveal) { roleRevealReturnId = d.osRoleReveal; revealedParticipantId = d.osRoleReveal; revealArmed = false; render(); focusRoleReveal(); return; }\n"""
)
