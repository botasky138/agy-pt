# AGY-PT 开发与验证约定

- **改动输入框 UI 前先看真实 DOM**：修改 `periodic-model-picker.js` 的注入位置或布局时，优先通过运行中客户端的本地 CDP 端口核实祖先节点的 `display`/`flex-direction`/`justify-content` 与实际坐标；挂载到按钮旁时应向上找到最近的非 `space-between` 横向 `flex` 行插入兄弟节点，不直接包裹或重排 React 原生节点。
- **热更新与本地重装**：修改 `periodic-model-picker.js` 后递增 `MODULE_BUILD`，以便运行中的 `agy-pt-cdp.pl` 在 2 秒内自动热更并清理旧实例；本地更新运行 `./macos/install.sh`（不要无故加 `--force`，避免覆盖本地配置和重复联网拉取 `hans-base-overlay.js`）。
- **验证基线**：改动后运行 `perl -c macos/agy-pt-cdp.pl`、`bash -n macos/install.sh`、`node vendor/agy-dart/scripts/verify-package-graph.mjs` 与 `node --test tests/hud-and-telemetry.test.mjs`；沙箱内避免直接跑 `node --check periodic-model-picker.js`（改用测试内的 `vm.Script` 校验）。
