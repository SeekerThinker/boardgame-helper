# 商店文案维护说明

`store-listing.json` 是 Google Play 与 Apple App Store 商店文案字段的仓库内来源。不要再把应用名称、短描述、副标题、关键词或版本号混进描述正文文件。

## 字段映射

### Google Play

- `googlePlay.<locale>.name` → App name
- `googlePlay.<locale>.shortDescription` → Short description
- `googlePlay.<locale>.fullDescriptionFile` → Full description 正文文件
- 英文正文：`google-play-assets/play-store-description-en.txt`
- 中文正文：`google-play-assets/play-store-description-zh.txt`

### Apple App Store

- `appStore.<locale>.name` → Name
- `appStore.<locale>.subtitle` → Subtitle
- `appStore.<locale>.keywords` → Keywords
- `appStore.<locale>.descriptionFile` → Description 正文文件
- 英文正文：`app-store-assets/description-en.txt`
- 中文正文：`app-store-assets/description-zh.txt`

## 自动校验

```bash
npm run check:store-listing
```

该命令也包含在 `npm run check` 中，会验证：

- Google Play：名称最多 30 字符、简短描述最多 80 字符、完整描述最多 4000 字符；
- App Store：名称 2–30 字符、副标题最多 30 字符、描述最多 4000 字符；
- App Store keywords 总计最多 100 UTF-8 bytes，且禁止空项、重复项和长度不超过 2 字符的关键词；
- 描述文件必须留在对应平台资产目录中，不能引用仓库外路径；
- 描述正文不得重新加入独立标题或 `Version x` / `版本 x` 这类易过时的版本尾注；
- 本地隐私页与商店隐私政策副本必须存在。

## 不在仓库中伪造的字段

以下值依赖开发者账号或实际部署环境，仓库不会填入 `example.com` 一类占位值：

- Google Play Developer Contact；
- Google Play 对外隐私政策 HTTPS URL；
- App Store Support URL；
- App Store Privacy Policy URL；
- Apple Developer Team、签名与 App Store Connect 应用记录。

账号持有人完成这些外部配置后，应在 `STORE_RELEASE_CHECKLIST.md` 中逐项确认。仓库里的 `privacy.html` 和 `google-play-assets/privacy-policy.html` 是可部署的政策内容，不代表已经存在公开 HTTPS 地址。

## 维护原则

- 改营销文案时先编辑 `store-listing.json` 与对应正文文件，再运行 `npm run check`。
- 版本号只维护在 `package.json` / 原生版本配置与发布元数据流程中；不要把当前版本号写进商店描述正文。
- 截图和 feature graphic 由 `npm run assets:store` 生成，并由 `npm run check:store-assets` 校验；商店文案和商店图片是两套独立门禁。
