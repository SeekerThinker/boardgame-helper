# AGENTS.md — 桌游助手协作与接手约定

这是一份**针对软件产品的轻量约定**，参考 [Human–AI Research Collaboration Protocol (HARC)](https://github.com/ChongLiuPhil/Human-AI-Research-Collaboration-Protocol) 的可交接、状态可追溯、提议与批准分离思路。**并未整体采用 HARC，也没有复制或重新许可其协议文本。**不要求学术论文框架、研究论证图、完整双语文档镜像或冗长接手报告。

## 开始工作前：从当前仓库恢复状态

1. 读取 `README.md` 了解产品与现有命令；读取 `docs/PROJECT_STATE.md` 找当前重点、阻塞和任务链接；如涉及产品方向，读取 `docs/DECISIONS.md`。
2. 按任务**选择性**读取对应资料：图鉴看 `docs/GAME_LIBRARY_EDITORIAL.md`、`docs/GAME_LIBRARY_IMPLEMENTATION.md` 与 `editorial/candidates/`；Table OS 看 `TABLE_OS.md` 与 `docs/TABLE_OS_TEST_MATRIX.md`；商店发布看 `STORE_RELEASE_CHECKLIST.md` 与 [Issue #14](https://github.com/SeekerThinker/boardgame-helper/issues/14)。
3. 通过 GitHub **重新检查最新 `master`、相关 Issue/PR 与 CI 结果**。文件中的日期、提交号和会话摘要都可能过期；不要把聊天记忆、旧日志或 CI 历史当作当前真值。若状态冲突，标注差异并核实，不要自行覆盖。
4. 向人类简要说明任务目标、可做的下一步及真正受阻的事项即可；不必照搬 HARC 的研究型 onboarding 表单。

## 产品与安全约束

- 面向线下聚会的**本机优先、可离线**工具：主页「选游戏／桌面 OS／工具箱」同级；图鉴以点选为主；通用私密发牌有无需手动录入的内置分配方式，自定义仅是可选项。
- 私密发牌只在当前页面内存维护本次秘密，交设备 → 主动揭示 → 遮蔽；不要让角色、词语、主持秘密进入公开 DOM、日志、分析、网络、浏览器持久存储或 Table OS 备份。现有持久化与导出功能可能包含其他敏感内容，修改前分别核查其现有披露与确认行为；不能保证设备截图、窥屏或内存物理擦除。
- 游戏图鉴**只公开真实审核完成的条目**：每条分别记录来源及名称、教学、示例、图像／卡面／词库的权利依据，由不同于作者的真人复核并完成真实试玩。AI 检索、生成、测试或 PR 绿色**都不能冒充**人类授权、实际试玩或法律结论；保持未审草稿不进入 `src/game-library-data.js` 或 `dist/`。不要直接移植现成规则书、牌组或第三方词库。
- 不假设某个具名游戏、传统玩法的具体表达或品牌当然可自由使用。许可、商用范围和不同适用地区的问题未核实时保持待审状态，必要时交权利人／合格专业人士决定。
- 不把 GitHub Pages 预览描述成已迁 Cloudflare；跨域迁移可能影响浏览器本地存档。未完成真实 Android 签名、iOS 真机／证书与商店提交前，不宣称正式移动版上架或自行更改公开版本／tag。项目软件及图鉴内容的开放许可尚无明确决定；**不要自行创建 LICENSE、宣称开源授权或导入未确认许可的协议文本。**

## 谁决定什么；何时算完成

- **人类明确提出／接受的产品决定**：整理进 `docs/DECISIONS.md`，保留日期与依据；重大未明确事项标记为 `待人类决定`。**AI 的推断／提议**要清晰标成建议，不得写成已批准的产品政策或内容发布许可。
- GitHub `master` 上的代码、测试、仓库文档是当前实现证据；Issue / PR 保存动态工作与历史证据。`docs/PROJECT_STATE.md` 仅是**带日期的导航索引**，不要另造第二套需要双向同步的任务数据库。每轮重大 PR 合并后更新受影响状态，回查 Issue / PR，而非复制不断增长的历史清单。
- 使用聚焦分支和 PR，说明行为变化、风险、测试和未完成项。代码／隐私变更运行 `npm run check`，核验 PR 的 `audit`、`check`、`store-assets`、`android`、`ios`、`release-candidate` 六项；合并后再验同提交的 `master` CI 和 Pages 的 `build`、`deploy`、`smoke`。CI 是自动验证，**不是**内容编辑审核、真实商店签名或真人设备体验。
- 具体游戏公开需要另一个真人编辑审阅者和真实试玩证据；法律和许可疑问由相应责任人决定。PR 合并／网页部署不自动代表具体候选获得内容发布许可。
- `master` 分支保护及 required checks 应由拥有相关仓库管理权限的人配置并验证；模板文件本身不强制审批。不得声称尚未配置的保护已生效。

## 维护边界

`README.md` 描述产品、开发和入口；`docs/DECISIONS.md` 只记重要决定；`docs/PROJECT_STATE.md` 只记当前焦点和可信链接；各领域细节保留在原有设计、审查、测试和 Issue 中。不为了形式重复历史、复制整套外部协议或给每个文件强制增加英文镜像。**用户界面与正式游戏教学仍须保持中英双语。**
