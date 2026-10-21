# 海盐账本 v1.1.0

首个开源版本。一个本地优先、手机优先的个人记账 PWA，支持导入鲨鱼记账账单。

## 功能

- 支出 / 收入 / 转账记账，分类、账户、日期、备注与编辑删除
- 月度 / 年度统计、周趋势、全年 12 个月走势、分类排行与同比
- 账单日历、每日热度和单日补记
- 月度预算与日均可用额度
- 鲨鱼记账 CSV / XLSX 多文件导入、字段映射、重复记录识别
- CSV 导出、完整 JSON 备份与恢复
- PWA 离线安装
- Android 原生容器：返回键、文件选择器、系统分享、自适应图标

## Android APK

- 包名：`com.seasalt.ledger`
- 版本：1.1.0（versionCode 1）
- 支持：Android 8.0 / API 24 及以上
- 目标 SDK：36
- 大小：6,949,653 bytes
- SHA-256：`79D3597DB2744416F4CF929DD97158626735984A3C6C9193D363D8CCE15E2162`

安装：下载 `SeaSaltLedger-1.1.0.apk`，在手机上允许安装未知应用后打开；或使用 `adb install -r SeaSaltLedger-1.1.0.apk`。

APK 使用 v2 APK Signature Scheme 签名。请从本仓库 Releases 下载，避免使用来源不明的二次打包版本。

## 验证

- 17 个 Vitest 单元测试通过
- TypeScript 检查与 Vite 生产构建通过
- Android 16（API 36）模拟器完成安装、启动、页面导航、返回键、文件选择器与 CSV 分享验证

## 说明

账本数据只保存在设备本地（IndexedDB），没有账号、后端或云同步。卸载应用或清除站点数据前，请先在「我的 → 备份整个账本」导出 JSON 备份。

本项目使用 MIT License。
