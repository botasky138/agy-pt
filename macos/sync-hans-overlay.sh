#!/usr/bin/env bash
# sync-hans-overlay.sh — macOS 版自动合成 Antigravity-Hans 外部脚本（原版动态汉化 + 元素周期表模型选择器）
# 对应 Windows 版 Sync-HansOverlay.ps1，零第三方依赖（仅使用 macOS 原生 bash + /usr/bin/perl）。
# 当 antigravity-hans-macos-*、periodic-model-picker.js 或 periodic-model-config.json 任一更新时，
# 本脚本会自动重新提取最新汉化基座并重新合成 antigravity-hans-overlay.js。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HANS_DIR=""
HANS_BIN=""
PICKER_PATH=""
CONFIG_PATH=""
OUT_PATH=""
FORCE=0

usage() {
  cat <<'EOF'
用法: sync-hans-overlay.sh [选项]

选项:
  -d, --hans-dir <dir>   Antigravity-Hans 所在目录（默认：脚本所在目录或 ~/Library/Application Support/Antigravity-Hans）
  -b, --hans-bin <file>  显式指定 antigravity-hans macOS 二进制路径
      --picker <file>    指定 periodic-model-picker.js 路径
      --config <file>    指定 periodic-model-config.json 路径
      --out <file>       指定输出的 antigravity-hans-overlay.js 路径
  -f, --force            忽略 SHA-256 缓存，强制重新提取并合成
  -h, --help             显示本帮助信息
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--hans-dir)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      HANS_DIR="$2"
      shift 2
      ;;
    -b|--hans-bin)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      HANS_BIN="$2"
      shift 2
      ;;
    --picker)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      PICKER_PATH="$2"
      shift 2
      ;;
    --config)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      CONFIG_PATH="$2"
      shift 2
      ;;
    --out)
      [ $# -ge 2 ] || { echo "错误: $1 需要参数" >&2; exit 1; }
      OUT_PATH="$2"
      shift 2
      ;;
    -f|--force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "错误: 未知参数: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

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

if [ -n "$HANS_BIN" ]; then
  if [ ! -f "$HANS_BIN" ]; then
    echo "错误: 未找到指定的 Antigravity-Hans 二进制: $HANS_BIN" >&2
    exit 1
  fi
  HANS_BIN="$(cd "$(dirname "$HANS_BIN")" && pwd)/$(basename "$HANS_BIN")"
  if [ -z "$HANS_DIR" ]; then
    HANS_DIR="$(dirname "$HANS_BIN")"
  fi
fi

if [ -z "$HANS_DIR" ]; then
  if HANS_BIN="$(find_hans_bin_in_dir "$SCRIPT_DIR")"; then
    HANS_DIR="$SCRIPT_DIR"
  elif HANS_BIN="$(find_hans_bin_in_dir "$HOME/Library/Application Support/Antigravity-Hans")"; then
    HANS_DIR="$HOME/Library/Application Support/Antigravity-Hans"
  elif HANS_BIN="$(find_hans_bin_in_dir "$HOME/Library/Application Support/AGY-PT")"; then
    HANS_DIR="$HOME/Library/Application Support/AGY-PT"
  else
    HANS_DIR="$SCRIPT_DIR"
  fi
else
  if [ ! -d "$HANS_DIR" ]; then
    echo "错误: 目录不存在: $HANS_DIR" >&2
    exit 1
  fi
  HANS_DIR="$(cd "$HANS_DIR" && pwd)"
fi

if [ -z "$HANS_BIN" ]; then
  if ! HANS_BIN="$(find_hans_bin_in_dir "$HANS_DIR")"; then
    echo "错误: 未在 $HANS_DIR 找到 Antigravity-Hans macOS 主程序（如 antigravity-hans-macos-arm64 或 antigravity-hans-macos-amd64）。" >&2
    echo "提示: 可通过 --hans-bin 指定路径，或使用 launch-agy-pt.sh --mode standalone 免汉化独立运行。" >&2
    exit 1
  fi
fi

if [ -z "$PICKER_PATH" ]; then
  if [ -f "$HANS_DIR/periodic-model-picker.js" ]; then
    PICKER_PATH="$HANS_DIR/periodic-model-picker.js"
  elif [ -f "$SCRIPT_DIR/periodic-model-picker.js" ]; then
    PICKER_PATH="$SCRIPT_DIR/periodic-model-picker.js"
  elif [ -f "$SCRIPT_DIR/../periodic-model-picker.js" ]; then
    PICKER_PATH="$(cd "$SCRIPT_DIR/.." && pwd)/periodic-model-picker.js"
  else
    echo "错误: 未找到元素周期表模块脚本 periodic-model-picker.js" >&2
    exit 1
  fi
fi

if [ ! -f "$PICKER_PATH" ]; then
  echo "错误: 未找到元素周期表模块脚本: $PICKER_PATH" >&2
  exit 1
fi

if [ -z "$CONFIG_PATH" ]; then
  if [ -f "$HANS_DIR/periodic-model-config.json" ]; then
    CONFIG_PATH="$HANS_DIR/periodic-model-config.json"
  elif [ -f "$SCRIPT_DIR/periodic-model-config.json" ]; then
    CONFIG_PATH="$SCRIPT_DIR/periodic-model-config.json"
  elif [ -f "$SCRIPT_DIR/../periodic-model-config.json" ]; then
    CONFIG_PATH="$(cd "$SCRIPT_DIR/.." && pwd)/periodic-model-config.json"
  else
    CONFIG_PATH="$HANS_DIR/periodic-model-config.json"
  fi
fi

if [ -z "$OUT_PATH" ]; then
  OUT_PATH="$HANS_DIR/antigravity-hans-overlay.js"
fi

CACHE_BASE="$HANS_DIR/hans-base-overlay.cache.js"
STATE_PATH="$HANS_DIR/.overlay-sync.state.json"

/usr/bin/perl - "$HANS_BIN" "$PICKER_PATH" "$CONFIG_PATH" "$OUT_PATH" "$CACHE_BASE" "$STATE_PATH" "$FORCE" <<'PERL_EOF'
use strict;
use warnings;
use Digest::SHA qw(sha256_hex);
use JSON::PP qw(decode_json encode_json);
use File::Copy qw(move);
use POSIX qw(strftime);

my ($bin_path, $picker_path, $config_path, $out_path, $cache_base, $state_path, $force) = @ARGV;
my $sync_ver = '1.1.0-mac';

sub read_raw_file {
  my ($p) = @_;
  open my $fh, '<:raw', $p or die "无法读取文件 $p: $!\n";
  local $/;
  my $data = <$fh>;
  close $fh;
  return defined($data) ? $data : '';
}

sub write_raw_file {
  my ($p, $data) = @_;
  open my $fh, '>:raw', $p or die "无法写入文件 $p: $!\n";
  print {$fh} $data or die "写入文件失败 $p: $!\n";
  close $fh or die "关闭文件失败 $p: $!\n";
}

sub sha256_file_safe {
  my ($p) = @_;
  return '' unless defined($p) && -f $p;
  open my $fh, '<:raw', $p or return '';
  my $sha = Digest::SHA->new(256);
  $sha->addfile($fh);
  close $fh;
  return lc($sha->hexdigest);
}

# 1. 快速哈希校验：若所有输入文件均未变化且输出文件存在，直接跳过重建实现零延迟启动
my $exe_hash    = sha256_file_safe($bin_path);
my $picker_hash = sha256_file_safe($picker_path);
my $config_hash = sha256_file_safe($config_path);

if (!$force && -f $out_path && -f $state_path) {
  my $ok = eval {
    my $prev = decode_json(read_raw_file($state_path));
    return ref($prev) eq 'HASH'
      && ($prev->{syncVer}    // '') eq $sync_ver
      && ($prev->{exeHash}    // '') eq $exe_hash
      && ($prev->{pickerHash} // '') eq $picker_hash
      && ($prev->{configHash} // '') eq $config_hash;
  };
  if ($ok) {
    print "Overlay up-to-date (cached): $out_path\n";
    exit 0;
  }
}

# 2. 从 macOS Mach-O 二进制精确字节级提取 Go //go:embed 内嵌的 antigravity-hans-overlay.js
sub extract_hans_base_overlay {
  my ($path) = @_;
  my $bytes = read_raw_file($path);
  my $total = length($bytes);

  my $marker   = '__antigravityZhPatchInstalled';
  my $cleanup  = '__antigravityZhPatchCleanup';
  my $iife_arr = '(() => {';
  my $iife_fn  = '(function';
  my $dom_sig  = 'DOMContentLoaded';
  my $close_sig = '})();';

  my $pos = 0;
  my $script_start = -1;

  while ((my $hit = index($bytes, $marker, $pos)) >= 0) {
    my $cleanup_pos = index($bytes, $cleanup, $hit);
    if ($cleanup_pos > $hit && ($cleanup_pos - $hit) < 900) {
      my $search_from = $hit - 400;
      $search_from = 0 if $search_from < 0;
      my $candidate = -1;
      for my $sig ($iife_arr, $iife_fn) {
        my $p = $search_from;
        my $s;
        while (($s = index($bytes, $sig, $p)) >= 0 && $s < $hit) {
          $candidate = $s if $s > $candidate;
          $p = $s + length($sig);
        }
      }
      if ($candidate >= 0) {
        $script_start = $candidate;
        last;
      }
    }
    $pos = $hit + length($marker);
  }

  return undef if $script_start < 0;

  my $max_end = $script_start + 1048576;
  $max_end = $total if $max_end > $total;
  my $script_end = -1;

  # 优先在脚本起点之后定位 DOMContentLoaded 块及其紧随的结尾 '})();'
  my $scan_dom = $script_start + 5000;
  my $last_dom = -1;
  while ($scan_dom < $max_end) {
    my $d = index($bytes, $dom_sig, $scan_dom);
    last if $d < 0 || $d >= $max_end;
    $last_dom = $d;
    $scan_dom = $d + length($dom_sig);
  }

  if ($last_dom > $script_start) {
    my $close_pos = index($bytes, $close_sig, $last_dom);
    if ($close_pos > $last_dom && ($close_pos - $last_dom) < 600) {
      $script_end = $close_pos + length($close_sig);
    }
  }

  # 兜底：若未来新版未含 DOMContentLoaded，则在首个非法二进制控制字节前取最后一个 '})();'
  if ($script_end < 0) {
    my $window = substr($bytes, $script_start, $max_end - $script_start);
    my $safe_len = length($window);
    if ($window =~ /[\x00-\x08\x0B\x0C\x0E-\x1F]/) {
      $safe_len = $-[0];
    }
    my $safe_end = $script_start + $safe_len;
    my $scan_close = $script_start + 5000;
    my $last_close = -1;
    while ($scan_close < $safe_end) {
      my $c = index($bytes, $close_sig, $scan_close);
      last if $c < 0 || $c >= $safe_end;
      $last_close = $c;
      $scan_close = $c + length($close_sig);
    }
    if ($last_close > $script_start) {
      $script_end = $last_close + length($close_sig);
    }
  }

  return undef if $script_end <= ($script_start + 5000);

  # 保留单个末尾换行（与原内嵌文件字节级一致）
  if ($script_end < $total && ord(substr($bytes, $script_end, 1)) == 10) {
    $script_end += 1;
  }

  my $extracted = substr($bytes, $script_start, $script_end - $script_start);
  return undef if index($extracted, $cleanup) < 0;
  return $extracted;
}

my $base_script = extract_hans_base_overlay($bin_path);
if (defined $base_script) {
  write_raw_file($cache_base, $base_script);
} elsif (-f $cache_base) {
  warn "警告: 从新版 Hans 提取内嵌脚本失败，已回退使用缓存汉化基座: $cache_base\n";
  $base_script = read_raw_file($cache_base);
} else {
  die "错误: 无法从 $bin_path 提取原版汉化基座，且不存在缓存基座。\n";
}

# 3. 读取可选外部配置（验证 JSON 格式，损坏时忽略自定义配置并使用内置默认）
my $config_json = '{}';
if (-f $config_path) {
  my $raw_cfg = read_raw_file($config_path);
  my $valid = eval { decode_json($raw_cfg); 1 };
  if ($valid) {
    $raw_cfg =~ s/^\s+|\s+$//g;
    $config_json = $raw_cfg;
  } else {
    my $err = $@ || 'unknown error';
    $err =~ s/\s+$//;
    warn "警告: periodic-model-config.json 格式无效，将使用内置默认配置: $err\n";
  }
}

my $picker_script = read_raw_file($picker_path);
$base_script   =~ s/\s+\z//;
$picker_script =~ s/\s+\z//;

# 4. 合成最终的 antigravity-hans-overlay.js（原版汉化 + 配置 + 元素周期表模型选择器）
my $combined = join("\n",
  $base_script,
  '',
  '// ============================================================================',
  '// Antigravity Periodic Model Picker (Update-Safe Overlay Extension)',
  '// 自动合成文件，请勿直接手工修改；如需调整配置请编辑 periodic-model-config.json',
  '// ============================================================================',
  "window.__ANTIGRAVITY_PERIODIC_CONFIG__ = $config_json;",
  $picker_script,
  ''
);

my $tmp_out = "$out_path.tmp.$$";
write_raw_file($tmp_out, $combined);
move($tmp_out, $out_path) or die "无法移动临时文件到 $out_path: $!\n";
chmod(0644, $out_path);

my $out_bytes = -s $out_path;

# 5. 写入同步状态缓存
my $updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', gmtime());
my $state_json = JSON::PP->new->utf8(1)->pretty(1)->canonical(1)->encode({
  syncVer     => $sync_ver,
  platform    => 'darwin',
  updatedAt   => $updated_at,
  hansBin     => $bin_path,
  exeHash     => $exe_hash,
  pickerHash  => $picker_hash,
  configHash  => $config_hash,
  outputBytes => int($out_bytes),
});
write_raw_file($state_path, $state_json);

print "Synthesized overlay OK: $out_path ($out_bytes bytes)\n";
PERL_EOF

# 温馨提示 macOS 执行权限与 Gatekeeper quarantine 属性（不擅自修改用户二进制）
if [ ! -x "$HANS_BIN" ]; then
  echo "提示: $HANS_BIN 当前没有可执行权限，启动前请先执行: chmod +x \"$HANS_BIN\""
fi
if command -v xattr >/dev/null 2>&1 && xattr -p com.apple.quarantine "$HANS_BIN" >/dev/null 2>&1; then
  echo "提示: 检测到 $HANS_BIN 带有 macOS 隔离属性 (com.apple.quarantine)，若首次运行被拦截可在「系统设置 -> 隐私与安全性」放行，或执行: xattr -dr com.apple.quarantine \"$HANS_BIN\""
fi
