# 游戏图鉴首版：实现与发布边界

## 已实现与未实现

本轮新增浏览器／原生 WebView 共用的中英双语「游戏图鉴」入口，提供搜索、材料类别（零道具／普通材料／可自制／可打印）、人数筛选、详情教学结构和已有通用工具跳转。所有 JS/CSS 模块随 PWA shell 离线缓存；不创建账号或新的本地存储 key。

**目前公开图鉴为零条。** `src/game-library-data.js` 只有空数组；这不是接口故障，也不代表所有桌游均不能收录，而是尚无一条经真实来源审阅、分项权利审查和线下试玩验证的具体条目。界面如实展示空状态，并允许直接打开已经上线的通用私密发牌或 Table OS。不能将本文件或单元测试中的合成测试条目当成已审核游戏。

## 记录结构与发布门禁

`src/game-library-core.js` 的 `isPublishableGame` 是**默认拒绝**的客户端防线，编辑审核过程仍应由人执行并通过 PR 留证：

- `id` 为稳定 slug；`material` 取 `none` / `everyday` / `diy` / `printable`。`players`、`duration` 含明确范围；`duration.basis` 区分编辑估计与试玩记录；`age.min` 配中英文年龄依据。
- `copy.zh` 和 `copy.en` 均须有名称、简介、目标、材料／替代、准备步骤、回合步骤、结束条件、原创例子、年龄依据、场地和可访问性说明。不得把未经核查的第三方原文机器翻译后冒充原创教学。
- `tools` 只能引用现有通用能力 `timer`、`score`、`random`、`secret-dealer`、`table-os`；这只是链接，不是自动规则执行。
- `provenance.description` 和逐个外部来源的 HTTPS URL／访问日期／使用目的用于追踪背景事实。自行设计的原创机制也需记录可回溯的创作过程，不必捏造第三方来源。
- `rights` 分别审核 `name`、`teaching`、`example`、`visuals`。每个实际使用的部分须有 `basis`（原创／获许可／有文档支持的公有领域）、权利人、证据、商用／再分发／改编范围；完全不用视觉素材时明确 `visuals: { basis: 'not-used', used: false, evidence: '...' }`；`jurisdiction` 不得为空，`concerns` 必须为空。
- `review.status === 'ready'` 且 `approved === true`，审阅者与撰写者须不同，填审阅日期；`review.playtest` 须有真实完结状态、测试者、日期和记录依据。**不能编造审核人或实际试玩。**
- 公开列表对原始记录执行 `publishedGames` 过滤和去重，只返回有限的教学／元数据字段，内部 rights、review、provenance 不会作为公开详情自动展示。数据文件须在 PR 中人工审阅，不能由 localStorage／投稿自动注入。

当前客户端检验不构成法律意见或可以取代人工审核的机器认证。若日后引入服务端投稿或远程目录，还须在服务器端重新实施同等或更严格的审核发布权限，而非信任前端布尔字段。

## 首条游戏上线前的手工核对

1. 选一个零道具或日常材料候选，先写 `draft`；记录玩法出处与可核实事实，原创撰写双语教程和示例。游戏名称与品牌冲突、原版规则文本、图／卡／词库分别检查；无法核实则保留 `rights-review` 或 `blocked`。
2. 由**另一名实际审阅者**逐项核对证据与地域／商用／署名条款；由真实参与者完成试玩，记录人数、时长、可访问性和存在的问题。未实测的时长仍可标记为编辑估计，但不可谎称试玩。
3. 在 PR 中附记录与对应证据链接，审查产品及法律疑虑；只有审阅完成后才将该条放入 `GAME_LIBRARY_ENTRIES` 且标为 `ready`。不应引用或再发布第三方规则书／卡牌／词库。
4. 运行 `npm run check`，验证单元审核门禁、中文／英文、320px 与 390px、通用工具跳转以及子路径离线；正式 PR CI 六项、合并后 master CI 六项和 Pages 三项均通过后，才称网页功能部署完成。真实 Android/iOS 上架仍须独立完成 Release Gate #14。

参考性资料：美国版权局的 [Games 说明](https://www.copyright.gov/register/tx-games.html) 区分玩法方法与可受保护的特定文字和图画表达；该说明只涉及美国版权语境，不代表对任何具体游戏的商标、专利、其他地区法律或授权作出结论。完整编辑要求见 `docs/GAME_LIBRARY_EDITORIAL.md`，总任务见 Issue #53。
