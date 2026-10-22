# 海盐账本 v1.2.2

这一版专门修复大数据量下快速滚动仍出现空白的问题，并保留 v1.2.1 的排序和新版键盘。

## 滚动空白修复

根因不是数据本身，而是 Android WebView 的合成层压力：

- 每条 `.tx-row` 都有 `will-change: transform`，并且始终带 `translateX(0)`，导致 167 条记录被提升为 167 个独立合成层。
- 页面容器 `.page-transition` 有整页位移动画，超长明细页被提升成一个很大的合成层。
- 底部导航的 `backdrop-filter` 和背景光晕的模糊也会增加滚动时的 GPU 压力。

本版处理：

- 移除逐行的 `will-change`；只有正在左滑或已经滑开的行才设置 transform。
- 移除页面级 transform/opacity 入场动画。
- 移除底部导航的 `backdrop-filter` 和装饰背景的 blur。
- 保留明细分批加载和月/年索引，滚动性能仍然稳定。

## 实测

在 Android 16（API 36）模拟器导入 10,910 条合成账单，当前月 111 条，快速滑动并加载更多日期，记录、日期组和卡片均正常绘制，无空白。

## Android APK

- 包名：`com.seasalt.ledger`
- 版本：1.2.2（versionCode 4）
- 支持：Android 8.0 / API 24 及以上
- 目标 SDK：36
- APK：`SeaSaltLedger-1.2.2.apk`
- 大小：6,953,041 bytes
- SHA-256：`EA88E880130A7E533D94D02901BAF9274AE7C72D01737089FF549A4C9FFBCF0D`

安装：下载 APK，在手机上允许安装未知应用后打开；或使用 `adb install -r SeaSaltLedger-1.2.2.apk`。

APK 使用 v2 APK Signature Scheme 签名。请从本仓库 Releases 下载，避免使用来源不明的二次打包版本。

## 验证

- 25 个 Vitest 单元测试通过
- TypeScript 检查、Vite 生产构建通过
- E2E 覆盖计算器、全部统计、随手记导入和持久化
- Android 16 模拟器覆盖安装、键盘、全部统计和 10,910 条账单快速滚动

账本数据仍只保存在设备本地。升级前建议在「我的 → 备份整个账本」导出 JSON 备份。
