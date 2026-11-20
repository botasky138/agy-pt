# AGY-PT — Antigravity Periodic Table Model Picker

把 Antigravity 桌面端的模型下拉列表替换成一张完整的 **118 元素周期表**，并将二级推理档位切换与 `View Usage` 实时额度用量直接整合到元素格边框上。

所有文件独立运行在 `%LOCALAPPDATA%\Antigravity-Hans\`，不改动 Antigravity 原版安装目录，常规软件更新不会覆盖或使其失效。

## 核心功能

- **118 化学元素周期表选模**
  - 已上线的 Gemini 4 元素系模型（`1 H` Hydrogen、`10 Ne` Neon、`18 Ar` Argon 等）原位亮起对应元素格，直接点选；`6 C` Carbon 处于 `Unavailable` 时自动灰显禁用，恢复可用后自动亮起。
  - 未来官方上线任意 118 种化学元素同名模型时，对应灰色虚拟槽位会自动激活。
  - 其余未发布元素可点击打开虚拟预留槽位，支持一键标记/取消「即将发布」（持久化到 `localStorage`）。
- **级联二级推理档位真实同步与切换**
  - 自动在后台静默读取原版二级子菜单的真实档位并执行两步级联切换，每个模型严格显示自身实际拥有的档位：
    - `Gemini 4 Hydrogen` (`1 H`)、`Gemini 4 Neon` (`10 Ne`)：`低 / 中 / 高 / Extra`
    - `Gemini 4 Argon` (`18 Ar`)、`Gemini 3.8 Flash`、`Claude Opus 5.5`、`Claude Sonnet 5.5`：`低 / 中 / 高`
    - `GPT-OSS 120B (Medium)`：单一固定版本，直接切换
- **表外模型与第三方模型分区**
  - 元素表下方单独放置 `3.8 Flash` 模块与合并后的 `Orchestrator` 模块（`Neon / Argon` 直接切换，不占用元素表、不附加推理档位）。
  - 底部 `Other models` 展示 Claude、GPT、DeepSeek 等其他厂商模型。
- **实时额度边框（单层 / 内外双层）**
  - 自动静默解析原版 `View Usage` 实时额度池，直接用顺时针 SVG 边框长度展示剩余额度：**满额整圈显现，消耗后按比例缩短，用完时边框消失**。
  - 同一模型同时存在每周与 5 小时两个额度池时（如 Gemini 模型、Claude 和 GPT 模型），以内外两层边框同时展示（**外框绿 = 周额度**，**内框蓝 = 5h 额度**）；单池模型（如 `Gemini 4 Argon` 仅周额度）仅展示单层外框。
  - 右上角提供「用量详情」面板与「刷新用量」按钮，悬停任意模型也可查看具体百分比与重置倒计时。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `periodic-model-picker.js` | 元素周期表模型选择器核心模块（Shadow DOM 隔离，v3.1.0） |
| `periodic-model-config.json` | 配置文件（元素别名绑定、即将发布标记、经典模型白名单与配色） |
| `Sync-HansOverlay.ps1` | 自动提取 `antigravity-hans-windows-amd64.exe` 内嵌汉化并与本模块合成 `antigravity-hans-overlay.js` |
| `Install-AgyPT.ps1` | Windows 一键安装 / 更新 / 卸载脚本 |

## 安装与使用（Windows）

前提：已安装并使用 Antigravity-Hans（默认目录 `%LOCALAPPDATA%\Antigravity-Hans\`，目录下包含 `antigravity-hans-windows-amd64.exe`）。

### 1. 一键安装

```powershell
git clone https://github.com/botasky138/agy-pt.git
cd agy-pt
powershell -ExecutionPolicy Bypass -File .\Install-AgyPT.ps1
```

### 2. 启动方式

使用 `--trust-external-overlay` 启动 `antigravity-hans-windows-amd64.exe` 即可加载合成后的 `antigravity-hans-overlay.js`：

```powershell
& "$env:LOCALAPPDATA\Antigravity-Hans\antigravity-hans-windows-amd64.exe" --app --trust-external-overlay
```

推荐在你的启动脚本中先执行一次 `Sync-HansOverlay.ps1`（带 SHA-256 缓存校验，未变更时毫秒级跳过；当 `antigravity-hans-windows-amd64.exe` 或配置文件更新时自动重新合成）。

### 3. 快捷键与临时回退

- 点选模型后按数字键 `1`-`4` 快速选择对应推理档位或 Orchestrator 版本。
- 按 `Esc` 逐级返回或关闭弹窗。
- 点击弹窗右上角「原版列表」，或按住 `Shift` 点击主界面模型按钮，可临时打开 Antigravity 原版下拉菜单。

### 4. 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-AgyPT.ps1 -Uninstall
```

## 自定义配置与扩展 API

- **配置文件**：编辑 `%LOCALAPPDATA%\Antigravity-Hans\periodic-model-config.json` 中的 `elementBindings` 可将内部代号或别名映射到任意元素符号；修改后运行 `Sync-HansOverlay.ps1 -Force` 重新合成。
- **运行时接口**：注入后在全局暴露 `window.__ANTIGRAVITY_PERIODIC_API__`：
  - `registerElementModel(symbol, descriptor)` / `unregisterElementModel(symbol)`：动态注册或注销元素模型
  - `registerMatcher(symbol, regexOrFn)`：追加自定义模型名匹配规则
  - `setComingSoon(symbol, metaOrNull, persist)`：动态设置或取消即将发布标记
  - `registerVirtualHook(fn)`：接管未发布虚拟槽位的点击回调
  - `refreshUsage()`：重新静默拉取实时额度用量
  - `getRegistrySnapshot()`：导出全部 118 元素槽位、档位与额度快照

## License

[MIT](./LICENSE)
