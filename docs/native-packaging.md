# 原生容器封装指南（Android / iOS / HarmonyOS）

海盐账本是一个纯前端、本地优先的 Web App。生产构建已经按「可被原生容器直接加载」的方式调整：

## 当前 Android 容器（已实现）

Android 版本已经落地在 `android/`，不是只做了文档规划：

- Capacitor 8.5.3，包名 `com.seasalt.ledger`，应用名「海盐账本」。
- `minSdk 24` / `targetSdk 36` / `compileSdk 36`，Java 21 + Gradle 8.14.3。
- 状态栏 / 手势条采用 Capacitor 8 SystemBars + `EdgeToEdge.enable`，CSS 安全区生效。
- 原生返回键：先关闭打开的 Bottom Sheet，再沿 hash history 回退，首页再次返回才退出。
- 导出 CSV / JSON：走原生 `Filesystem` 写入缓存目录，再调用 `Share` 打开系统保存/分享面板。
- 本地文件导入：Web 文件选择器由 Capacitor 的 WebView Bridge 处理。
- 原生启动图、自适应图标、签名 release APK 均已配置。
- 构建与签名细节见 [`android/README.md`](../android/README.md)。

Capacitor/Android 包的资源与运行逻辑均在本机，不依赖远端服务。

- `vite.config.ts` 使用相对 `base: './'`，构建后的 JS/CSS、图标、manifest 都使用相对路径。
- 不依赖任何远程字体、接口或 CDN；断网可完整使用。
- 使用 `viewport-fit=cover`、`env(safe-area-inset-*)` 和 `100dvh`。
- 表单 Bottom Sheet 会监听 `visualViewport`，在软键盘出现时抬高并限制高度。
- 使用 Hash 路由（`#/`），不需要原生配置服务端 rewrite。
- IndexedDB 持久化；localStorage 仅作为降级与会话偏好。

## 1. 构建产物

```bash
npm install
npm run build
```

把 `dist/` 整体放进原生工程的 Web 资源目录即可。不要只拷贝 `index.html`。

## 2. 加载方式（重要）

不要用 `file://` 直接打开 `index.html`。`file://` 下的模块加载、IndexedDB、文件选择器在不同 WebView 中行为不一致。

推荐让原生层把一个本地目录映射成安全来源：

- **Android**：`WebViewAssetLoader` 映射到 `https://appassets.androidplatform.net/`，或使用 Capacitor 的本地 server。
- **iOS**：`WKWebView` + `loadFileURL:allowingReadAccessToURL:` 在本机目录中加载，或使用 Capacitor 的 `capacitor://localhost`。
- **HarmonyOS**：ArkWeb 的本地资源加载能力 / 本地 HAP 资源 server，保持同一个 origin 不变。

同一个 origin 是 IndexedDB 数据能长期保留的前提。换 origin、换 scheme 都会被视为新站点。

## 3. 推荐的容器方案

- **Android / iOS**：Capacitor 最省事，`webDir: 'dist'` 即可；也适合后续添加原生分享、文件选择、生物识别。
- **HarmonyOS**：用 ArkWeb（`Web` 组件）加载打包后的前端资源，通过 `runJavaScript` / `javaScriptProxy` 暴露文件保存、分享等桥接。
- 不推荐把整个站点放进公网 WebView：会失去「本地优先」的优势，也增加隐私风险。

## 4. 原生能力清单

### 4.1 状态栏 / 安全区

- 状态栏背景建议 `#f7f4ec`，图标深色。
- iOS 使用 `viewport-fit=cover` 后，CSS `env(safe-area-inset-top/bottom)` 会生效。
- Android 和 Harmony 的挖孔/手势条安全区不一定会映射到 CSS `env()`，建议由原生层给页面根节点注入额外的 padding，或设置 WebView 的 inset。
- 底部导航已经预留 `env(safe-area-inset-bottom)`，不要再叠加一套重复的 34px 固定留白。

### 4.2 返回键

App 使用 hash 路由，页面里的返回按钮调用 `history.back()`。原生返回键建议：

1. 如果当前 hash 不是 `#/`，执行 `webView.evaluateJavascript("history.back()")` 并拦截退出；
2. 如果当前 hash 是 `#/`，再交还给系统退出 App；
3. 不要直接销毁 WebView，否则未保存的记账输入会丢失。

### 4.3 键盘

- Android：`windowSoftInputMode=adjustResize`，让 `visualViewport` 收紧。
- iOS：WKWebView 默认会调整 visual viewport；表单 Sheet 会跟随键盘。
- 验证「备注 / 预算 / 分类名称」这几个输入框在键盘弹出时，底部按钮仍然可见。

### 4.4 文件导入与导出

浏览器的文件选择器与下载在原生 WebView 中通常需要桥接：

- **导入**：页面使用原生 `<input type="file">`，Capacitor Android 的 Bridge 会接管系统文件选择器。请在目标 Android 版本上实际选择一次 CSV/XLSX。
- **CSV / JSON 导出**：Web 端使用 `<a download>`，原生端已经切换为 `@capacitor/filesystem` + `@capacitor/share`：文件先写入 `Directory.Cache`，再打开系统保存/分享面板。代码在 `src/lib/export.ts`。
- **备份恢复**：使用设置页的文件选择器读取 JSON，输入框接受 `.json`。

设置页的入口在：

- `src/pages/SettingsPage.tsx`
- 导出实现：`src/lib/export.ts`

### 4.5 本地数据

- Android WebView 必须开启 DOM Storage / Database；并确保 WebView 数据目录不会被清理策略误删。
- iOS WKWebView 的 WebsiteDataStore 默认持久化；不要每次启动都创建非持久化 store。
- 建议首次启动时调用 `navigator.storage.persist()`（Web 端已调用，实际授权取决于容器）。
- 换机迁移请使用 JSON 备份 / 恢复，而不是复制 WebView 数据目录。

### 4.6 分享（可选）

原生日历页、统计页可以加「截图分享」：截图由原生实现，Web 端只提供视图。不要依赖浏览器的 Web Share API 在所有 WebView 中可用。

## 5. 与 PWA 的关系

- 在普通浏览器中，构建仍可通过 HTTPS/localhost 注册 Service Worker，支持安装和离线。
- 原生容器内不需要 Service Worker，资源本身就在本地包里，注册失败也无影响（代码已用 try/catch）。
- 原生包不要覆盖 `window.navigator.serviceWorker`；保持 Web 端渐进增强即可。

## 6. 字体与屏幕尺寸

- 当前使用的字号已按手机阅读重新放大：正文 14–15px，辅助文字 10.5–12px，底部导航 10.5px。
- 针对 `max-height: 820px` 的设备，首页会切换成更紧凑的快捷记账条。
- 原生层如果提供系统字号缩放，建议通过 WebView 的文本缩放（Android `textZoom`）小范围调整；`100%` 为推荐默认值。
- 布局在 320px、390px、430px 宽度下验证过，没有横向溢出。

## 7. 验收清单

- [ ] 冷启动进入 `#/`，没有白屏或 404 资源。
- [ ] 状态栏与底部手势条不遮挡内容。
- [ ] 物理返回键：先回退页面，再退出应用。
- [ ] 备注 Sheet 打开时键盘不会遮住「完成」。
- [ ] 导入页能选到本地 CSV / Excel 文件。
- [ ] 导出 JSON 能保存到系统文件。
- [ ] 杀进程重启后账本数据仍在。
- [ ] 断网后仍能记账、看统计和日历。
- [ ] 从 Web 导出的 JSON 备份在原生 App 内可以恢复。

## 8. 建议的下一步

1. 用同一套 Capacitor 工程生成 iOS 包，并补 iOS 的启动图与安全区验收。
2. HarmonyOS 用 ArkWeb 复用 `dist`，桥接同样的文件保存/分享能力。
3. 在隐私设置中接入系统生物识别，用于解锁本地账本。
4. 根据真实用户反馈补充周期账单、分类预算和资产余额，而不是先做云同步。
