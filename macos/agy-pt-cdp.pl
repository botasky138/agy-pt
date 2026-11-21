#!/usr/bin/perl
# agy-pt-cdp.pl — macOS 原生零依赖 CDP 注入守护进程（独立模式，无需 Antigravity-Hans）
# 仅使用 macOS 自带 Perl 5 标准库（IO::Socket::INET, IO::Select, JSON::PP, Digest::SHA, MIME::Base64）。
# 通过本机 127.0.0.1 Chrome DevTools Protocol 自动向 Antigravity 本地页面注入元素周期表模型选择器，
# 支持多窗口自动发现、页面刷新持久生效、配置文件热重载与随主进程自动退出。

use strict;
use warnings;
use Getopt::Long qw(GetOptions);
use IO::Socket::INET;
use IO::Select;
use Digest::SHA qw(sha1 sha256_hex);
use MIME::Base64 qw(encode_base64);
use JSON::PP qw(decode_json encode_json);
use Encode qw(decode_utf8 encode_utf8);
use POSIX qw(strftime);

my $port         = 0;
my $picker_path  = '';
my $config_path  = '';
my $watch_pid    = 0;
my $pid_file     = '';
my $interval     = 2;
my $startup_wait = 30;
my $once         = 0;
my $quiet        = 0;
my $help         = 0;

$| = 1;

sub log_msg {
  my ($msg) = @_;
  return if $quiet;
  my $ts = strftime('%H:%M:%S', localtime());
  print "[AGY-PT $ts] $msg\n";
}

sub log_err {
  my ($msg) = @_;
  my $ts = strftime('%H:%M:%S', localtime());
  print STDERR "[AGY-PT $ts] $msg\n";
}

my $running = 1;
sub cleanup_pid_file {
  return unless $pid_file && -f $pid_file;
  if (open my $fh, '<', $pid_file) {
    my $recorded = <$fh>;
    close $fh;
    if (defined $recorded && $recorded =~ /^\s*(\d+)\s*$/ && $1 == $$) {
      unlink $pid_file;
    }
  }
}

sub read_raw_file {
  my ($p) = @_;
  open my $fh, '<:raw', $p or die "无法读取 $p: $!\n";
  local $/;
  my $data = <$fh>;
  close $fh;
  return defined($data) ? $data : '';
}

sub file_stat_sig {
  my ($p) = @_;
  return 'missing' unless defined($p) && length($p) && -f $p;
  my @st = stat($p);
  return 'missing' unless @st;
  return "$st[7]:$st[9]";
}

my $cached_sig     = '';
my $cached_payload = '';
my $cached_hash    = '';

sub load_payload_if_changed {
  my $sig = file_stat_sig($picker_path) . '|' . file_stat_sig($config_path);
  return ($cached_payload, $cached_hash) if $sig eq $cached_sig && length($cached_payload);

  my $config_json = '{}';
  if ($config_path && -f $config_path) {
    my $raw_cfg = read_raw_file($config_path);
    my $valid = eval { decode_json($raw_cfg); 1 };
    if ($valid) {
      $raw_cfg =~ s/^\s+|\s+$//g;
      $config_json = $raw_cfg;
    } else {
      my $err = $@ || 'invalid JSON';
      $err =~ s/\s+$//;
      log_err("警告: 配置文件 JSON 无效，回退默认配置: $err");
    }
  }

  my $picker_raw = read_raw_file($picker_path);
  $picker_raw =~ s/\s+\z//;

  my $combined_bytes = join("\n",
    '// AGY-PT macOS Standalone CDP Injection',
    "window.__ANTIGRAVITY_PERIODIC_CONFIG__ = $config_json;",
    $picker_raw,
    ''
  );

  $cached_sig     = $sig;
  $cached_hash    = sha256_hex($combined_bytes);
  $cached_payload = decode_utf8($combined_bytes);
  return ($cached_payload, $cached_hash);
}

sub read_exact {
  my ($sock, $need, $timeout) = @_;
  $timeout //= 5;
  my $buf = '';
  my $sel = IO::Select->new($sock);
  my $deadline = time() + $timeout;

  while (length($buf) < $need) {
    my $left = $deadline - time();
    return undef if $left <= 0;
    my @ready = $sel->can_read($left);
    return undef unless @ready;
    my $chunk = '';
    my $n = sysread($sock, $chunk, $need - length($buf));
    return undef if !defined($n) || $n == 0;
    $buf .= $chunk;
  }
  return $buf;
}

sub write_all {
  my ($sock, $data, $timeout) = @_;
  $timeout //= 5;
  my $sel = IO::Select->new($sock);
  my $offset = 0;
  my $len = length($data);
  my $deadline = time() + $timeout;

  while ($offset < $len) {
    my $left = $deadline - time();
    return 0 if $left <= 0;
    my @ready = $sel->can_write($left);
    return 0 unless @ready;
    my $n = syswrite($sock, $data, $len - $offset, $offset);
    return 0 if !defined($n) || $n <= 0;
    $offset += $n;
  }
  return 1;
}

sub decode_chunked_body {
  my ($raw) = @_;
  my $out = '';
  my $pos = 0;
  my $len = length($raw);
  while ($pos < $len) {
    my $crlf = index($raw, "\r\n", $pos);
    last if $crlf < 0;
    my $size_line = substr($raw, $pos, $crlf - $pos);
    $size_line =~ s/;.*$//;
    $size_line =~ s/\s+//g;
    last unless $size_line =~ /^[0-9a-fA-F]+$/;
    my $chunk_len = hex($size_line);
    $pos = $crlf + 2;
    last if $chunk_len == 0;
    $out .= substr($raw, $pos, $chunk_len);
    $pos += $chunk_len + 2;
  }
  return $out;
}

sub http_get_json_list {
  my ($cdp_port) = @_;
  my $sock = IO::Socket::INET->new(
    PeerAddr => '127.0.0.1',
    PeerPort => $cdp_port,
    Proto    => 'tcp',
    Timeout  => 2,
  );
  return undef unless $sock;
  binmode($sock);

  my $req = "GET /json/list HTTP/1.1\r\n"
          . "Host: 127.0.0.1:$cdp_port\r\n"
          . "Connection: close\r\n\r\n";
  unless (write_all($sock, $req, 3)) {
    close $sock;
    return undef;
  }

  my $raw = '';
  my $sel = IO::Select->new($sock);
  my $deadline = time() + 4;
  my $hdr_end = -1;
  my $content_len = undef;
  my $is_chunked = 0;

  while (1) {
    my $left = $deadline - time();
    last if $left <= 0;
    my @ready = $sel->can_read($left);
    last unless @ready;
    my $chunk = '';
    my $n = sysread($sock, $chunk, 65536);
    last if !defined($n) || $n == 0;
    $raw .= $chunk;

    if ($hdr_end < 0) {
      $hdr_end = index($raw, "\r\n\r\n");
      if ($hdr_end >= 0) {
        my $hdrs = substr($raw, 0, $hdr_end);
        if ($hdrs =~ /^Content-Length:\s*(\d+)/im) {
          $content_len = int($1);
        } elsif ($hdrs =~ /^Transfer-Encoding:\s*chunked\b/im) {
          $is_chunked = 1;
        }
      }
    }
    if ($hdr_end >= 0) {
      my $body_len = length($raw) - ($hdr_end + 4);
      if (defined($content_len) && $body_len >= $content_len) {
        last;
      }
      if ($is_chunked && index($raw, "\r\n0\r\n\r\n", $hdr_end) >= 0) {
        last;
      }
    }
  }
  close $sock;

  my $sep = index($raw, "\r\n\r\n");
  return undef if $sep < 0;

  my $headers = substr($raw, 0, $sep);
  my $body    = substr($raw, $sep + 4);
  return undef unless $headers =~ m{^HTTP/1\.[01]\s+200\b}i;

  if ($headers =~ /^Transfer-Encoding:\s*chunked\b/im) {
    $body = decode_chunked_body($body);
  } elsif ($headers =~ /^Content-Length:\s*(\d+)/im) {
    $body = substr($body, 0, $1) if length($body) > $1;
  }

  my $list = eval { decode_json($body) };
  return (ref($list) eq 'ARRAY') ? $list : undef;
}

sub is_allowed_target {
  my ($t) = @_;
  return 0 unless ref($t) eq 'HASH';
  my $ws = $t->{webSocketDebuggerUrl} // '';
  return 0 unless $ws =~ m{^ws://(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)(/.*)$}i;

  my $type = lc($t->{type} // '');
  return 0 unless $type eq 'page' || $type eq 'webview' || $type eq 'app';

  my $url = lc($t->{url} // '');
  return 0 if $url =~ m{^(?:devtools|chrome-extension|chrome|edge|about):};
  return 1 if $url eq '';
  return 1 if $url =~ m{^(?:file|vscode-file|vscode-webview|app|antigravity|plugin):};
  return 1 if $url =~ m{^https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:/|$)};
  return 0;
}

sub ws_handshake_on_sock {
  my ($sock, $host_header, $path) = @_;
  binmode($sock);

  my $rand_bytes = '';
  for (1 .. 16) {
    $rand_bytes .= chr(int(rand(256)));
  }
  my $ws_key = encode_base64($rand_bytes, '');
  my $expected_accept = encode_base64(sha1($ws_key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'), '');

  my $req = "GET $path HTTP/1.1\r\n"
          . "Host: $host_header\r\n"
          . "Upgrade: websocket\r\n"
          . "Connection: Upgrade\r\n"
          . "Sec-WebSocket-Key: $ws_key\r\n"
          . "Sec-WebSocket-Version: 13\r\n\r\n";

  return undef unless write_all($sock, $req, 3);

  my $resp = '';
  my $sel = IO::Select->new($sock);
  my $deadline = time() + 4;
  my $sep = -1;
  while ($sep < 0) {
    my $left = $deadline - time();
    return undef if $left <= 0;
    my @ready = $sel->can_read($left);
    return undef unless @ready;
    my $ch = '';
    my $n = sysread($sock, $ch, 4096);
    return undef if !defined($n) || $n == 0;
    $resp .= $ch;
    $sep = index($resp, "\r\n\r\n");
    return undef if length($resp) > 32768;
  }

  my $hdr = substr($resp, 0, $sep);
  my $leftover = substr($resp, $sep + 4);
  return undef if $hdr !~ m{^HTTP/1\.1\s+101\b}i;
  if ($hdr =~ /^Sec-WebSocket-Accept:\s*(\S+)/im) {
    return undef if $1 ne $expected_accept;
  }

  return { sock => $sock, buf => $leftover };
}

sub ws_connect {
  my ($ws_url) = @_;
  return undef unless $ws_url =~ m{^ws://(127\.0\.0\.1|localhost|\[::1\]):(\d+)(/.*)$}i;
  my ($host, $ws_port, $path) = ($1, $2, $3);
  my $peer_host = $host;
  $peer_host =~ s/^\[|\]$//g;

  my $sock = IO::Socket::INET->new(
    PeerAddr => $peer_host,
    PeerPort => $ws_port,
    Proto    => 'tcp',
    Timeout  => 3,
  );
  return undef unless $sock;

  my $conn = ws_handshake_on_sock($sock, "$host:$ws_port", $path);
  unless ($conn) {
    close $sock;
    return undef;
  }
  return $conn;
}

sub ws_read_exact_from_conn {
  my ($conn, $need, $timeout) = @_;
  $timeout //= 5;
  my $buf = \$conn->{buf};
  if (length($$buf) >= $need) {
    my $out = substr($$buf, 0, $need, '');
    return $out;
  }
  my $more = read_exact($conn->{sock}, $need - length($$buf), $timeout);
  return undef unless defined $more;
  $$buf .= $more;
  return substr($$buf, 0, $need, '');
}

sub ws_send_frame {
  my ($conn, $opcode, $payload_bytes) = @_;
  $payload_bytes = '' unless defined $payload_bytes;
  $payload_bytes = encode_utf8($payload_bytes) if utf8::is_utf8($payload_bytes);

  my $len = length($payload_bytes);
  my $header = pack('C', 0x80 | ($opcode & 0x0F));
  if ($len < 126) {
    $header .= pack('C', 0x80 | $len);
  } elsif ($len <= 65535) {
    $header .= pack('Cn', 0x80 | 126, $len);
  } else {
    my $hi = int($len / 4294967296);
    my $lo = $len - ($hi * 4294967296);
    $header .= pack('CNN', 0x80 | 127, $hi, $lo);
  }

  my $mask = pack('C4', int(rand(256)), int(rand(256)), int(rand(256)), int(rand(256)));
  my $masked = '';
  if ($len > 0) {
    my $reps = int(($len + 3) / 4);
    my $mask_stream = substr($mask x $reps, 0, $len);
    $masked = $payload_bytes ^ $mask_stream;
  }

  return write_all($conn->{sock}, $header . $mask . $masked, 10);
}

sub ws_read_message {
  my ($conn, $timeout) = @_;
  $timeout //= 5;
  my $accum = '';
  my $deadline = time() + $timeout;

  while (1) {
    my $left = $deadline - time();
    return undef if $left <= 0;

    my $h2 = ws_read_exact_from_conn($conn, 2, $left);
    return undef unless defined $h2;
    my ($b1, $b2) = unpack('CC', $h2);
    my $fin    = ($b1 & 0x80) ? 1 : 0;
    my $opcode = $b1 & 0x0F;
    my $masked = ($b2 & 0x80) ? 1 : 0;
    my $plen   = $b2 & 0x7F;

    if ($plen == 126) {
      my $ext = ws_read_exact_from_conn($conn, 2, $left);
      return undef unless defined $ext;
      $plen = unpack('n', $ext);
    } elsif ($plen == 127) {
      my $ext = ws_read_exact_from_conn($conn, 8, $left);
      return undef unless defined $ext;
      my ($hi, $lo) = unpack('NN', $ext);
      $plen = $hi * 4294967296 + $lo;
    }

    my $mask_key = '';
    if ($masked) {
      $mask_key = ws_read_exact_from_conn($conn, 4, $left);
      return undef unless defined $mask_key;
    }

    my $data = '';
    if ($plen > 0) {
      $data = ws_read_exact_from_conn($conn, $plen, $left);
      return undef unless defined $data;
      if ($masked) {
        my $reps = int(($plen + 3) / 4);
        my $mask_stream = substr($mask_key x $reps, 0, $plen);
        $data = $data ^ $mask_stream;
      }
    }

    if ($opcode == 0x9) {
      # PING -> 自动回复 PONG
      ws_send_frame($conn, 0xA, $data);
      next;
    }
    if ($opcode == 0xA) {
      # PONG -> 忽略
      next;
    }
    if ($opcode == 0x8) {
      # CLOSE
      return undef;
    }

    $accum .= $data;
    return $accum if $fin;
  }
}

sub cdp_call {
  my ($conn, $id, $method, $params) = @_;
  my $req_obj = { id => $id, method => $method };
  $req_obj->{params} = $params if defined $params;
  my $json_bytes = JSON::PP->new->utf8(1)->encode($req_obj);
  return undef unless ws_send_frame($conn, 0x1, $json_bytes);

  my $deadline = time() + 6;
  while (1) {
    my $left = $deadline - time();
    return undef if $left <= 0;
    my $msg = ws_read_message($conn, $left);
    return undef unless defined $msg;
    my $obj = eval { decode_json($msg) };
    next unless ref($obj) eq 'HASH';
    if (defined($obj->{id}) && $obj->{id} == $id) {
      return $obj;
    }
  }
}

sub inject_target_on_conn {
  my ($conn, $payload_str) = @_;
  my $ok = 1;
  my $err_msg = '';

  my $r1 = cdp_call($conn, 1, 'Page.enable');
  if (!$r1) {
    $ok = 0;
    $err_msg = 'Page.enable 超时';
  }

  if ($ok) {
    my $r2 = cdp_call($conn, 2, 'Page.addScriptToEvaluateOnNewDocument', {
      source => $payload_str,
    });
    if (!$r2 || $r2->{error}) {
      $ok = 0;
      $err_msg = $r2 && $r2->{error} ? ($r2->{error}{message} // 'addScriptToEvaluateOnNewDocument error') : 'addScriptToEvaluateOnNewDocument 超时';
    }
  }

  if ($ok) {
    my $r3 = cdp_call($conn, 3, 'Runtime.evaluate', {
      expression    => $payload_str,
      awaitPromise  => JSON::PP::false,
      returnByValue => JSON::PP::false,
    });
    if (!$r3 || $r3->{error}) {
      $ok = 0;
      $err_msg = $r3 && $r3->{error} ? ($r3->{error}{message} // 'Runtime.evaluate error') : 'Runtime.evaluate 超时';
    } elsif ($r3->{result} && $r3->{result}{exceptionDetails}) {
      $ok = 0;
      $err_msg = $r3->{result}{exceptionDetails}{text} // 'Runtime JS 异常';
    }
  }

  ws_send_frame($conn, 0x8, '');
  close $conn->{sock};
  return ($ok, $err_msg);
}

sub inject_target {
  my ($target, $payload_str) = @_;
  my $ws_url = $target->{webSocketDebuggerUrl};
  my $conn = ws_connect($ws_url);
  return (0, 'WebSocket 握手失败') unless $conn;
  return inject_target_on_conn($conn, $payload_str);
}

sub run_main {
  GetOptions(
    'port=i'         => \$port,
    'picker=s'       => \$picker_path,
    'config=s'       => \$config_path,
    'watch-pid=i'    => \$watch_pid,
    'pid-file=s'     => \$pid_file,
    'interval=i'     => \$interval,
    'startup-wait=i' => \$startup_wait,
    'once'           => \$once,
    'quiet'          => \$quiet,
    'help|h'         => \$help,
  ) or die "参数解析失败，请使用 --help 查看用法。\n";

  if ($help || !$port || !$picker_path) {
    print <<'EOF';
用法: agy-pt-cdp.pl --port <PORT> --picker <periodic-model-picker.js> [选项]

选项:
  --port <N>          本机 127.0.0.1 CDP 调试端口（必需）
  --picker <file>     periodic-model-picker.js 路径（必需）
  --config <file>     periodic-model-config.json 路径（可选）
  --watch-pid <PID>   关联的 Antigravity 主进程 PID，退出后自动结束守护进程
  --pid-file <file>   写入守护进程 PID 文件（自动清理陈旧实例）
  --interval <sec>    轮询间隔秒数（默认: 2）
  --startup-wait <s>  等待 CDP 端口首次就绪的最大秒数（默认: 30）
  --once              立即扫描并注入一次后退出
  --quiet             静默模式（仅输出错误）
  -h, --help          显示本帮助
EOF
    exit($help ? 0 : 1);
  }

  $interval     = 1 if $interval < 1;
  $startup_wait = 1 if $startup_wait < 1;

  die "错误: 端口范围无效: $port\n" if $port < 1 || $port > 65535;
  die "错误: 未找到 picker 脚本: $picker_path\n" unless -f $picker_path;

  $SIG{INT}  = sub { $running = 0; };
  $SIG{TERM} = sub { $running = 0; };
  $SIG{PIPE} = 'IGNORE';
  $SIG{HUP}  = 'IGNORE';

  if ($pid_file && !$once) {
    if (-f $pid_file && open my $rfh, '<', $pid_file) {
      my $old_pid = <$rfh>;
      close $rfh;
      if (defined $old_pid && $old_pid =~ /^\s*(\d+)\s*$/ && $1 != $$ && kill(0, $1)) {
        log_msg("端口 $port 已有运行中的守护进程 (PID=$1)，先通知其退出以热替换为最新配置。");
        kill('TERM', $1);
        for (1 .. 15) {
          last unless kill(0, $1);
          select(undef, undef, undef, 0.1);
        }
      }
    }
    if (open my $wfh, '>', $pid_file) {
      print {$wfh} "$$\n";
      close $wfh;
    }
  }

  log_msg("启动 CDP 注入守护进程 (127.0.0.1:$port, picker=$picker_path" . ($watch_pid ? ", watch_pid=$watch_pid" : '') . ")");

  my %injected; # target_id => "$url|$payload_hash"
  my $seen_ready   = 0;
  my $start_time   = time();
  my $miss_streak  = 0;
  my $total_ok     = 0;

  while ($running) {
    my ($payload_str, $payload_hash) = load_payload_if_changed();
    my $targets = http_get_json_list($port);

    if (defined $targets) {
      $seen_ready  = 1;
      $miss_streak = 0;

      my %alive_ids;
      for my $t (@$targets) {
        next unless is_allowed_target($t);
        my $tid = $t->{id} // $t->{webSocketDebuggerUrl};
        my $url = $t->{url} // '';
        $alive_ids{$tid} = 1;

        my $sig = "$url|$payload_hash";
        next if defined($injected{$tid}) && $injected{$tid} eq $sig;

        my ($ok, $err) = inject_target($t, $payload_str);
        if ($ok) {
          $injected{$tid} = $sig;
          $total_ok++;
          my $title = $t->{title} // $url // $tid;
          $title = substr($title, 0, 60) if length($title) > 60;
          log_msg("已注入元素周期表 -> [$tid] $title");
        } else {
          log_err("注入失败 [$tid]: $err");
        }
      }

      for my $old_id (keys %injected) {
        delete $injected{$old_id} unless $alive_ids{$old_id};
      }

      if ($once) {
        log_msg("单次注入完成（成功 $total_ok 个页面）。");
        exit 0;
      }
    } else {
      $miss_streak++;
      if ($once) {
        if (time() - $start_time >= $startup_wait) {
          log_err("等待 127.0.0.1:$port 超时（${startup_wait}s），未检测到可连接的 CDP 端点。");
          exit 1;
        }
        select(undef, undef, undef, 0.5);
        next;
      }

      if (!$seen_ready) {
        if ($watch_pid && !kill(0, $watch_pid) && (time() - $start_time) >= 3) {
          log_msg("关联进程 PID=$watch_pid 已退出，守护进程自动结束。");
          last;
        }
        if (time() - $start_time >= $startup_wait) {
          log_err("等待 127.0.0.1:$port 超时（${startup_wait}s），守护进程退出。");
          exit 1;
        }
        select(undef, undef, undef, 0.5);
        next;
      }

      # 已稳定运行后，若连续失联且目标进程已退出，干净结束守护进程
      if ($miss_streak >= 5) {
        if (!$watch_pid || !kill(0, $watch_pid)) {
          log_msg("Antigravity 已关闭（CDP 端口 127.0.0.1:$port 不可达），守护进程自动退出。");
          last;
        }
      }
    }

    for (1 .. $interval) {
      last unless $running;
      sleep 1;
    }
  }

  log_msg("守护进程已退出。");
  exit 0;
}

END { cleanup_pid_file(); }

run_main() unless caller;
1;
