#!/usr/bin/env bash
# launch-agy-pt.sh — macOS 版 AGY-PT 统一启动器（支持 Antigravity-Hans 联动模式 & 免汉化独立 CDP 模式）
# 兼容 macOS 原生 Bash 3.2 + Perl 5，无需安装 Xcode CLT / Python / Node / Homebrew。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="auto"         # auto | hans | standalone
TARGET="app"        # app | ide
DATA_DIR=""
HANS_BIN=""
HANS_OVERLAY_PATH=""
NO_HANS=0
APP_PATH=""
CDP_PORT=""
RESTART=0
GUI_MODE=0
FORCE_SYNC=0
SHOW_STATUS=0
FOREGROUND=0
DETACH=0
DELAY_SEC=0

usage() {
  cat <<'EOF'
用法: launch-agy-pt.sh [选项]

选项:
  -m, --mode <mode>         运行模式: auto（默认，有 Hans 走联动，无 Hans 走独立）| hans | standalone
  -t, --target <target>     目标客户端: app（Antigravity.app，默认）| ide（Antigravity IDE.app）
  -d, --data-dir <dir>      AGY-PT / Antigravity-Hans 数据目录
  -b, --hans-bin <file>     显式指定 antigravity-hans macOS 二进制路径
      --hans-overlay <file> 显式指定全局中文汉化基座脚本（如 hans-base-overlay.js）
      --no-hans             禁用全局中文汉化，仅启用英文界面 + 中文元素周期表
      --app-path <path>     显式指定 .app 目录或可执行文件路径
  -p, --port <port>         独立模式使用的本机 CDP 端口（默认自动选择 19222-19299 空闲端口）
  -r, --restart             若 Antigravity 已在无调试模式下运行，自动优雅退出并重启
      --detach              脱离当前终端/父进程会话在后台执行（适合在客户端内部触发重启）
      --delay <sec>         启动前延迟秒数（常与 --detach --restart 配合使用）
      --force-sync          Hans 模式下忽略缓存强制重新合成 antigravity-hans-overlay.js
      --foreground          独立模式下在前台运行 CDP 守护进程（默认后台静默运行）
      --gui                 GUI 模式（用于 .app 包装器，出错或需重启时弹出原生对话框）
      --status              查看当前环境、模式、进程与 CDP 状态
  -h, --help                显示本帮助信息
EOF
}

ORIG_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -m|--mode)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      MODE="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    -t|--target)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      TARGET="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    -d|--data-dir|--hans-dir)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      DATA_DIR="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    -b|--hans-bin)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      HANS_BIN="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    --hans-overlay)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      HANS_OVERLAY_PATH="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    --no-hans)
      NO_HANS=1; ORIG_ARGS+=("$1"); shift ;;
    --app-path)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      APP_PATH="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    -p|--port)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      CDP_PORT="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    -r|--restart)
      RESTART=1; ORIG_ARGS+=("$1"); shift ;;
    --detach)
      DETACH=1; shift ;;
    --delay)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      DELAY_SEC="$2"; ORIG_ARGS+=("$1" "$2"); shift 2 ;;
    --force-sync)
      FORCE_SYNC=1; ORIG_ARGS+=("$1"); shift ;;
    --foreground)
      FOREGROUND=1; ORIG_ARGS+=("$1"); shift ;;
    --gui)
      GUI_MODE=1; ORIG_ARGS+=("$1"); shift ;;
    --status)
      SHOW_STATUS=1; ORIG_ARGS+=("$1"); shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "错误: 未知参数: $1" >&2
      usage >&2
      exit 1 ;;
  esac
done

if [ "$DETACH" -eq 1 ]; then
  DETACH_LOG_DIR="$HOME/Library/Logs/AGY-PT"
  mkdir -p "$DETACH_LOG_DIR" 2>/dev/null || DETACH_LOG_DIR="${TMPDIR:-/tmp}"
  DETACH_LOG="$DETACH_LOG_DIR/launcher.log"
  SELF_SCRIPT="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
  DETACH_PID="$(/usr/bin/perl -MPOSIX=setsid -e '
    my $log = shift @ARGV;
    my $pid = fork();
    die "fork failed: $!" unless defined $pid;
    if ($pid > 0) {
      print "$pid\n";
      exit 0;
    }
    setsid();
    open STDIN,  "<",  "/dev/null";
    open STDOUT, ">>", $log or open STDOUT, ">", "/dev/null";
    open STDERR, ">&STDOUT";
    exec("/bin/bash", @ARGV) or POSIX::_exit(127);
  ' "$DETACH_LOG" "$SELF_SCRIPT" ${ORIG_ARGS[@]+"${ORIG_ARGS[@]}"})"
  echo "已启动独立后台重启任务 (PID=$DETACH_PID, 日志=$DETACH_LOG)"
  exit 0
fi

if [ "$DELAY_SEC" -gt 0 ] 2>/dev/null; then
  sleep "$DELAY_SEC"
fi

case "$MODE" in
  auto|hans|standalone) ;;
  *) echo "错误: 无效的 --mode: ${MODE}（可选: auto, hans, standalone）" >&2; exit 1 ;;
esac

case "$TARGET" in
  app|ide) ;;
  *) echo "错误: 无效的 --target: ${TARGET}（可选: app, ide）" >&2; exit 1 ;;
esac

gui_alert() {
  local title="$1"
  local msg="$2"
  echo "$title: $msg" >&2
  if [ "$GUI_MODE" -eq 1 ] && command -v osascript >/dev/null 2>&1; then
    osascript - "$title" "$msg" <<'OSA_EOF' >/dev/null 2>&1 || true
on run argv
  tell current application
    activate
    display alert (item 1 of argv) message (item 2 of argv) as warning buttons {"确定"} default button "确定"
  end tell
end run
OSA_EOF
  fi
}

gui_confirm_restart() {
  local app_name="$1"
  if ! command -v osascript >/dev/null 2>&1; then
    return 1
  fi
  osascript - "$app_name" <<'OSA_EOF' >/dev/null 2>&1
on run argv
  set appName to item 1 of argv
  tell current application
    activate
    set dlg to display dialog (appName & " 正在以普通模式运行（未开启本地调试端口）。" & return & return & "是否优雅重启 " & appName & " 以启用 AGY-PT 元素周期表模型选择器？（会保留当前会话）") with title "AGY-PT 模型周期表" buttons {"取消", "优雅重启并启用"} default button "优雅重启并启用" cancel button "取消"
    return button returned of dlg
  end tell
end run
OSA_EOF
}

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

# 1. 定位数据目录与核心脚本
if [ -n "$DATA_DIR" ]; then
  if [ ! -d "$DATA_DIR" ]; then
    gui_alert "AGY-PT 启动失败" "指定的数据目录不存在: $DATA_DIR"
    exit 1
  fi
  DATA_DIR="$(cd "$DATA_DIR" && pwd)"
else
  if [ -f "$SCRIPT_DIR/periodic-model-picker.js" ]; then
    DATA_DIR="$SCRIPT_DIR"
  elif [ -f "$HOME/Library/Application Support/Antigravity-Hans/periodic-model-picker.js" ]; then
    DATA_DIR="$HOME/Library/Application Support/Antigravity-Hans"
  elif [ -f "$HOME/Library/Application Support/AGY-PT/periodic-model-picker.js" ]; then
    DATA_DIR="$HOME/Library/Application Support/AGY-PT"
  elif [ -f "$SCRIPT_DIR/../periodic-model-picker.js" ]; then
    DATA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  else
    DATA_DIR="$SCRIPT_DIR"
  fi
fi

PICKER_PATH=""
if [ -f "$DATA_DIR/periodic-model-picker.js" ]; then
  PICKER_PATH="$DATA_DIR/periodic-model-picker.js"
elif [ -f "$SCRIPT_DIR/periodic-model-picker.js" ]; then
  PICKER_PATH="$SCRIPT_DIR/periodic-model-picker.js"
elif [ -f "$SCRIPT_DIR/../periodic-model-picker.js" ]; then
  PICKER_PATH="$(cd "$SCRIPT_DIR/.." && pwd)/periodic-model-picker.js"
fi

CONFIG_PATH=""
if [ -f "$DATA_DIR/periodic-model-config.json" ]; then
  CONFIG_PATH="$DATA_DIR/periodic-model-config.json"
elif [ -f "$SCRIPT_DIR/periodic-model-config.json" ]; then
  CONFIG_PATH="$SCRIPT_DIR/periodic-model-config.json"
elif [ -f "$SCRIPT_DIR/../periodic-model-config.json" ]; then
  CONFIG_PATH="$(cd "$SCRIPT_DIR/.." && pwd)/periodic-model-config.json"
fi

SYNC_SCRIPT=""
if [ -f "$DATA_DIR/sync-hans-overlay.sh" ]; then
  SYNC_SCRIPT="$DATA_DIR/sync-hans-overlay.sh"
elif [ -f "$SCRIPT_DIR/sync-hans-overlay.sh" ]; then
  SYNC_SCRIPT="$SCRIPT_DIR/sync-hans-overlay.sh"
fi

CDP_SCRIPT=""
if [ -f "$DATA_DIR/agy-pt-cdp.pl" ]; then
  CDP_SCRIPT="$DATA_DIR/agy-pt-cdp.pl"
elif [ -f "$SCRIPT_DIR/agy-pt-cdp.pl" ]; then
  CDP_SCRIPT="$SCRIPT_DIR/agy-pt-cdp.pl"
fi

# 2. 探测 Antigravity-Hans 二进制与全局汉化基座脚本
if [ -z "$HANS_BIN" ]; then
  if HANS_BIN="$(find_hans_bin_in_dir "$DATA_DIR")"; then
    :
  elif HANS_BIN="$(find_hans_bin_in_dir "$HOME/Library/Application Support/Antigravity-Hans")"; then
    :
  elif HANS_BIN="$(find_hans_bin_in_dir "$HOME/Library/Application Support/AGY-PT")"; then
    :
  else
    HANS_BIN=""
  fi
fi

if [ "$NO_HANS" -eq 1 ]; then
  HANS_OVERLAY_PATH=""
elif [ -n "$HANS_OVERLAY_PATH" ]; then
  if [ ! -f "$HANS_OVERLAY_PATH" ]; then
    gui_alert "AGY-PT 启动失败" "未找到指定的全局汉化基座脚本: $HANS_OVERLAY_PATH"
    exit 1
  fi
  HANS_OVERLAY_PATH="$(cd "$(dirname "$HANS_OVERLAY_PATH")" && pwd)/$(basename "$HANS_OVERLAY_PATH")"
else
  for ov_cand in \
    "$DATA_DIR/hans-base-overlay.js" \
    "$DATA_DIR/hans-base-overlay.cache.js" \
    "$HOME/Library/Application Support/Antigravity-Hans/hans-base-overlay.js" \
    "$HOME/Library/Application Support/Antigravity-Hans/hans-base-overlay.cache.js"
  do
    if [ -f "$ov_cand" ]; then
      HANS_OVERLAY_PATH="$ov_cand"
      break
    fi
  done
fi

# 3. 探测 Antigravity.app / Antigravity IDE.app 可执行文件路径
APP_DISPLAY_NAME="Antigravity"
APP_BUNDLE_NAME="Antigravity.app"
APP_BIN_NAME="Antigravity"
if [ "$TARGET" = "ide" ]; then
  APP_DISPLAY_NAME="Antigravity IDE"
  APP_BUNDLE_NAME="Antigravity IDE.app"
  APP_BIN_NAME="Antigravity IDE"
fi

resolve_app_bin() {
  if [ -n "$APP_PATH" ]; then
    if [ -d "$APP_PATH" ] && [ -f "$APP_PATH/Contents/Info.plist" ]; then
      local exe_name
      exe_name="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "$APP_BIN_NAME")"
      printf '%s/Contents/MacOS/%s\n' "${APP_PATH%/}" "$exe_name"
      return 0
    elif [ -x "$APP_PATH" ]; then
      printf '%s\n' "$APP_PATH"
      return 0
    fi
    return 1
  fi

  local candidates=(
    "/Applications/$APP_BUNDLE_NAME/Contents/MacOS/$APP_BIN_NAME"
    "$HOME/Applications/$APP_BUNDLE_NAME/Contents/MacOS/$APP_BIN_NAME"
  )
  local p
  for p in "${candidates[@]}"; do
    if [ -x "$p" ]; then
      printf '%s\n' "$p"
      return 0
    fi
  done
  return 1
}

RESOLVED_APP_BIN=""
if RESOLVED_APP_BIN="$(resolve_app_bin)"; then
  :
else
  RESOLVED_APP_BIN=""
fi

# 4. 检测正在运行的 Antigravity 主进程及其 CDP 端口（避免管道提前退出触发 SIGPIPE 141）
detect_running_app() {
  local target_bin="$1"
  [ -n "$target_bin" ] || return 0
  /usr/bin/perl - "$target_bin" <<'PERL_EOF' 2>/dev/null || true
use strict;
use warnings;
my ($target) = @ARGV;
open my $ps, '-|', '/bin/ps', '-axo', 'pid=,args=' or exit 0;
my $found = '';
while (my $line = <$ps>) {
  next if length($found);
  $line =~ s/^\s+|\s+$//g;
  my ($pid, $args) = split(/\s+/, $line, 2);
  next unless defined $pid && defined $args;
  # 精确匹配主二进制路径，排除 Helper 子进程
  next unless index($args, $target) == 0;
  my $after = substr($args, length($target), 1);
  next if length($after) && $after ne ' ';
  my $port = '';
  if ($args =~ /--remote-debugging-port=(\d+)/) {
    $port = $1;
  }
  $found = "$pid|$port\n";
}
close $ps;
print $found if length($found);
PERL_EOF
}

find_free_port() {
  /usr/bin/perl -e '
    use IO::Socket::INET;
    for my $p (19222 .. 19299) {
      my $s = IO::Socket::INET->new(
        LocalAddr => "127.0.0.1",
        LocalPort => $p,
        Proto     => "tcp",
        Listen    => 1,
        ReuseAddr => 1,
      );
      if ($s) {
        close $s;
        print "$p\n";
        exit 0;
      }
    }
    exit 1;
  '
}

EFFECTIVE_MODE="$MODE"
if [ "$EFFECTIVE_MODE" = "auto" ]; then
  if [ -n "$HANS_BIN" ]; then
    EFFECTIVE_MODE="hans"
  else
    EFFECTIVE_MODE="standalone"
  fi
fi

RUNNING_INFO="$(detect_running_app "$RESOLVED_APP_BIN")"
RUNNING_PID="${RUNNING_INFO%%|*}"
RUNNING_PORT=""
if [ -n "$RUNNING_INFO" ]; then
  RUNNING_PORT="${RUNNING_INFO#*|}"
fi

PID_DIR="$DATA_DIR"
[ -w "$PID_DIR" ] || PID_DIR="${TMPDIR:-/tmp}/agy-pt"
mkdir -p "$PID_DIR"
PID_FILE="$PID_DIR/.agy-pt-cdp-${TARGET}.pid"

if [ "$SHOW_STATUS" -eq 1 ]; then
  echo "=== AGY-PT macOS 状态 ==="
  echo "请求模式:       $MODE (实际生效: $EFFECTIVE_MODE)"
  echo "目标客户端:     $APP_DISPLAY_NAME"
  echo "客户端路径:     ${RESOLVED_APP_BIN:-未检测到}"
  echo "数据目录:       $DATA_DIR"
  echo "周期表脚本:     ${PICKER_PATH:-未检测到}"
  echo "配置文件:       ${CONFIG_PATH:-使用内置默认}"
  if [ "$NO_HANS" -eq 1 ]; then
    echo "全局汉化基座:   已关闭 (--no-hans)"
  else
    echo "全局汉化基座:   ${HANS_OVERLAY_PATH:-未启用（仅英文原版 + 中文周期表）}"
  fi
  echo "Hans 二进制:    ${HANS_BIN:-未安装（将使用原生 CDP 模式）}"
  if [ -n "$RUNNING_PID" ]; then
    if [ -n "$RUNNING_PORT" ]; then
      echo "客户端运行状态: 运行中 (PID=$RUNNING_PID, CDP=127.0.0.1:$RUNNING_PORT)"
    else
      echo "客户端运行状态: 运行中 (PID=$RUNNING_PID, 未开启 CDP 调试端口)"
    fi
  else
    echo "客户端运行状态: 未运行"
  fi
  if [ -f "$PID_FILE" ]; then
    wpid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$wpid" ] && kill -0 "$wpid" 2>/dev/null; then
      echo "CDP 守护进程:   运行中 (PID=$wpid)"
    else
      echo "CDP 守护进程:   未运行（存在过期 PID 文件）"
    fi
  else
    echo "CDP 守护进程:   未运行"
  fi
  exit 0
fi

if [ -z "$PICKER_PATH" ] || [ ! -f "$PICKER_PATH" ]; then
  gui_alert "AGY-PT 启动失败" "未找到核心模块 periodic-model-picker.js，请先运行 macos/install.sh 安装。"
  exit 1
fi

# ============================================================================
# 模式 A: Antigravity-Hans 联动模式（动态汉化 + 元素周期表）
# ============================================================================
if [ "$EFFECTIVE_MODE" = "hans" ]; then
  if [ -z "$HANS_BIN" ] || [ ! -f "$HANS_BIN" ]; then
    gui_alert "未找到 Antigravity-Hans" "未在数据目录找到 antigravity-hans-macos-* 二进制。可改用 --mode standalone 免汉化独立启动。"
    exit 1
  fi
  if [ ! -x "$HANS_BIN" ]; then
    gui_alert "权限不足" "$HANS_BIN 没有可执行权限，请在终端执行：chmod +x \"$HANS_BIN\""
    exit 1
  fi

  HANS_DIR="$(dirname "$HANS_BIN")"
  if [ -n "$SYNC_SCRIPT" ] && [ -f "$SYNC_SCRIPT" ]; then
    sync_args=(--hans-dir "$HANS_DIR" --hans-bin "$HANS_BIN" --picker "$PICKER_PATH")
    [ -n "$CONFIG_PATH" ] && [ -f "$CONFIG_PATH" ] && sync_args+=(--config "$CONFIG_PATH")
    [ "$FORCE_SYNC" -eq 1 ] && sync_args+=(--force)
    bash "$SYNC_SCRIPT" "${sync_args[@]}"
  fi

  target_flag="--app"
  [ "$TARGET" = "ide" ] && target_flag="--ide"

  echo "正在通过 Antigravity-Hans 启动 ${APP_DISPLAY_NAME}（汉化 + AGY-PT 元素周期表）..."
  if [ "$GUI_MODE" -eq 1 ]; then
    LOG_DIR="$HOME/Library/Logs/AGY-PT"
    mkdir -p "$LOG_DIR"
    nohup "$HANS_BIN" "$target_flag" --trust-external-overlay >>"$LOG_DIR/hans.log" 2>&1 </dev/null &
    exit 0
  else
    exec "$HANS_BIN" "$target_flag" --trust-external-overlay
  fi
fi

# ============================================================================
# 模式 B: macOS 原生独立 CDP 模式（无需 Antigravity-Hans，零第三方依赖）
# ============================================================================
if [ -z "$RESOLVED_APP_BIN" ] || [ ! -x "$RESOLVED_APP_BIN" ]; then
  gui_alert "未找到 $APP_DISPLAY_NAME" "未在 /Applications 或 ~/Applications 找到 ${APP_BUNDLE_NAME}，请先安装或使用 --app-path 指定路径。"
  exit 1
fi

if [ -z "$CDP_SCRIPT" ] || [ ! -f "$CDP_SCRIPT" ]; then
  gui_alert "AGY-PT 启动失败" "未找到原生 CDP 注入模块 agy-pt-cdp.pl。"
  exit 1
fi

ATTACH_PORT=""
WATCH_PID=""

if [ -n "$RUNNING_PID" ]; then
  if [ -n "$RUNNING_PORT" ]; then
    echo "检测到 $APP_DISPLAY_NAME 已在调试模式运行 (PID=$RUNNING_PID, CDP=127.0.0.1:$RUNNING_PORT)，直接挂载元素周期表..."
    ATTACH_PORT="$RUNNING_PORT"
    WATCH_PID="$RUNNING_PID"
    osascript -e "tell application \"$APP_DISPLAY_NAME\" to activate" >/dev/null 2>&1 || true
  else
    SHOULD_RESTART="$RESTART"
    if [ "$SHOULD_RESTART" -eq 0 ] && [ "$GUI_MODE" -eq 1 ]; then
      if gui_confirm_restart "$APP_DISPLAY_NAME"; then
        SHOULD_RESTART=1
      else
        exit 0
      fi
    fi

    if [ "$SHOULD_RESTART" -eq 0 ]; then
      echo "检测到 $APP_DISPLAY_NAME 正在以普通模式运行 (PID=$RUNNING_PID)，未开启本地调试端口。" >&2
      echo "提示: Electron 客户端需在启动时传入 --remote-debugging-port 才能注入元素周期表。" >&2
      echo "请先退出 $APP_DISPLAY_NAME 后重试，或直接运行：" >&2
      echo "  \"$0\" --mode standalone --target $TARGET --restart" >&2
      exit 2
    fi

    echo "正在优雅退出 $APP_DISPLAY_NAME (PID=$RUNNING_PID)..."
    osascript -e "tell application \"$APP_DISPLAY_NAME\" to quit" >/dev/null 2>&1 || true

    wait_ok=0
    term_sent=0
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
      if ! kill -0 "$RUNNING_PID" 2>/dev/null; then
        wait_ok=1
        break
      fi
      # 若 AppleEvents 自动化权限未授予导致 osascript quit 未生效，3 秒后发送 SIGTERM 优雅退出（Electron 热退出同样保留会话）
      if [ "$i" -eq 6 ] && [ "$term_sent" -eq 0 ]; then
        term_sent=1
        kill -TERM "$RUNNING_PID" 2>/dev/null || true
      fi
      sleep 0.5
    done
    if [ "$wait_ok" -ne 1 ]; then
      gui_alert "优雅退出超时" "$APP_DISPLAY_NAME (PID=$RUNNING_PID) 在 15 秒内未退出，为保护未保存会话已停止操作。请手动退出后再启动 AGY-PT。"
      exit 1
    fi
    # 留出短暂缓冲让 Electron 单实例锁文件完全释放
    sleep 0.5
  fi
fi

if [ -z "$ATTACH_PORT" ]; then
  if [ -n "$CDP_PORT" ]; then
    ATTACH_PORT="$CDP_PORT"
  else
    ATTACH_PORT="$(find_free_port)" || {
      gui_alert "端口分配失败" "未能在 19222-19299 之间找到可用的本机回环端口，请通过 --port 手动指定。"
      exit 1
    }
  fi

  echo "正在启动 ${APP_DISPLAY_NAME}（本机 CDP 端口: 127.0.0.1:${ATTACH_PORT}）..."
  case "$RESOLVED_APP_BIN" in
    *.app/Contents/MacOS/*)
      APP_BUNDLE_DIR="${RESOLVED_APP_BIN%/Contents/MacOS/*}"
      /usr/bin/open -a "$APP_BUNDLE_DIR" --args \
        "--remote-debugging-port=$ATTACH_PORT" \
        "--remote-debugging-address=127.0.0.1"
      for _ in 1 2 3 4 5 6 7 8 9 10; do
        NEW_INFO="$(detect_running_app "$RESOLVED_APP_BIN")"
        NEW_PID="${NEW_INFO%%|*}"
        if [ -n "$NEW_PID" ]; then
          WATCH_PID="$NEW_PID"
          break
        fi
        sleep 0.5
      done
      ;;
    *)
      nohup "$RESOLVED_APP_BIN" \
        "--remote-debugging-port=$ATTACH_PORT" \
        "--remote-debugging-address=127.0.0.1" \
        >/dev/null 2>&1 </dev/null &
      WATCH_PID="$!"
      ;;
  esac
fi

LOG_DIR="$HOME/Library/Logs/AGY-PT"
if ! mkdir -p "$LOG_DIR" 2>/dev/null; then
  LOG_DIR="$PID_DIR"
fi
LOG_FILE="$LOG_DIR/cdp-${TARGET}.log"

cdp_args=(
  "$CDP_SCRIPT"
  --port "$ATTACH_PORT"
  --picker "$PICKER_PATH"
  --pid-file "$PID_FILE"
)
if [ -n "$CONFIG_PATH" ] && [ -f "$CONFIG_PATH" ]; then
  cdp_args+=(--config "$CONFIG_PATH")
fi
if [ "$NO_HANS" -eq 0 ] && [ -n "$HANS_OVERLAY_PATH" ] && [ -f "$HANS_OVERLAY_PATH" ]; then
  cdp_args+=(--hans-overlay "$HANS_OVERLAY_PATH")
fi
if [ -n "$WATCH_PID" ]; then
  cdp_args+=(--watch-pid "$WATCH_PID")
fi

if [ "$FOREGROUND" -eq 1 ]; then
  exec /usr/bin/perl "${cdp_args[@]}"
else
  # 使用 POSIX 双 fork + setsid 彻底脱离当前进程组与管道，防止被终端关闭或 AppleScript 阻塞
  DAEMON_PID="$(/usr/bin/perl -MPOSIX=setsid -e '
    my $log = shift @ARGV;
    pipe(my $r, my $w) or die "pipe: $!";
    my $pid1 = fork();
    die "fork1 failed: $!" unless defined $pid1;
    if ($pid1 > 0) {
      close $w;
      my $dpid = <$r>;
      close $r;
      waitpid($pid1, 0);
      print($dpid // "");
      exit 0;
    }
    close $r;
    setsid();
    $SIG{HUP}  = "IGNORE";
    $SIG{PIPE} = "IGNORE";
    my $pid2 = fork();
    if (!defined $pid2) { POSIX::_exit(1); }
    if ($pid2 > 0) {
      print {$w} "$pid2\n";
      close $w;
      POSIX::_exit(0);
    }
    close $w;
    open STDIN,  "<",  "/dev/null";
    open STDOUT, ">>", $log or open STDOUT, ">", "/dev/null";
    open STDERR, ">&STDOUT";
    exec("/usr/bin/perl", @ARGV) or POSIX::_exit(127);
  ' "$LOG_FILE" "${cdp_args[@]}")"
  echo "AGY-PT 独立 CDP 守护进程已启动 (PID=$DAEMON_PID, 端口=127.0.0.1:$ATTACH_PORT)"
  echo "日志文件: $LOG_FILE"
fi
