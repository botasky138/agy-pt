# AGY-PT — Antigravity Periodic Table Model Picker

把 Antigravity 桌面端的模型下拉列表替换成一张完整的 **118 元素周期表**，并将二级推理档位切换与 `View Usage` 实时额度用量直接整合到元素格边框上。

所有文件独立运行在用户应用数据目录（macOS：`~/Library/Application Support/AGY-PT/` 或 `~/Library/Application Support/Antigravity-Hans/`；Windows：`%LOCALAPPDATA%\Antigravity-Hans\`），**不改动 Antigravity 原版安装目录与签名**，常规软件更新不会覆盖或使其失效。

## 核心功能

- **118 化学元素周期表选模**
  - 已上线的 Gemini 4 元素系模型（`1 H` Hydrogen、`10 Ne` Neon、`18 Ar` Argon 等）原位亮起对应元素格，直接点选；`6 C` Carbon 处于 `Unavailable` 时自动灰显禁用，恢复可用后自动亮起。
  - 未来官方上线任意 118 种化学元素同名模型时，对应灰色虚拟槽位会自动激活。
  - 其余未发布元素可点击打开虚拟预留槽位，支持一键标记/取消「即将发布」（持久化到 `localStorage`）。
- **级联二/三级推理档位真实同步与切换**
  - 自动在后台静默读取原版二级/三级子菜单的真实选项并执行级联切换，每个模型严格显示自身实际拥有的档位：
    - `Gemini 4 Hydrogen` (`1 H`)、`Gemini 4 Neon` (`10 Ne`)：`低 / 中 / 高 / 超高 (Extra High)`
    - `Gemini 4 Argon` (`18 Ar`)、`Gemini 3.8 Flash`、`Claude Opus 5.5`、`Claude Sonnet 5.5`：`低 / 中 / 高`
    - `GPT-OSS 120B (Medium)`：单一固定版本，直接切换
- **表外模型与第三方模型分区**
  - 元素表下方单独放置 `3.8 Flash` 模块与升级后的 `Orchestrator` 模块：完整适配原版三级级联结构（`Gemini 4 Neon` 4 档、`Gemini 4 Argon` 3 档、`Claude Opus 5.5` 3 档，及未来新增模型自动探测），各底层模型独立映射对应额度池。
  - 底部 `Other models` 展示 Claude、GPT、DeepSeek 等其他厂商模型。
- **实时额度边框（单层 / 内外双层）**
  - 自动静默解析原版 `View Usage` 实时额度池，直接用顺时针 SVG 边框长度展示剩余额度：**满额整圈显现，消耗后按比例缩短，用完时边框消失**。
  - 同一模型同时存在每周与 5 小时两个额度池时（如 Gemini 模型、Claude 和 GPT 模型），以内外两层边框同时展示（**外框绿 = 周额度**，**内框蓝 = 5h 额度**）；单池模型（如 `Gemini 4 Argon` 仅周额度）仅展示单层外框。
  - 右上角提供「用量详情」面板与「刷新用量」按钮，悬停任意模型也可查看具体百分比与重置倒计时。

## 文件说明

| 文件 | 适用平台 | 作用 |
| --- | --- | --- |
| `periodic-model-picker.js` | macOS / Windows | 元素周期表模型选择器核心模块（Shadow DOM 隔离，v3.3.0） |
| `periodic-model-config.json` | macOS / Windows | 配置文件（元素别名绑定、即将发布标记、经典模型白名单与配色） |
| `macos/install.sh` | macOS | macOS 一键安装 / 更新 / 卸载脚本，自动生成 `~/Applications/Antigravity PT.app` |
| `macos/launch-agy-pt.sh` | macOS | macOS 统一启动器（自动识别 Antigravity-Hans 联动模式或免汉化独立 CDP 模式） |
| `macos/sync-hans-overlay.sh` | macOS | 从 macOS 版 `antigravity-hans-macos-*` 提取内嵌汉化并与本模块合成 `antigravity-hans-overlay.js` |
| `macos/agy-pt-cdp.pl` | macOS | 零第三方依赖的原生 Perl CDP 注入守护进程（独立模式专用，支持多窗口与配置热重载） |
| `Sync-HansOverlay.ps1` | Windows | 自动提取 `antigravity-hans-windows-amd64.exe` 内嵌汉化并与本模块合成 `antigravity-hans-overlay.js` |
| `Install-AgyPT.ps1` | Windows | Windows 一键安装 / 更新 / 卸载脚本 |

## 安装与使用（macOS）

支持 Apple Silicon (`arm64`) 与 Intel (`x86_64`) Mac，**零第三方依赖**（仅使用 macOS 系统原生 `bash` 与 `/usr/bin/perl`，无需安装 Xcode 命令行工具、Python、Node.js 或 Homebrew）。

提供两种运行模式，启动器默认自动选择：
1. **免汉化独立模式（开箱即用）**：无需安装 `Antigravity-Hans`，直接以本机回环 CDP 端口驱动原版 `/Applications/Antigravity.app` 并自动注入元素周期表，支持多窗口发现与配置文件热重载。
2. **Antigravity-Hans 联动模式（汉化 + 元素周期表）**：若你同时使用 [Antigravity-Hans](https://github.com/yuexps/Antigravity-Hans)（`antigravity-hans-macos-arm64` / `antigravity-hans-macos-amd64`），自动从 Mach-O 二进制提取最新内嵌汉化并合成 `antigravity-hans-overlay.js`，通过 `--trust-external-overlay` 启动。

### 1. 一键安装

```bash
cd agy-pt

# 默认安装（若存在 ~/Library/Application Support/Antigravity-Hans 则自动联动，否则安装到 ~/Library/Application Support/AGY-PT）
./macos/install.sh

# 若你的 Antigravity-Hans 放在自定义目录，可直接指定：
./macos/install.sh --hans-bin /path/to/antigravity-hans-macos-arm64

# 如需同时在 ~/.local/bin/agy-pt 创建终端快捷命令：
./macos/install.sh --link-bin
```

安装完成后会自动在 `~/Applications/` 生成 **`Antigravity PT.app`**（复用原版图标，可拖入 Dock 或用 Spotlight 启动）。

### 2. 启动方式

- **图形界面启动（推荐）**：在「访达 → 个人 → 应用程序」或 Spotlight 中直接打开 **`Antigravity PT.app`**。
  - 若 `Antigravity` 正在以普通无调试模式运行，会弹出原生对话框询问是否优雅重启（保留当前会话）。
- **终端启动**：

```bash
# 自动选择模式（有 Hans 走联动，无 Hans 走独立模式）
"$HOME/Library/Application Support/AGY-PT/launch-agy-pt.sh"

# 若 Antigravity 已在普通模式运行，自动优雅重启并启用周期表
"$HOME/Library/Application Support/AGY-PT/launch-agy-pt.sh" --restart

# 强制走免汉化独立模式 / 指定 Antigravity IDE
"$HOME/Library/Application Support/AGY-PT/launch-agy-pt.sh" --mode standalone --target app
"$HOME/Library/Application Support/AGY-PT/launch-agy-pt.sh" --target ide

# 查看当前模式、进程与 CDP 状态
"$HOME/Library/Application Support/AGY-PT/launch-agy-pt.sh" --status
```

- **单独同步 Antigravity-Hans Overlay（与 Windows `Sync-HansOverlay.ps1` 对等）**：

```bash
./macos/sync-hans-overlay.sh --hans-dir "$HOME/Library/Application Support/Antigravity-Hans"
# 之后使用 --trust-external-overlay 启动：
"$HOME/Library/Application Support/Antigravity-Hans/antigravity-hans-macos-arm64" --app --trust-external-overlay
```

> 首次运行从 GitHub 下载的 `antigravity-hans-macos-*` 时，若系统提示无法验证开发者，请先赋予执行权限并在「系统设置 → 隐私与安全性」放行（或执行 `chmod +x` 与 `xattr -dr com.apple.quarantine`）。

### 3. 卸载（macOS）

```bash
./macos/install.sh --uninstall
# 若安装到了自定义目录：
./macos/install.sh --uninstall --target-dir /path/to/dir
```

卸载会停止后台 CDP 守护进程、移除 AGY-PT 脚本与 `Antigravity PT.app`，并保留 Antigravity 原版应用及你的 `antigravity-hans-macos-*` 二进制文件。

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

### 3. 卸载（Windows）

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-AgyPT.ps1 -Uninstall
```

## 快捷键与临时回退

- 点选模型后按数字键 `1`-`4` 快速选择对应推理档位或 Orchestrator 版本（已自动忽略 `⌘` / `⌃` / `⌥` 修饰键组合，不冲突 macOS 系统快捷键）。
- 按 `Esc` 逐级返回或关闭弹窗。
- 点击弹窗右上角「原版列表」，或按住 `Shift` 点击主界面模型按钮，可临时打开 Antigravity 原版下拉菜单。

## 自定义配置与扩展 API

- **配置文件**：编辑安装目录下的 `periodic-model-config.json` 中的 `elementBindings` 可将内部代号或别名映射到任意元素符号：
  - macOS 独立模式：保存后约 2 秒内自动热重载生效，无需重启。
  - macOS Hans 模式：运行 `sync-hans-overlay.sh --force` 重新合成。
  - Windows Hans 模式：运行 `Sync-HansOverlay.ps1 -Force` 重新合成。
- **运行时接口**：注入后在全局暴露 `window.__ANTIGRAVITY_PERIODIC_API__`：
  - `registerElementModel(symbol, descriptor)` / `unregisterElementModel(symbol)`：动态注册或注销元素模型
  - `registerMatcher(symbol, regexOrFn)`：追加自定义模型名匹配规则
  - `setComingSoon(symbol, metaOrNull, persist)`：动态设置或取消即将发布标记
  - `registerVirtualHook(fn)`：接管未发布虚拟槽位的点击回调
  - `refreshUsage()`：重新静默拉取实时额度用量
  - `getRegistrySnapshot()`：导出全部 118 元素槽位、档位与额度快照

## License

[MIT](./LICENSE)
