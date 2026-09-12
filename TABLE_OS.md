# Table OS 高级桌游助手

Table OS 是桌游助手的高级工作台层，用来覆盖普通计时/计分之外的桌面 bookkeeping：任意状态追踪、阶段流程、团队、私密身份、公式计分表和跨局战役记录。

## 设计原则

1. **不替代实体桌游本身**：棋盘、卡牌、谈判和面对面互动仍留在桌面；数字层只接管容易出错或反复记忆的状态。
2. **离线优先**：全部数据写入设备本地 `localStorage`，不需要账号、云服务或联网。
3. **不破坏原有稳定核心**：Table OS 使用独立状态模型和存储键，与现有计时/计分对局状态解耦；可从当前对局同步玩家名单。
4. **机制优先于单款游戏硬编码**：模板是可编辑的机制型工作流起点，不复制完整规则，也不把产品锁死在某几款游戏上。
5. **安全公式**：高级计分公式使用自建算术解析器，只允许变量、数字、四则运算和括号，不调用 `eval` / `Function`，不能执行任意 JavaScript。

## 当前能力

### Universal Tracker

- 最多 24 个追踪器。
- 三种作用域：公共、每位参与者、每个团队。
- 每个追踪器支持初始值、最小值、最大值和步长。
- 适合生命、威胁、资源、金币、经验、影响力、声望、Boss HP、公共供应等状态。

### Phase Engine

- 最多 20 个阶段。
- 可编辑阶段名与主持备注。
- 上一步 / 下一步循环推进。
- 自动维护 cycle 计数，适用于轮次、阶段制和昼夜流程。

### Teams & Private Roles

- Table OS 参与者上限 32，覆盖大型主持型桌游。
- 可从主应用同步当前玩家，也可额外添加只属于高级助手的参与者。
- 最多 8 个团队，成员可自由交叉配置。
- 每位参与者可设置身份、阵营、主持备注和“私密”属性。
- 私密查看使用全屏遮罩，方便 pass-the-phone 场景。

### ScoreSheet v2

- 最多 16 个高级计分栏位。
- 手工栏位与公式栏位可以混合。
- 每个栏位可以正向或负向计入总分，也可以设为“仅显示、不重复计总分”。
- 公式变量通过栏位 key 引用，例如：`base + bonus + objective - penalty`。
- 支持 `+ - * / ( )`；非法 token、函数调用和除零会安全失败为 0，而不会执行代码。

### Campaign / Legacy Memory

- 可记录战役名称、章节/场景、局数和跨局长备注。
- 最多 40 个检查点 / 解锁项。
- “新场景 / 下一局”会清空局内追踪值、角色和高级计分值，但保留战役名称、备注和检查点，并把战役局数 +1。

### Mechanism Templates

当前内置九组可编辑模板：

- 通用桌游
- 引擎构筑 / 终局计分
- 交易 / 网络 / 经济
- 合作 / 危机管理
- 非对称阵营 / 冲突
- 隐藏身份 / 主持
- 卡牌战斗 / 生命状态
- 战役 / Legacy
- 聚会 / 分队 / 竞猜

模板只初始化常见阶段、追踪器、团队数量和高级计分字段；用户之后可以自由编辑。

## 状态与存储

主应用当前对局仍使用 `board-game-assistant-state-v2`。Table OS 使用独立键：

```text
board-game-assistant-table-os-v1
```

Table OS 状态包含：

```text
participants
trackers
phases
teams
roles
scoreSheet
campaign
ui
```

参与者可以记录 `sourcePlayerId`，因此从主应用重复同步时，同一位玩家能保持稳定的 Table OS participant id；只属于高级助手的额外参与者不会被同步操作删除。

## 导入 / 导出

高级助手可以导出 JSON，也可以重新导入。导入时会通过 `normalizeTableOsState()` 清理非法字段、上限和悬空引用，避免损坏状态。

角色和主持备注可能包含隐藏信息，因此导出的 JSON 应由用户自行妥善保存，不建议公开上传。

## 测试门禁

`npm run check` 会覆盖：

- `tests/unit/tabletop-core.test.js`
  - 玩家同步与 32 人上限
  - 模板应用
  - 三类 tracker
  - phase cycle
  - team / role 引用清理
  - 安全公式解析
  - ScoreSheet v2
  - campaign reset
  - 序列化 / 反序列化
- `tests/e2e/run-table-os-e2e.js`
  - 手机尺寸真实 Chromium
  - 主对局玩家同步
  - 模板应用
  - tracker 实际加减
  - phase 实际推进
  - team membership
  - 私密身份 reveal
  - 公式计分实时结果
  - campaign 跨刷新持久化
  - 中英文动态切换
- 原有根路径 E2E、子路径 PWA / Service Worker / 离线回归、Android、iOS、商店素材与 Release Candidate 门禁继续保留。

## 后续整合方向

Table OS 当前有意作为独立稳定层上线。下一阶段可以在保持数据兼容的前提下进一步整合：

1. 将主应用的普通计分字段映射到 ScoreSheet v2。
2. 让 Phase Engine 可选绑定主计时器，为每个 phase 保存独立时长。
3. 把 Table OS 摘要写入历史对局 archive。
4. 为常用自定义配置增加“保存我的模板”。
5. 增加 JSON / CSV 对局数据导出与可选统计视图。
