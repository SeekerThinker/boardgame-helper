# 商店后台提交指引（表单逐项填写）

本文件是 `STORE_RELEASE_CHECKLIST.md` 的**执行补充**：聚焦“你（账号持有人）在商店后台具体怎么填”，尤其是 `SCHEDULE_EXACT_ALARM` 的权限声明措辞。代码侧已就绪，无需再改仓库。

---

## 0. 提交前必须完成（仓库外事务）

1. **隐私政策公开托管**：商店要求可访问的 HTTPS 网址，本地 `privacy.html` 不能直接填。
   - 推荐：推到 GitHub 后用 Pages 托管，或放到自有域名。
   - 已就绪内容：`privacy.html`（根目录）与 `google-play-assets/privacy-policy.html`（同一份）。
   - 托管后把链接填到 Play「隐私政策链接」和 App Store「Privacy Policy URL」。
2. **开发者联系邮箱**：需可接收验证码并验证（Play 与 App Store 各自验证）。
3. **签名/证书**：
   - Play：用 Play App Signing（上传密钥由 Play 管理）。
   - App Store：Apple Developer Team、Bundle ID `com.boardgame.timer`、分发证书 + 描述文件、App Store Connect 应用记录。

---

## 1. Google Play Console

### 1.1 App content → Alarms & reminders（闹钟和提醒）权限声明 ⚠️
应用声明了 `SCHEDULE_EXACT_ALARM`（已在 `AndroidManifest.xml` 改为此权限，非受限的 `USE_EXACT_ALARM`）。后台路径：**App content → Alarms and reminders → 选择用途**。

- 在「Does your app use alarms & reminders?」选 **Yes**。
- 用途类别按要求勾选与“计时到时提醒”最贴近的一项，建议措辞：
  > This app schedules exact alarms solely to fire a local, on-device notification the instant an active board-game timer reaches zero, so hosts are alerted at the precise end of a turn/round even when the screen is off. Alarms are not used for marketing, recurring reminders, or background data work. The in-app countdown remains exact via an absolute deadline regardless of alarm permission.

中文参考（如需）：
  > 本应用仅在对局计时器归零的瞬间，用精确闹钟触发一条本机本地通知，提醒主持人回合/轮次已到，即使熄屏也准点。不用于营销、周期提醒或后台数据任务；无论闹钟权限是否授予，应用内倒计时都基于绝对截止时间保持精确。

- 若 Play 复核后认为用途不符：最坏情况是撤回精确闹钟，改为非精确闹钟 + 应用内倒计时（核心计时不受影响，仅后台提醒可能轻微延迟）。`native.js` 已有调度失败的 try/catch 兜底，不会崩溃。

### 1.2 App content → Data Safety（数据安全）
选 **“We do not collect any user data” / 不收集任何用户数据**：
- 应用无账号、无联网上传、无广告/分析 SDK，仅本地存储（玩家名、计时、分数、工具结果）。
- 本地通知不经过远程服务器。
- 提交后显示「No data collected」。

### 1.3 App content → 内容分级（Content rating）
用 IARC 问卷：类别选工具/实用（Utilities），无暴力、无敏感、无用户生成内容 → 通常评为 **Everyone / 全年龄**。

### 1.4 Store listing（商品详情）
文案与素材已生成，直接引用：
- 标题：`桌游助手` / `Board Game Assistant`
- 短描述 + 完整描述：`google-play-assets/play-store-description-zh.txt` 与 `-en.txt`
- 图标：`google-play-assets/icon-1024.png`
- Feature graphic：`google-play-assets/feature-graphic-1024x500.jpg`
- 截图：`google-play-assets/screenshots/`（中英文各 5 张，含手机/平板）

### 1.5 构建产物
- 生成 AAB：`npm run build:android:release`（脚本会调用 `cap sync` 并产出 `android/app/build/outputs/bundle/release/app-release.aab`）。
- 在 Play Console「Release → Production」上传该 AAB，Play App Signing 自动接管。

---

## 2. App Store Connect

### 2.1 App Privacy（应用隐私）
- 进入 App Privacy，对「Does your app collect any user data?」选 **No, we do not collect data from this app.** 即完成。
- 工程已含 `ios/App/App/PrivacyInfo.xcprivacy`（声明无追踪、无采集），符合要求。

### 2.2 App 记录（App Store Connect）
- Bundle ID：`com.boardgame.timer`（与 `capacitor.config.json` 一致）。
- 名称 `桌游助手`，副标题/关键词可用：桌游、计时、计分、回合、棋钟、骰子。
- 描述：`google-play-assets/app-store-description-zh.txt` 与 `-en.txt`（App Store 与 Play 文案可共用）。
- 截图：`app-store-assets/screenshots/`。
- 年龄分级：**4+**（无 objectionable content）。
- 审核备注（Notes）：说明用途，降低被拒风险：
  > 本地计时器到点提醒使用系统本地通知。应用无账号、无服务器通信、无广告或分析 SDK，所有数据仅存于设备。不收集任何个人信息。

### 2.3 构建上传（必须完整 Xcode）
- 仅命令行工具**无法**完成 iOS 上传，需在 macOS + 完整 Xcode：
  ```
  npm run build && npx cap sync ios
  ```
  然后打开 `ios/App/App.xcworkspace`，Archive → Distribute → App Store Connect。
- 首次需配置 Signing（Team + 描述文件）。

---

## 3. 上架顺序建议
1. 先托管隐私政策并拿到 HTTPS 链接。
2. 跑 `npm run check` 确认全绿（本次已通过：构建 + 13 单元测试 + 15 e2e 检查）。
3. Play：填 App content（权限声明 / Data Safety / 分级）→ 商品详情 → 传 AAB → 提交审核。
4. App Store：建应用记录 → App Privacy（不收集）→ 填详情 → Xcode Archive 传 IPA → 提交审核。

## 4. 已知风险与兜底
- 隐私政策必须是公开 HTTPS，否则两个商店都会被打回。
- `SCHEDULE_EXACT_ALARM` 用途若被 Play 否决：降级为非精确闹钟，应用内倒计时仍精确。
- iOS 必须 Xcode Archive，无法纯命令行；Android 可纯命令行产出 AAB。
