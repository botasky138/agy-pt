#!/usr/bin/env bash
# install.sh — macOS 版 AGY-PT 一键安装 / 更新 / 卸载脚本
# 对应 Windows 版 Install-AgyPT.ps1，同时支持：
#   1) Antigravity-Hans 联动模式（自动提取内嵌汉化 + 合成 antigravity-hans-overlay.js）
#   2) 原生免汉化独立 CDP 模式（直接驱动原版 /Applications/Antigravity.app）
#   3) 生成原生双击应用 ~/Applications/Antigravity PT.app（不修改 Antigravity 原版目录）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_DIR=""
HANS_BIN=""
HANS_OVERLAY_SRC=""
APP_DIR="$HOME/Applications"
BIN_DIR="$HOME/.local/bin"
TARGET="app"         # app | ide
LAUNCHER_MODE="auto" # auto | hans | standalone
FORCE=0
UNINSTALL=0
CREATE_APP=1
LINK_BIN=0
NO_HANS=0
UPDATE_HANS=0
WITH_DART=1
DART_MODE=""
DART_TARGET=""
UNINSTALL_DART=0

usage() {
  cat <<'EOF'
用法: macos/install.sh [选项]

选项:
  -d, --target-dir <dir>    安装目录（默认：若存在 ~/Library/Application Support/Antigravity-Hans 则复用，否则 ~/Library/Application Support/AGY-PT）
      --hans-dir <dir>      同 --target-dir，指定 Antigravity-Hans 目录
  -b, --hans-bin <file>     显式指定 antigravity-hans macOS 二进制路径
      --hans-overlay <file> 指定本地全局中文汉化脚本文件（离线安装时使用）
      --update-hans         强制重新拉取最新官方 Antigravity-Hans 全局中文汉化基座
      --no-hans             不下载/不启用全局中文汉化（仅英文界面 + 中文元素周期表）
      --with-dart           同时安装内置 agy-dart 加速与上下文护栏插件（默认开启）
      --no-dart             跳过安装 agy-dart 插件（仅安装界面增强）
      --dart-mode <mode>    设置 agy-dart 保护模式: host-45k（默认）| fast-32k | balanced-16k | strict-8k | no-read-hook
      --dart-target <dir>   指定 agy-dart 安装目标目录（仅测试或自定义目录时使用）
      --uninstall-dart      配合 --uninstall 使用时一并卸载 agy-dart 插件
  -m, --mode <mode>         写入快捷应用默认模式: auto（默认）| hans | standalone
  -t, --target <target>     目标客户端: app（Antigravity，默认）| ide（Antigravity IDE）
      --app-dir <dir>       快捷启动 .app 生成目录（默认: ~/Applications）
      --no-app              不生成 Antigravity PT.app 快捷启动应用
      --link-bin            在 ~/.local/bin/agy-pt 创建命令行快捷软链（可用 --bin-dir 自定义目录）
      --bin-dir <dir>       命令行软链目录（默认: ~/.local/bin）
  -f, --force               覆盖已有的 periodic-model-config.json 配置与缓存
  -u, --uninstall           一键卸载 AGY-PT（保留 Antigravity 原版及用户 Hans 二进制）
  -h, --help                显示本帮助信息
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--target-dir|--hans-dir)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      TARGET_DIR="$2"; shift 2 ;;
    -b|--hans-bin)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      HANS_BIN="$2"; shift 2 ;;
    --hans-overlay)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      HANS_OVERLAY_SRC="$2"; shift 2 ;;
    --update-hans)
      UPDATE_HANS=1; shift ;;
    --no-hans)
      NO_HANS=1; shift ;;
    --with-dart)
      WITH_DART=1; shift ;;
    --no-dart)
      WITH_DART=0; shift ;;
    --dart-mode)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      DART_MODE="$2"; shift 2 ;;
    --dart-target)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      DART_TARGET="$2"; shift 2 ;;
    --uninstall-dart)
      UNINSTALL_DART=1; shift ;;
    -m|--mode)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      LAUNCHER_MODE="$2"; shift 2 ;;
    -t|--target)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      TARGET="$2"; shift 2 ;;
    --app-dir)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      APP_DIR="$2"; shift 2 ;;
    --no-app)
      CREATE_APP=0; shift ;;
    --link-bin)
      LINK_BIN=1; shift ;;
    --bin-dir)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      BIN_DIR="$2"; LINK_BIN=1; shift 2 ;;
    -f|--force)
      FORCE=1; shift ;;
    -u|--uninstall)
      UNINSTALL=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "错误: 未知参数: $1" >&2
      usage >&2
      exit 1 ;;
  esac
done

case "$LAUNCHER_MODE" in
  auto|hans|standalone) ;;
  *) echo "错误: 无效的 --mode: $LAUNCHER_MODE" >&2; exit 1 ;;
esac

case "$TARGET" in
  app|ide) ;;
  *) echo "错误: 无效的 --target: $TARGET" >&2; exit 1 ;;
esac

if [ -n "$HANS_BIN" ]; then
  if [ ! -f "$HANS_BIN" ]; then
    echo "错误: 未找到指定的 Antigravity-Hans 二进制: $HANS_BIN" >&2
    exit 1
  fi
  HANS_BIN="$(cd "$(dirname "$HANS_BIN")" && pwd)/$(basename "$HANS_BIN")"
  if [ -z "$TARGET_DIR" ]; then
    TARGET_DIR="$(dirname "$HANS_BIN")"
  fi
fi

DEFAULT_HANS_DIR="$HOME/Library/Application Support/Antigravity-Hans"
DEFAULT_STANDALONE_DIR="$HOME/Library/Application Support/AGY-PT"

if [ -z "$TARGET_DIR" ]; then
  if [ -d "$DEFAULT_HANS_DIR" ]; then
    TARGET_DIR="$DEFAULT_HANS_DIR"
  else
    TARGET_DIR="$DEFAULT_STANDALONE_DIR"
  fi
fi

WRAPPER_NAME="Antigravity PT"
WRAPPER_BUNDLE_ID="com.agypt.launcher.app"
SOURCE_APP_NAME="Antigravity.app"
if [ "$TARGET" = "ide" ]; then
  WRAPPER_NAME="Antigravity IDE PT"
  WRAPPER_BUNDLE_ID="com.agypt.launcher.ide"
  SOURCE_APP_NAME="Antigravity IDE.app"
fi
WRAPPER_APP="$APP_DIR/$WRAPPER_NAME.app"

find_hans_bin_in_dir() {
  local dir="$1"
  [ -d "$dir" ] || return 1
  local arch
  arch="$(uname -m 2>/dev/null || echo arm64)"
  local candidates=()
  if [ "$arch" = "arm64" ]; then
    candidates=(
      "antigravity-hans-macos-arm64"
      "antigravity-hans-darwin-arm64"
      "antigravity-hans"
      "antigravity-hans-macos-universal"
      "antigravity-hans-macos-amd64"
      "antigravity-hans-darwin-amd64"
    )
  else
    candidates=(
      "antigravity-hans-macos-amd64"
      "antigravity-hans-darwin-amd64"
      "antigravity-hans"
      "antigravity-hans-macos-universal"
      "antigravity-hans-macos-arm64"
      "antigravity-hans-darwin-arm64"
    )
  fi
  local name
  for name in "${candidates[@]}"; do
    if [ -f "$dir/$name" ]; then
      printf '%s\n' "$dir/$name"
      return 0
    fi
  done
  return 1
}

stop_cdp_daemons_in_dir() {
  local dir="$1"
  local pf pid
  for pf in "$dir/.agy-pt-cdp-app.pid" "$dir/.agy-pt-cdp-ide.pid"; do
    if [ -f "$pf" ]; then
      pid="$(cat "$pf" 2>/dev/null || true)"
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo "已停止 CDP 守护进程: PID=$pid"
      fi
      rm -f "$pf"
    fi
  done
}

# ============================================================================
# 卸载流程
# ============================================================================
if [ "$UNINSTALL" -eq 1 ]; then
  if [ -d "$TARGET_DIR" ]; then
    stop_cdp_daemons_in_dir "$TARGET_DIR"
    for f in \
      "periodic-model-picker.js" \
      "periodic-model-config.json" \
      "telemetry-bridge.mjs" \
      "sync-hans-overlay.sh" \
      "launch-agy-pt.sh" \
      "agy-pt-cdp.pl" \
      "antigravity-hans-overlay.js" \
      "hans-base-overlay.js" \
      "hans-base-overlay.cache.js" \
      ".overlay-sync.state.json" \
      ".agy-pt-cdp-app.pid" \
      ".agy-pt-cdp-ide.pid"
    do
      p="$TARGET_DIR/$f"
      if [ -e "$p" ]; then
        rm -f "$p"
        echo "已移除: $p"
      fi
    done
    # 仅在目录已空且为独立 AGY-PT 目录时移除空目录，保护 Antigravity-Hans 目录内的用户文件
    if [ "$(basename "$TARGET_DIR")" = "AGY-PT" ]; then
      rmdir "$TARGET_DIR" 2>/dev/null && echo "已移除空目录: $TARGET_DIR" || true
    fi
  else
    echo "提示: 安装目录不存在，跳过文件清理: $TARGET_DIR"
  fi

  if [ -d "$WRAPPER_APP" ]; then
    rm -rf "$WRAPPER_APP"
    echo "已移除快捷启动应用: $WRAPPER_APP"
  fi

  if [ -L "$BIN_DIR/agy-pt" ]; then
    link_target="$(readlink "$BIN_DIR/agy-pt" 2>/dev/null || true)"
    case "$link_target" in
      *"launch-agy-pt.sh")
        rm -f "$BIN_DIR/agy-pt"
        echo "已移除命令行软链: $BIN_DIR/agy-pt"
        ;;
    esac
  fi

  echo "卸载完成。Antigravity 原版应用未受任何影响。"
  if [ "$UNINSTALL_DART" -eq 1 ] && [ -f "$REPO_DIR/vendor/agy-dart/scripts/install.mjs" ]; then
    for nc in "$(command -v node 2>/dev/null || true)" "$HOME/.local/bin/node" "/opt/homebrew/bin/node" "/usr/local/bin/node"; do
      if [ -n "$nc" ] && [ -x "$nc" ]; then
        if [ -n "$DART_TARGET" ]; then
          "$nc" "$REPO_DIR/vendor/agy-dart/scripts/install.mjs" uninstall --target "$DART_TARGET" || true
        else
          "$nc" "$REPO_DIR/vendor/agy-dart/scripts/install.mjs" uninstall || true
        fi
        break
      fi
    done
  fi
  exit 0
fi

# ============================================================================
# 安装 / 更新流程
# ============================================================================
for req in \
  "$REPO_DIR/periodic-model-picker.js" \
  "$REPO_DIR/periodic-model-config.json" \
  "$SCRIPT_DIR/sync-hans-overlay.sh" \
  "$SCRIPT_DIR/launch-agy-pt.sh" \
  "$SCRIPT_DIR/agy-pt-cdp.pl"
do
  if [ ! -f "$req" ]; then
    echo "错误: 仓库缺少必需文件: $req" >&2
    exit 1
  fi
done

mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# 1. 复制核心脚本
cp -f "$REPO_DIR/periodic-model-picker.js" "$TARGET_DIR/periodic-model-picker.js"
cp -f "$SCRIPT_DIR/sync-hans-overlay.sh"   "$TARGET_DIR/sync-hans-overlay.sh"
cp -f "$SCRIPT_DIR/launch-agy-pt.sh"       "$TARGET_DIR/launch-agy-pt.sh"
cp -f "$SCRIPT_DIR/agy-pt-cdp.pl"          "$TARGET_DIR/agy-pt-cdp.pl"
if [ -f "$REPO_DIR/telemetry-bridge.mjs" ]; then
  cp -f "$REPO_DIR/telemetry-bridge.mjs" "$TARGET_DIR/telemetry-bridge.mjs"
fi
chmod +x "$TARGET_DIR/sync-hans-overlay.sh" "$TARGET_DIR/launch-agy-pt.sh" "$TARGET_DIR/agy-pt-cdp.pl"
echo "已安装核心脚本到: $TARGET_DIR"

# 2. 复制配置文件（已有配置默认保留，--force 时覆盖）
DST_CFG="$TARGET_DIR/periodic-model-config.json"
if [ "$FORCE" -eq 1 ] || [ ! -f "$DST_CFG" ]; then
  cp -f "$REPO_DIR/periodic-model-config.json" "$DST_CFG"
  echo "已写入配置: $DST_CFG"
else
  echo "保留已有配置（如需覆盖请追加 --force）: $DST_CFG"
fi

# 3. 准备全局中文汉化基座 &（如有 Hans 二进制）合成 antigravity-hans-overlay.js
DETECTED_HANS="$HANS_BIN"
if [ -z "$DETECTED_HANS" ]; then
  DETECTED_HANS="$(find_hans_bin_in_dir "$TARGET_DIR" || true)"
fi

DST_HANS_OVERLAY="$TARGET_DIR/hans-base-overlay.js"
HANS_OVERLAY_URL="https://raw.githubusercontent.com/yuexps/Antigravity-Hans/main/antigravity-hans-overlay.js"

validate_hans_overlay_file() {
  local f="$1"
  [ -f "$f" ] || return 1
  local sz
  sz="$(wc -c < "$f" | tr -d ' ')"
  [ -n "$sz" ] && [ "$sz" -gt 1024 ] && [ "$sz" -le 2097152 ] || return 1
  grep -q "__antigravityZhPatchInstalled" "$f" || return 1
  return 0
}

if [ -n "$DETECTED_HANS" ] && [ -f "$DETECTED_HANS" ]; then
  echo "检测到 Antigravity-Hans 二进制: $DETECTED_HANS"
  bash "$TARGET_DIR/sync-hans-overlay.sh" \
    --hans-dir "$TARGET_DIR" \
    --hans-bin "$DETECTED_HANS" \
    --picker "$TARGET_DIR/periodic-model-picker.js" \
    --config "$DST_CFG" \
    --force
  if [ "$NO_HANS" -eq 0 ] && [ -f "$TARGET_DIR/hans-base-overlay.cache.js" ]; then
    cp -f "$TARGET_DIR/hans-base-overlay.cache.js" "$DST_HANS_OVERLAY"
    chmod 644 "$DST_HANS_OVERLAY"
  fi
elif [ "$NO_HANS" -eq 1 ]; then
  echo "已跳过全局中文汉化（--no-hans），将以英文原版 + 元素周期表运行。"
else
  if [ -n "$HANS_OVERLAY_SRC" ]; then
    if validate_hans_overlay_file "$HANS_OVERLAY_SRC"; then
      cp -f "$HANS_OVERLAY_SRC" "$DST_HANS_OVERLAY"
      chmod 644 "$DST_HANS_OVERLAY"
      echo "全局中文汉化基座已就绪（本地导入）: $DST_HANS_OVERLAY"
    else
      echo "警告: 指定的全局汉化脚本无效（体积超限或缺少 __antigravityZhPatchInstalled 标记）: $HANS_OVERLAY_SRC" >&2
    fi
  elif [ "$UPDATE_HANS" -eq 1 ] || [ "$FORCE" -eq 1 ] || [ ! -f "$DST_HANS_OVERLAY" ]; then
    TMP_HANS="$DST_HANS_OVERLAY.tmp.$$"
    echo "正在拉取官方全局中文汉化基座 (yuexps/Antigravity-Hans, MIT)..."
    if /usr/bin/curl -fsSL --connect-timeout 10 --max-time 30 "$HANS_OVERLAY_URL" -o "$TMP_HANS" 2>/dev/null && validate_hans_overlay_file "$TMP_HANS"; then
      chmod 644 "$TMP_HANS"
      mv -f "$TMP_HANS" "$DST_HANS_OVERLAY"
      echo "全局中文汉化基座已就绪: ${DST_HANS_OVERLAY}（来源: yuexps/Antigravity-Hans, MIT）"
    else
      rm -f "$TMP_HANS"
      echo "警告: 未能自动下载 Antigravity-Hans 全局汉化基座（离线或网络受限），本次仅启用元素周期表；联网后可运行 --update-hans 补装，或用 --hans-overlay 指定本地文件。" >&2
    fi
  else
    echo "保留已有全局中文汉化基座（如需更新请追加 --update-hans）: $DST_HANS_OVERLAY"
  fi
fi

# 4. 生成 macOS 原生快捷启动 .app 包装器（优先使用 osacompile 生成 Universal Mach-O 应用 + ad-hoc 签名）
if [ "$CREATE_APP" -eq 1 ]; then
  mkdir -p "$APP_DIR"
  rm -rf "$WRAPPER_APP"

  # 复用原版 Antigravity 图标
  ICON_SRC=""
  for cand in \
    "/Applications/$SOURCE_APP_NAME/Contents/Resources/icon.icns" \
    "$HOME/Applications/$SOURCE_APP_NAME/Contents/Resources/icon.icns" \
    "/Applications/$SOURCE_APP_NAME/Contents/Resources/AppIcon.icns" \
    "$HOME/Applications/$SOURCE_APP_NAME/Contents/Resources/AppIcon.icns"
  do
    if [ -f "$cand" ]; then
      ICON_SRC="$cand"
      break
    fi
  done

  # 使用 printf '%q' 安全转义路径（兼容含空格的 Application Support 路径）
  Q_LAUNCH="$(printf '%q' "$TARGET_DIR/launch-agy-pt.sh")"
  Q_DATA_DIR="$(printf '%q' "$TARGET_DIR")"
  Q_MODE="$(printf '%q' "$LAUNCHER_MODE")"
  Q_TARGET="$(printf '%q' "$TARGET")"
  EXTRA_HANS_ARG=""
  if [ -n "$HANS_BIN" ]; then
    Q_HANS_BIN="$(printf '%q' "$HANS_BIN")"
    EXTRA_HANS_ARG=" --hans-bin $Q_HANS_BIN"
  fi
  if [ "$NO_HANS" -eq 1 ]; then
    EXTRA_HANS_ARG="${EXTRA_HANS_ARG} --no-hans"
  fi

  if [ -x /usr/bin/osacompile ]; then
    TMP_SCPT="${TMPDIR:-/tmp}/agy-pt-launcher-$$.js"
    cat >"$TMP_SCPT" <<'JXA_EOF'
ObjC.import('Foundation');
function run() {
  var app = Application.currentApplication();
  app.includeStandardAdditions = true;
  try {
    var resPath = ObjC.unwrap($.NSBundle.mainBundle.resourcePath);
    var scriptPath = resPath + '/launcher.sh';
    var q = "'" + scriptPath.replace(/'/g, "'\\''") + "'";
    app.doShellScript('/bin/bash ' + q);
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    if (msg.indexOf('-128') < 0) {
      try {
        app.displayAlert('AGY-PT 启动失败', { message: msg, as: 'warning', buttons: ['确定'] });
      } catch (_) {}
    }
  }
}
JXA_EOF
    /usr/bin/osacompile -l JavaScript -o "$WRAPPER_APP" "$TMP_SCPT"
    rm -f "$TMP_SCPT"

    cat >"$WRAPPER_APP/Contents/Resources/launcher.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:\${PATH:-}"
exec /bin/bash $Q_LAUNCH --gui --mode $Q_MODE --target $Q_TARGET --data-dir $Q_DATA_DIR${EXTRA_HANS_ARG}
EOF
    chmod +x "$WRAPPER_APP/Contents/Resources/launcher.sh"

    if [ -n "$ICON_SRC" ]; then
      cp -f "$ICON_SRC" "$WRAPPER_APP/Contents/Resources/applet.icns"
    fi

    /usr/bin/plutil -replace CFBundleDisplayName -string "$WRAPPER_NAME" "$WRAPPER_APP/Contents/Info.plist"
    /usr/bin/plutil -replace CFBundleName -string "$WRAPPER_NAME" "$WRAPPER_APP/Contents/Info.plist"
    /usr/bin/plutil -replace CFBundleIdentifier -string "$WRAPPER_BUNDLE_ID" "$WRAPPER_APP/Contents/Info.plist"
    /usr/bin/plutil -replace CFBundleShortVersionString -string "3.4.0" "$WRAPPER_APP/Contents/Info.plist"
    /usr/bin/plutil -replace CFBundleVersion -string "340" "$WRAPPER_APP/Contents/Info.plist"
    /usr/bin/plutil -replace LSUIElement -bool true "$WRAPPER_APP/Contents/Info.plist"
  else
    mkdir -p "$WRAPPER_APP/Contents/MacOS" "$WRAPPER_APP/Contents/Resources"
    ICON_PLIST_ENTRY=""
    if [ -n "$ICON_SRC" ]; then
      cp -f "$ICON_SRC" "$WRAPPER_APP/Contents/Resources/AppIcon.icns"
      ICON_PLIST_ENTRY="  <key>CFBundleIconFile</key>
  <string>AppIcon.icns</string>"
    fi

    cat >"$WRAPPER_APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>${WRAPPER_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>${WRAPPER_BUNDLE_ID}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${WRAPPER_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>3.4.0</string>
  <key>CFBundleVersion</key>
  <string>340</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
${ICON_PLIST_ENTRY}
</dict>
</plist>
EOF

    cat >"$WRAPPER_APP/Contents/MacOS/launcher" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:\${PATH:-}"
exec /bin/bash $Q_LAUNCH --gui --mode $Q_MODE --target $Q_TARGET --data-dir $Q_DATA_DIR${EXTRA_HANS_ARG}
EOF
    chmod +x "$WRAPPER_APP/Contents/MacOS/launcher"
  fi

  # Ad-hoc 重新签名，确保现代 macOS LaunchServices 与 Gatekeeper 正常打开
  if [ -x /usr/bin/codesign ]; then
    /usr/bin/codesign --force --deep --sign - "$WRAPPER_APP" >/dev/null 2>&1 || true
  fi

  # 刷新图标缓存（失败不影响安装）
  touch "$WRAPPER_APP"
  LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  if [ -x "$LSREG" ]; then
    "$LSREG" -f "$WRAPPER_APP" >/dev/null 2>&1 || true
  fi
  echo "已生成快捷启动应用: $WRAPPER_APP"
fi

# 5. 可选命令行软链
if [ "$LINK_BIN" -eq 1 ]; then
  mkdir -p "$BIN_DIR"
  ln -sf "$TARGET_DIR/launch-agy-pt.sh" "$BIN_DIR/agy-pt"
  echo "已创建命令行快捷方式: $BIN_DIR/agy-pt"
fi

# 6. 自动安装内置 agy-dart 加速与上下文护栏插件（需要 Node.js >= 22）
DART_INSTALLER="$REPO_DIR/vendor/agy-dart/scripts/install.mjs"
if [ "$WITH_DART" -eq 1 ] && [ -f "$DART_INSTALLER" ]; then
  NODE_BIN=""
  for nc in \
    "$(command -v node 2>/dev/null || true)" \
    "$HOME/.local/bin/node" \
    "/opt/homebrew/bin/node" \
    "/usr/local/bin/node"
  do
    if [ -n "$nc" ] && [ -x "$nc" ]; then
      NODE_MAJOR="$("$nc" -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
      if [ "$NODE_MAJOR" -ge 22 ] 2>/dev/null; then
        NODE_BIN="$nc"
        break
      fi
    fi
  done

  if [ -n "$NODE_BIN" ]; then
    echo ""
    echo "正在安装内置 agy-dart 插件（加速批处理 + 上下文护栏）..."
    DART_ARGS=("$DART_INSTALLER" "install" "--with-devtools")
    [ -n "$DART_MODE" ] && DART_ARGS+=("--mode" "$DART_MODE")
    [ -n "$DART_TARGET" ] && DART_ARGS+=("--target" "$DART_TARGET")
    PATH="$(dirname "$NODE_BIN"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" "$NODE_BIN" "${DART_ARGS[@]}"
  else
    echo "提示: 未检测到 Node.js >= 22，已跳过内置 agy-dart 安装（AGY-PT 界面增强与周期表可正常使用）。"
  fi
fi

echo ""
echo "=== AGY-PT macOS 安装完成 ==="
if [ "$CREATE_APP" -eq 1 ]; then
  echo "双击启动: open \"$WRAPPER_APP\""
fi
echo "终端启动: \"$TARGET_DIR/launch-agy-pt.sh\""
echo "查看状态: \"$TARGET_DIR/launch-agy-pt.sh\" --status"
echo "配置文件: $DST_CFG"
