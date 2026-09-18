# 桌游助手：关键决定与未决事项

本日志记录**能够追溯的人类明确方向与决定**，并指向实现证据；不倒填没有依据的审批人、发版许可或历史日期。代码状态、任务清单与具体审查细节分别以 `master`、Issue/PR 和领域文档为准。未来新决定按日期追加；若修订旧决定，另记替代关系，不静默改写历史。

## 2026-09-18 — 已有明确产品反馈

**决定 D-001（产品／呈现）：图鉴、桌面 OS、工具箱是同级的重要入口。** 用户明确指出游戏图鉴和桌面 OS 不应藏在小侧边入口，允许整合或并列；落地为主页并列主栏目。实现记录：[PR #56](https://github.com/SeekerThinker/boardgame-helper/pull/56)。这记录了用户的目标和已实现的设计，**不把当前每一个像素和颜色视为永久获批的设计规范**。

**决定 D-002（产品／交互）：选游戏以选择为主，非搜索驱动。** 用户要求图鉴以选择代替主要搜索；材料和人数点选见 [PR #56](https://github.com/SeekerThinker/boardgame-helper/pull/56)、[PR #57](https://github.com/SeekerThinker/boardgame-helper/pull/57)。文字搜索可作为辅助，进一步类型或玩法维度仍可迭代。

**决定 D-003（产品／隐私）：秘密发牌应开箱即用，不强制输入牌面。** 用户明确提出内置发牌；已加入无需录入的**通用原创分配预设**，自定义内容保留为选项。此决定**不构成**对《狼人杀》《谁是卧底》等具名游戏角色、原版规则、词库、标识和素材的授权。实现记录：[PR #56](https://github.com/SeekerThinker/boardgame-helper/pull/56)，审查边界见 `docs/GAME_LIBRARY_EDITORIAL.md`。

**决定 D-004（协作方式）：参考 HARC，调整本项目文件。** 用户先要求对比 [HARC 仓库](https://github.com/ChongLiuPhil/Human-AI-Research-Collaboration-Protocol) 并判断需要哪些调整，随后对“轻量工程协作契约、状态索引、决策记录、README 和 PR 模板”的建议回复“好请调整”。因此仅采纳适用于本软件项目的**轻量文件治理**；**没有明确要求**全面采用 HARC 研究协议、双语镜像全部 Markdown、建立论文批准框架、转移第三方文档版权或选择开放许可证。实现记录：本次文档治理 PR（通过 GitHub 提交历史定位）。

## 已在项目中实施、但不要冒充单独的人类授权

- 本机优先、无账号核心流程及版本 `1.1.0` 为仓库实现状态；详细边界以 `README.md`、`privacy.html`、[Issue #14](https://github.com/SeekerThinker/boardgame-helper/issues/14) 为准。
- 图鉴 `ready` 过滤、原创教学与真实审阅／试玩门禁是已有仓库的编辑约束，见 `docs/GAME_LIBRARY_EDITORIAL.md`、`docs/GAME_LIBRARY_IMPLEMENTATION.md`、[Issue #53](https://github.com/SeekerThinker/boardgame-helper/issues/53)。AI 不得根据本日志推断某条游戏已经获得人类批准。

## 仍是提议或待明确决定（不是已批准实施）

- **正式网站托管迁往 Cloudflare／自定义域名**：此前仅讨论架构建议；没有发生迁移，也没有批准跨域本地存档迁移方案。需要单独决定并验证数据导出／恢复及旧站引导。
- **软件与图鉴内容的许可条款**：尚无明确选择；不能仅凭 GitHub 公共可见性假设自由复制、使用或分发，也不能替用户代选 LICENSE。
- **具体游戏公开**：需真实的独立审核和线下试玩，权利材料逐项留证；测试通过和本日志均不是授权。
- **商店正式发布／仓库保护**：外部账号、真实签名、设备检查以及 `master` required checks 的剩余事项以 [Issue #14](https://github.com/SeekerThinker/boardgame-helper/issues/14) 为准；本文件不等于已经完成。
