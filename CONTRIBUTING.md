# Contributing · 参与贡献

感谢你愿意改进海盐账本。这个项目是一个本地优先的个人记账工具，最重要的两条原则是：

1. **不引入云端依赖**：账单数据必须留在用户设备上。
2. **优先手机体验**：触控、安全区、软键盘和单手操作不能被桌面布局破坏。

## 开发环境

要求 Node.js 20.19 或更新版本。

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`，建议在浏览器开发者工具中切换到 390 × 844 的手机视口。

## 提交前自检

```bash
npm run typecheck
npm run test
npm run build
```

如修改了交互流程，请尽量补充或更新 `e2e/smoke.mjs`。

## Android 相关改动

Android 工程在 `android/`，构建和签名说明见 [android/README.md](android/README.md)。

修改 Web 代码后需要重新同步到原生工程：

```bash
npm run android:sync
```

## 不要提交真实账本数据

- `data/`、`android/keystore/`、`android/local.properties`、`dist/`、`node_modules/` 都已在 `.gitignore` 中忽略。
- 截图和测试数据请使用合成数据，不要包含真实姓名、账户尾号、备注或真实消费记录。
- 如果发现敏感信息被误提交，请立即提 Issue 或联系维护者处理，不要只在后续 commit 中删除。

## Pull Request

- 保持改动聚焦，一个 PR 解决一个问题。
- 说明用户可见的变化，以及你如何验证。
- UI 改动请附手机尺寸截图。
- 不要为了引入新依赖而引入，先说明为什么现有实现不够。

## License

提交代码即表示你同意以 [MIT License](LICENSE) 授权你的贡献。
