# 桌游助手

桌游助手是面向线下桌游聚会的离线工具 App，聚焦真实局内流程：谁在行动、还剩多久、本轮怎么记分、历史分数如何更正、随机决定如何完成、最终如何结算。界面支持中文与 English，可运行于 Web/PWA、Android 和 iOS。

## 功能

- 流程：当前行动者计时、结束行动切人、保存本轮、进入下一轮；行动顺序卡片上可直接 ±1 快捷记分
- 计时：轮到谁计谁、个人时间池、公共时间池、阶段/讨论倒计时；进度条与最后 30/10 秒视觉警示，运行中标题栏同步显示剩余时间，任意标签页可见悬浮计时徽章
- 常亮：计时进行时可保持屏幕常亮（可在设置或开局页关闭），避免牌局中途熄屏
- 计分：高分胜/低分胜、目标分、自定义计分栏位、回合分、历史更正
- 模板：胜利点、奖励/惩罚、低分胜、合作战役、胜负局
- 结算：按当前胜负规则排序，可复制本局摘要；结束后自动归档到“历史对局”，随时查看、复制或删除；「再来一局」保留玩家名单与各项设置，直接开下一局
- 工具：掷骰/硬币（结果大屏展示）、随机首家、行动顺序洗牌、2–4 队均衡分队
- 提醒：计时使用绝对截止时间，退到后台仍准确；授权后到时发送本地系统通知
- 隐私：本地存储、无账号、无广告、无分析、无云同步
- 发布：PWA 离线缓存 + Capacitor Android/iOS 原生壳

## 目录

- `index.html`：Web 入口
- `src/app.js`：应用主逻辑
- `src/core.js`：可测试的计时、计分、随机与状态迁移核心
- `src/i18n.js`：中英文案与格式化
- `src/native.js`：本地通知、屏幕常亮、前后台恢复与剪贴板适配
- `src/archive.js`：历史对局本地存档（独立于对局状态持久化）
- `src/audio.js`：音效、震动和语音倒计时
- `src/style.css`：移动端界面样式
- `scripts/build-static.js`：生成 `dist/`
- `scripts/check-native-versions.js`：检查/同步 Web、Android、iOS 用户版本号
- `scripts/check-release-metadata.js`：检查发布清单、原生 build metadata、Android 权限与 iOS 隐私声明
- `scripts/generate-store-assets.js`：生成 Google Play / App Store 双语截图与 feature graphic
- `scripts/check-store-assets.js`：校验商店素材文件集合、像素尺寸与重复截图
- `scripts/prepare-release-candidate.js`：把 Web、Android AAB、商店文案/素材、隐私与发布清单组装为统一 RC，并生成 SHA-256 清单；已签名 AAB 还会记录签名证书 SHA-256 指纹
- `scripts/check-release-candidate.js`：校验 RC 文件集合、版本、截图数量、AAB 签名/证书指纹与全部 SHA-256
- `scripts/serve-static.js`：本地预览服务（支持 `BASE_PATH` 子路径模拟）
- `store-listing.json`：Google Play / App Store 中英文结构化 listing 元数据
- `android/`：Capacitor Android 工程
- `ios/`：Capacitor iOS 工程
- `google-play-assets/`：Google Play 文案、隐私政策、图标、feature graphic 与双语截图
- `app-store-assets/`：App Store 中英文描述与 iPhone/iPad 双语截图
- `STORE_RELEASE_CHECKLIST.md`：Google Play 和 App Store 上架准备清单
- `tests/e2e/run-e2e.js`：真实 Chromium 端到端测试
- `tests/e2e/run-subpath-e2e.js`：PWA 子路径部署、Service Worker 与离线回归测试
- `.github/workflows/ci.yml`：CI 流水线（安全审计、Web 测试、商店素材、Android APK/AAB、Android 临时签名 smoke test、iOS Simulator 编译、统一 RC artifact）
- `.github/workflows/release.yml`：手动签名 Release Candidate 工作流

## 开发

```bash
npm run dev
```

如果本机没有 `npm`，也可以直接用 Node 运行：

```bash
node scripts/serve-static.js
```

## 构建与质量检查

```bash
npm run build
```

构建结果会输出到 `dist/`，Capacitor 的 `webDir` 已指向该目录。

完整质量检查：

```bash
npm run check
```

它会先构建，检查 `package.json` / Android / iOS 的用户可见版本是否一致，再校验发布清单与原生 build metadata、Android 发布权限和 iOS 隐私声明，最后运行 Node 单元测试、根路径 Chromium E2E，以及挂载到 `/boardgame-helper/` 的子路径 PWA E2E。首次运行若缺少浏览器：

```bash
npx playwright install chromium
```

GitHub Actions 在 Pull Request 上还会额外执行 high/critical npm 漏洞门禁、商店素材重新生成与规格校验、Android debug APK + unsigned release AAB 编译、Android 发布签名注入 smoke test，以及无签名 iOS Simulator 编译。Android smoke test 会在 runner 临时生成测试 keystore，模拟 Base64 解码和 `BGA_*` 环境变量注入，重建 signed AAB，并要求 `jarsigner` 与证书 SHA-256 检查通过；测试 key 不进入 artifact，也不会被当成正式发布密钥。五个基础 job 全部成功后，`release-candidate` job 会下载同一次 run 中在 smoke test 之前上传的 unsigned Android artifact 与商店素材，生成统一 `boardgame-helper-release-candidate` artifact，并校验其 SHA-256 清单与发布状态。

## Web / PWA 部署

`dist/` 可以部署在域名根目录，也可以部署到 `/boardgame-helper/` 这类子路径。HTML、Web App Manifest、Service Worker 预缓存和离线 fallback 都会跟随当前部署目录，不要求站点拥有域名根路径。

可在本地模拟子路径托管：

```bash
npm run build
BASE_PATH=/boardgame-helper/ node scripts/serve-static.js dist
```

然后打开 `http://127.0.0.1:3000/boardgame-helper/`。`npm run check` 会自动覆盖同样的子路径场景并验证离线刷新。

## 版本与发版

`package.json` 是用户可见版本号的来源。准备新版本时，先更新 npm 版本，再使用统一发布同步命令：

```bash
npm version 1.2.0 --no-git-tag-version
npm run release:sync
npm run check
```

`release:sync` 会先把 Android `versionName` 和 iOS Debug/Release `MARKETING_VERSION` 同步为 `package.json` 的版本，再把 `STORE_RELEASE_CHECKLIST.md` 中的用户版本、Android `versionCode`、iOS `CURRENT_PROJECT_VERSION`、包名和 target SDK 回写为工程当前值。Android `versionCode` 和 iOS `CURRENT_PROJECT_VERSION` 是商店构建号，正式提交新构建时仍需主动递增；`npm run check:release-metadata` 会阻止发布清单与工程再次漂移。

## Release Candidate bundle

统一 RC 目录包含：

- `web/`：可部署的 PWA 静态产物
- `android/app-release.aab`：Android release bundle
- `store-assets/`：Google Play / App Store 当前生成截图与 feature graphic
- `metadata/`：结构化 listing、完整描述、隐私政策副本与发布清单
- `release-manifest.json`：版本、Android 包名/build/target SDK、AAB 签名状态与签名证书 SHA-256（若已签名）、iOS build 状态和仍需账号持有人完成的外部前置条件
- `SHA256SUMS.txt`：除自身外 RC 中全部文件的 SHA-256

在已经生成 `dist/`、商店素材和 Android AAB 的环境中可运行：

```bash
npm run release:candidate
npm run check:release-candidate
```

普通 PR CI 的 Android AAB 不注入发布密钥，因此 `release-manifest.json` 会把它明确标记为 `unsigned`，且 `signingCertificateSha256` 为 `null`；该 artifact 用于完整性验收，**不能冒充可上传 Google Play 的正式包**。

GitHub Actions 的 **Release Candidate** 手动工作流会要求真实 Android 发布签名 secrets，构建后再次用 `jarsigner` 验证并读取签名证书 SHA-256 指纹；只有签名状态为 `verified` 且存在合法 64 位十六进制证书指纹时，`npm run check:release-candidate -- --require-android-signed` 才会通过并上传 `boardgame-helper-signed-release-candidate`。

## Android 发布签名

不要把 keystore 或密码提交到仓库。发布包签名支持两种方式：

1. 复制 `android/keystore.properties.example` 为 `android/keystore.properties`，填入本机私密配置。
2. 或设置环境变量：`BGA_STORE_FILE`、`BGA_STORE_PASSWORD`、`BGA_KEY_ALIAS`、`BGA_KEY_PASSWORD`。

然后运行 Android 构建：

```bash
npm run sync:android
npm run build:android:release
```

若使用 GitHub 手动 **Release Candidate** 工作流，需要在仓库 Actions secrets 中由账号持有人配置：

- `BGA_ANDROID_KEYSTORE_BASE64`：发布/上传 keystore 文件的 Base64 内容
- `BGA_STORE_PASSWORD`
- `BGA_KEY_ALIAS`
- `BGA_KEY_PASSWORD`

工作流会把 keystore 临时解码到 runner 的临时目录，不写入仓库或 artifact；随后通过现有 `BGA_*` 环境变量完成签名。常规 CI 会用一次性临时测试 key 演练相同的 Base64 解码、环境变量注入、Gradle 签名和证书读取路径，因此不需要真实密钥也能持续发现签名管线回归。

## 本机 Android Debug 包

当前项目支持把 JDK、Android SDK 和 Gradle 缓存放在项目本地目录，相关目录已加入 `.gitignore`：

- `.local-jdk/`
- `.android-sdk/`
- `.android-user/`
- `.gradle-home/`

生成可安装的 debug APK：

```bash
npm run sync:android
npm run build:android:debug
```

产物位置：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

生成 release APK 和 Play Store 使用的 AAB：

```bash
npm run sync:android
npm run build:android:release
```

产物位置：

```text
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

`android/release-key.jks`、`*.jks`、`*.keystore` 和 `android/keystore.properties` 均已忽略。发布密钥请在仓库外安全备份；丢失上传/签名密钥可能阻断后续更新流程。

应用声明 `SCHEDULE_EXACT_ALARM`，用途仅为桌游倒计时在设备待机时准点结束并发送本地提醒。提交 Google Play 时需要在 App content 中如实完成“闹钟和提醒（Alarms & Reminders）”权限声明，并说明核心用途是桌游倒计时准点提醒。注意：`USE_EXACT_ALARM` 仅限闹钟/日历类应用，本应用使用 `SCHEDULE_EXACT_ALARM`。

## iOS 发布状态

当前仓库已包含 `ios/` Capacitor 工程。准备提交 App Store 前，需要在 macOS 的 Xcode / App Store Connect 中配置 Bundle ID、Apple Developer Team、签名证书和 Provisioning Profile。

同步最新 Web 产物到 iOS：

```bash
npm run sync:ios
```

然后用完整 Xcode 打开 `ios/App/App.xcodeproj`，选择开发团队，分别在 iPhone 与 iPad 模拟器/真机验证通知和后台恢复，再执行 Archive。GitHub Actions 会自动做无签名 Simulator 编译；由于仓库没有也不应该伪造 Apple Team/证书/Profile，当前统一 RC 会在 `release-manifest.json` 中明确标记 `ios.storeBinaryIncluded=false`。真机通知、后台行为、签名、Archive 与 App Store 上传仍需在真实 Apple 开发者环境完成。

## 商店素材与发布前外部项

重新生成全部中英双语商店截图及 Google Play feature graphic，并立即校验文件集合、像素尺寸与同设备重复截图：

```bash
npm run build
npm run assets:store
npm run check:store-assets
```

当前生成集合包含 40 张双语设备截图（Google Play phone/tablet、App Store iPhone/iPad）和 1 张 Google Play feature graphic。Pull Request 的 `store-assets` job 会重新生成并校验这些图片，再上传 `boardgame-helper-store-assets` Actions artifact（保留 7 天），方便发布前人工抽查。

代码仓库能自动完成的字段、素材、构建、签名管线 smoke test 与完整性门禁已经尽量自动化；以下信息必须来自真实外部账号，仓库不会生成假占位值：Google Play Developer Contact、App Store App Support、稳定 HTTPS 隐私政策 URL、Google Play Console Data Safety/App content/内容分级，以及 App Store Connect 应用记录、年龄分级和审核信息。
