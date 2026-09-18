# 桌游助手：当前工作状态（导航索引）

> 最近人工整理：2026-09-18。**这是指向 GitHub 当前状态的导航页，不是持续更新的第二份 Issue／CI 数据库。**执行前重新查看 `master`、链接的 Issue/PR 和工作流。历史详情保留在 Issue/PR；发现与本页冲突时先核实再修正。

## 当前重点

- **阶段**：Web/PWA 上已存在并列的「选游戏／桌面 OS／工具箱」，图鉴可点选材料和人数；通用秘密发牌有无需录入的通用预设。
- **当前首要目标**：在不复制第三方成品素材、也不伪造审核的前提下，让图鉴上线**第一条真正可读、可玩的、已审核低门槛游戏**。正式公开图鉴在本次记录时仍为 **0 条**；候选草稿不进入 `dist/`。
- **主要阻塞**：每个候选尚缺少独立于撰写者的真人权利／名称审核、对应实际许可证据（如适用）和真实试玩记录。自动检查与 AI 搜集材料不能补齐这些缺失。
- **下一项可做工作**：针对 [Issue #53](https://github.com/SeekerThinker/boardgame-helper/issues/53) 的候选，从 `editorial/candidates/` 挑一条补齐审阅证据、原创双语教学和实际试玩；未完成前只能改进草稿、校验门禁或 UI，不能把条目标记 `ready` 或塞进公开数据。

## 可靠导航与未完成事项

| 主题 | 到哪里看当前记录 | 本页记录时的边界 |
| --- | --- | --- |
| 图鉴、版权分项审核、真人试玩 | [Issue #53](https://github.com/SeekerThinker/boardgame-helper/issues/53)、`docs/GAME_LIBRARY_EDITORIAL.md`、`docs/GAME_LIBRARY_IMPLEMENTATION.md`、`editorial/candidates/` | 图鉴可操作；真实已审核公开游戏仍为零。 |
| 原生商店、仓库保护、正式版本 | [Issue #14](https://github.com/SeekerThinker/boardgame-helper/issues/14)、`STORE_RELEASE_CHECKLIST.md` | 版本 `1.1.0`；生产密钥、真实 iOS 签名／真机和商店审核尚未完成；当日 `master` 分支保护为 `false`。 |
| 实现细节与自动化验证 | `README.md`、`TABLE_OS.md`、`docs/TABLE_OS_TEST_MATRIX.md`、`.github/workflows/ci.yml`、`.github/workflows/pages.yml` | 每次以最新 commit 的 PR CI、合并后 CI、部署 smoke 为准；一次通过不代表以后持续通过。 |
| 人类已表达的方向及未定问题 | `docs/DECISIONS.md` | 不以 AI 建议、先前聊天摘要或 PR 自动替代人类批准。 |

## 待人类／外部系统处理

- 为首条正式游戏指定**真实且不同于撰写者的审阅者**，完成逐项证据检查与真实试玩；没有记录就不得发布。[#53](https://github.com/SeekerThinker/boardgame-helper/issues/53)
- 仓库管理者为 `master` 配置 PR 必需与六项 required checks（`audit`、`check`、`store-assets`、`android`、`ios`、`release-candidate`），禁止 force push／删除；配置之后还需重新核查是否真正生效。[#14](https://github.com/SeekerThinker/boardgame-helper/issues/14)
- 明确软件代码与图鉴教学材料各自的许可决定；**未知时不添加 LICENSE，不声称第三方协议已授权移植**。如未来迁移 Cloudflare，要单独批准托管方案、域名与本地数据迁移措施。

## 维护规则

重大功能合并、真实审核结果、阻塞或发版状态发生变化时，更新本页的日期、当前重点和链接；不要逐个复制 Issue 评论、CI run 清单、长篇历史或新版本 SHA。读者必须按链接再次核查；本页记录的 `0 条`、`1.1.0` 和保护状态都是有日期的快照。
