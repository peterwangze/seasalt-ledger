# Android 打包

- 应用包名：`com.seasalt.ledger`
- 版本：`1.2.2`（versionCode `4`）
- 最低 Android：8.0（API 24）
- 目标/编译 SDK：36
- 技术容器：Capacitor 8 + Android SystemBars / Filesystem / Share / App

## 构建环境

- JDK 21，并设置 `JAVA_HOME`
- Android SDK Platform 36、Build-Tools 36
- Gradle 8.14.3（项目自带 wrapper）
- 也可以用 Android Studio（Otter / 2025.2.1 或更新）打开 `android/`

如果命令行环境没有配置 SDK，可创建 `android/local.properties`：

```properties
sdk.dir=C\:\\path\\to\\Android\\Sdk
```

## 每次 Web 代码变更后

```bash
npm install
npm run build
npx cap sync android
```

## 构建 release APK

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

cd android
.\gradlew.bat :app:assembleRelease
```

首次运行 wrapper 会下载 Gradle；如果网络较慢，可以改用本机已安装的 Gradle 8.14.3：

```powershell
gradle :app:assembleRelease --no-daemon
```

产物：

```
android/app/build/outputs/apk/release/app-release.apk
```

## 签名

Release 签名材料位于（均被 `.gitignore` 忽略）：

- Keystore：`android/keystore/seasalt-release.jks`
- 口令：`android/keystore.properties`

**重点：请立即另行备份这两个文件。** 后续升级必须使用同一签名密钥；丢失后无法覆盖安装旧版本，也无法向应用商店提交更新。

签名别名：`seasalt`

## 安装

```bash
adb install -r SeaSaltLedger-1.2.2.apk
```

或在手机上打开 APK 文件，允许“安装未知应用”。

## 更新版本号

修改 `android/app/build.gradle`：

```gradle
versionCode 5          // 每次发布递增
versionName "1.2.3"
```

## 验证记录

已在 Android 16（API 36）x86_64 模拟器上验证：

- `adb install -r` 安装成功，`MainActivity` 正常冷启动；
- 首页、统计页、记账页渲染正常；
- 鲨鱼式金额键盘能完成 `60 + 6.6 = 66.60`，完成键能保存；
- 导入账单同一天按后记录优先显示；
- 导入 10,910 条合成账单后快速滚动当前月明细，记录、日期组和卡片不再出现空白；
- 统计页「全部」模式能显示累计收支和年度走势；
- 原生返回键从统计页回到首页；打开月份 Sheet 时，返回键先关闭 Sheet；
- 导入页能调起 Android DocumentsUI 文件选择器；随手记格式由 Web E2E 与单元测试验证；
- 设置页「导出全部账单」能生成 CSV 并调起系统分享面板。

未覆盖：Android 8–15 各厂商 WebView 的逐一回归，以及真实应用商店审核流程。

## 与 Web 版本的关系

- Web 端仍可独立部署为 PWA。
- Android 端使用 Capacitor 本地 WebView 加载打包资源；不依赖网络或远程服务器。
- 原生返回键、文件导出分享、状态栏/安全区已接入。
- 修改 Web 代码后必须重新 `npm run build && npx cap sync android`，再构建 APK。
