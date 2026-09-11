# 桌游助手上架清单

## 产品定位

- 应用名称：桌游助手 / Board Game Assistant
- 推荐副标题：线下桌游回合计时与计分
- 核心定位：桌游聚会主持人的局内流程控制器
- 首版商业模式：免费、无广告、无账号
- 首版隐私策略：不采集个人数据、不接入分析 SDK、不依赖网络
- 版本：1.1.0（Android versionCode 1 / iOS build 1）

## Google Play

- 上传包：`android/app/build/outputs/bundle/release/app-release.aab`
- 包名：`com.boardgame.timer`
- 目标 SDK：36
- 已在仓库准备：
  - 应用标题、简短描述、完整描述
  - 中英文手机/平板截图：流程、计分、历史、工具、结算
  - 1024 图标和 1024×500 feature graphic
  - release APK/AAB 构建流程（正式上传包需配置发布签名）
- 账号持有人仍需完成：
  - 隐私政策 HTTPS 地址
  - Data Safety：无数据收集、无数据共享
  - App content 中的 `SCHEDULE_EXACT_ALARM` 声明（Alarms & Reminders）：核心用途是桌游倒计时准点提醒。注意使用 `SCHEDULE_EXACT_ALARM` 而非 `USE_EXACT_ALARM`，后者仅限闹钟/日历类应用，易触发拒审。
  - 内容分级问卷
  - 个人开发者账号的内部测试或封闭测试材料

## Apple App Store

- 当前状态：仓库已生成中英文本地化、隐私清单和 iPhone/iPad 素材；尚未配置开发者 Team 和 App Store Connect。
- 同步命令：`npm run sync:ios`。
- 需要在 Xcode / App Store Connect 完成：
  - Bundle ID 与 Apple Developer Team
  - 签名证书和 Provisioning Profile
  - App Store Connect 应用记录
  - App Privacy：不收集数据
  - 上传仓库内截图和描述，完成年龄分级和审核备注
  - 在完整 Xcode 中验证通知、iPhone/iPad 布局并 Archive

## 截图顺序

1. 流程主屏：当前行动者 + 大倒计时 + 控制按钮。
2. 本轮计分：按玩家和计分栏位记录回合分。
3. 历史更正：展开历史回合并修改分数。
4. 随机工具：骰子/硬币、首家、顺序与均衡分队。
5. 最终结算：排名、总分和各计分栏位。

## 发布前 QA

- 小屏手机：360x740、390x844。
- 离线启动：安装后断网打开。
- 计时恢复：开始计时、后台切换、回到应用。
- 长时间计时：公共时间池和个人时间池至少 10 分钟。
- 计分模板：胜利点、低分胜、合作战役、胜负局。
- 历史更正：修改旧轮次后总分和排名重算。
- 防误触：重置整局、删除玩家、删除计分栏位都有确认。
- 后台通知：Android 13+ 和 iOS 首次授权、拒绝、再次打开三条路径均验证。
- 支持渠道：在 Google Play 的 Developer Contact 与 App Store 的 App Support 中填写并验证公开联系方式。

## 版本与发布元数据

`package.json` 是用户可见版本源。更新版本后，使用：

```bash
npm run release:sync
```

它会同步 Android `versionName`、iOS `MARKETING_VERSION`，并把本清单中的版本、Android versionCode、iOS build、包名和 target SDK 更新为工程当前值。Android `versionCode` 与 iOS `CURRENT_PROJECT_VERSION` 仍需在提交新商店构建时主动递增。

## 自动验证命令

```bash
npm run check
npm run check:release-metadata
npm run sync:android
npm run build:android:debug
npm run build:android:release
npm run assets:store
npm run check:store-assets
```

`npm run check:release-metadata` 会校验 Web/Android/iOS 版本与 build metadata、Google Play 包名/target SDK、Android 通知与精确闹钟权限、iOS 无追踪/无数据收集隐私清单，以及本发布清单是否与工程一致。
