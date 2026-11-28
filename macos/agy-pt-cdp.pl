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
use Time::Local qw(timegm);

my $port              = 0;
my $picker_path       = '';
my $config_path       = '';
my $hans_overlay_path = '';
my $watch_pid         = 0;
my $pid_file          = '';
my $interval          = 2;
my $startup_wait      = 30;
my $once              = 0;
my $quiet             = 0;
my $no_telemetry      = 0;
my $dump_telemetry    = 0;
my $brain_dir         = '';
my $dart_db_path      = '';
my $help              = 0;

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
  my $sig = file_stat_sig($hans_overlay_path) . '|' . file_stat_sig($picker_path) . '|' . file_stat_sig($config_path);
  return ($cached_payload, $cached_hash) if $sig eq $cached_sig && length($cached_payload);

  my $hans_prefix = '';
  if ($hans_overlay_path && -f $hans_overlay_path) {
    my $hans_raw = read_raw_file($hans_overlay_path);
    my $max_hans_bytes = 2 * 1024 * 1024;
    if (length($hans_raw) > $max_hans_bytes) {
      log_err("警告: 全局汉化脚本体积超出上限 (" . length($hans_raw) . " 字节)，已跳过: $hans_overlay_path");
    } elsif (index($hans_raw, '__antigravityZhPatchInstalled') < 0) {
      log_err("警告: 全局汉化脚本缺少 __antigravityZhPatchInstalled 标记，已跳过: $hans_overlay_path");
    } else {
      my $fp = substr(sha256_hex($hans_raw), 0, 16);
      $hans_raw =~ s/^\xEF\xBB\xBF//;
      $hans_raw =~ s/\s+\z//;
      $hans_prefix = "window.__antigravityZhPatchRequestedFingerprint = \"$fp\";\n" . $hans_raw . "\n";
    }
  }

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

  my @parts;
  push @parts, $hans_prefix if length($hans_prefix);
  push @parts,
    '// AGY-PT macOS Standalone CDP Injection',
    "window.__ANTIGRAVITY_PERIODIC_CONFIG__ = $config_json;",
    $picker_raw,
    '';

  my $combined_bytes = join("\n", @parts);

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

  return write_all($conn->{sock}, $header . $mask . $masked, 15);
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

  my $deadline = time() + 12;
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

sub eval_target {
  my ($target, $expr) = @_;
  my $ws_url = $target->{webSocketDebuggerUrl};
  my $conn = ws_connect($ws_url);
  return 0 unless $conn;
  my $r = cdp_call($conn, 1, 'Runtime.evaluate', {
    expression    => $expr,
    awaitPromise  => JSON::PP::false,
    returnByValue => JSON::PP::false,
  });
  ws_send_frame($conn, 0x8, '');
  close $conn->{sock};
  return ($r && !$r->{error}) ? 1 : 0;
}

sub parse_iso_ms {
  my ($val) = @_;
  return undef unless defined $val;
  if ($val =~ /^\s*(\d+(?:\.\d+)?)\s*$/) {
    my $n = $1 + 0;
    return $n > 0 ? $n : undef;
  }
  if ($val =~ /^\s*(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))?\s*$/i) {
    my ($yr, $mo, $dy, $hr, $mn, $sc, $frac, $tz, $sign, $tzh, $tzm) = ($1, $2, $3, $4, $5, $6, $7 // '', $8 // 'Z', $9 // '', $10 // 0, $11 // 0);
    my $epoch = eval { timegm($sc, $mn, $hr, $dy, $mo - 1, $yr) };
    return undef unless defined $epoch;
    if ($sign eq '+') {
      $epoch -= ($tzh * 3600 + $tzm * 60);
    } elsif ($sign eq '-') {
      $epoch += ($tzh * 3600 + $tzm * 60);
    }
    my $ms = 0;
    if (length($frac)) {
      $ms = int(substr($frac . '000', 0, 3));
    }
    return ($epoch * 1000) + $ms;
  }
  return undef;
}

sub resolve_model_profile_info {
  my ($model_name) = @_;
  my $raw = defined($model_name) ? $model_name : '';
  $raw =~ s/^\s+|\s+$//g;
  if (length($raw)) {
    return ('claude-1m', 1000000, 300) if $raw =~ /claude.*(?:^|[-_\/\s\[(])(?:1m|1000k)\b/i;
    return ('claude-200k', 200000, 300) if $raw =~ /claude/i;
    return ('gemini-flash-1m', 1000000, 300) if $raw =~ /gemini.*flash/i;
    return ('gemini-4-1m', 1000000, 300) if $raw =~ /(?:gemini[-_\/\s]?4(?:\.\d+)?\b|(?:^|[-_\/\s.])(?:neon|carbon|argon|hydrogen)(?:$|[-_\/\s.\d]))/i;
    return ('gemini-1m', 1000000, 300) if $raw =~ /gemini[-_\/\s]?[23](?:\.\d+)?\b|gemini[-_\/\s]?1\.5\b|gemini.*1m\b/i;
    return ('gpt-4.1-1m', 1000000, 300) if $raw =~ /gpt[-_]?4\.1\b/i;
    return ('gpt-5-400k', 400000, 300) if $raw =~ /gpt[-_]?5(?:\.\d+)?\b/i;
    return ('gpt-4o-128k', 128000, 300) if $raw =~ /gpt[-_]?4o\b/i;
    return ('openai-o-200k', 200000, 300) if $raw =~ /(?:^|[-_\/\s])o[134](?:[-_\/\s.]|$)/i;
    return ('deepseek-128k', 128000, 600) if $raw =~ /deepseek/i;
    return ('qwen-256k', 256000, 300) if $raw =~ /qwen.*(?:coder|256k|3\b)/i;
    return ('qwen-128k', 128000, 300) if $raw =~ /qwen/i;
  }
  return ('default-200k', 200000, 300);
}

sub to_non_neg_num {
  my ($v) = @_;
  return 0 unless defined $v;
  return ($v + 0) if !ref($v) && $v =~ /^\s*\d+(?:\.\d+)?\s*$/ && ($v + 0) >= 0;
  return 0;
}

sub round1_num {
  my ($v) = @_;
  return 0 + sprintf('%.1f', $v);
}

sub round2_num {
  my ($v) = @_;
  return 0 + sprintf('%.2f', $v);
}

sub parse_transcript_telemetry {
  my ($jsonl_text, $now_ms) = @_;
  $now_ms //= int(time() * 1000);

  my $last_model = '';
  my $current_ctx = 0;
  my $last_turn_at_ms = undef;
  my $turns = 0;
  my $total_in = 0;
  my $total_cr = 0;
  my $total_out = 0;
  my $warm_in_sum = 0;
  my $warm_cr_sum = 0;
  my $tps_out_sum = 0;
  my $tps_dur_sum = 0;
  my $last_out = 0;
  my $last_dur = 0;
  my $last_tps = 0;
  my $prev_step_ms = undef;

  my $json_parser = JSON::PP->new->utf8(0);
  for my $raw_line (split /\r?\n/, ($jsonl_text // '')) {
    $raw_line =~ s/^\s+|\s+$//g;
    next unless length($raw_line) && substr($raw_line, 0, 1) eq '{';
    my $obj = eval { $json_parser->decode($raw_line) };
    next unless ref($obj) eq 'HASH';

    my $created_ms = parse_iso_ms($obj->{created_at} // $obj->{timestamp} // $obj->{ts});
    my $is_planner = (($obj->{type} // '') eq 'PLANNER_RESPONSE');

    my $usage = ref($obj->{usage}) eq 'HASH' ? $obj->{usage} : {};
    my $umeta = ref($obj->{usageMetadata}) eq 'HASH' ? $obj->{usageMetadata} : {};

    my $inp = to_non_neg_num($obj->{input_tokens} // $usage->{input_tokens} // $umeta->{promptTokenCount});
    my $cr  = to_non_neg_num($obj->{cache_read_tokens} // $usage->{cache_read_input_tokens} // $umeta->{cachedContentTokenCount});
    my $cc  = to_non_neg_num($usage->{cache_creation_input_tokens});
    my $out = to_non_neg_num($obj->{output_tokens} // $usage->{output_tokens} // $umeta->{candidatesTokenCount});

    my $has_usage = ($is_planner && ($inp > 0 || $cr > 0 || $cc > 0 || $out > 0)) ? 1 : 0;
    if ($has_usage) {
      $turns++;
      if (defined($obj->{model}) && !ref($obj->{model}) && $obj->{model} =~ /\S/) {
        $last_model = $obj->{model};
        $last_model =~ s/^\s+|\s+$//g;
      }
      my $ctx = $inp + $cr + $cc;
      $current_ctx = $ctx if $ctx > 0;
      $total_in  += ($inp + $cc);
      $total_cr  += $cr;
      $total_out += $out;

      if ($turns > 1 || $cr > 0) {
        $warm_in_sum += ($inp + $cc);
        $warm_cr_sum += $cr;
      }
      $last_turn_at_ms = $created_ms if defined $created_ms;

      if ($out > 0 && defined($created_ms) && defined($prev_step_ms)) {
        my $diff_sec = ($created_ms - $prev_step_ms) / 1000.0;
        if ($diff_sec >= 1.0 && $diff_sec <= 600) {
          my $dur = $diff_sec;
          $tps_out_sum += $out;
          $tps_dur_sum += $dur;
          $last_out = $out;
          $last_dur = round2_num($dur);
          $last_tps = round1_num($out / $dur);
        } elsif ($last_out == 0) {
          $last_out = $out;
        }
      } elsif ($out > 0 && $last_out == 0) {
        $last_out = $out;
      }
    } elsif (defined($obj->{model}) && !ref($obj->{model}) && $obj->{model} =~ /\S/ && !length($last_model)) {
      $last_model = $obj->{model};
      $last_model =~ s/^\s+|\s+$//g;
    }

    $prev_step_ms = $created_ms if defined $created_ms;
  }

  my ($profile_id, $window_tokens, $ttl_sec) = resolve_model_profile_info($last_model);
  my $warn_tokens = int($window_tokens * 0.65 + 0.5);
  my $crit_tokens = int($window_tokens * 0.80 + 0.5);
  my $cold_tokens = int($window_tokens * 0.30 + 0.5);
  my $delay_min   = int($window_tokens * 0.15 + 0.5);

  my $used_pct = $window_tokens > 0 ? round1_num(($current_ctx / $window_tokens) * 100.0) : 0;
  my $watermark = $current_ctx >= $crit_tokens ? 'critical' : ($current_ctx >= $warn_tokens ? 'warn' : 'ok');

  my $warm_denom = $warm_in_sum + $warm_cr_sum;
  my $weighted_hit_rate = $warm_denom > 0 ? (0 + sprintf('%.4f', $warm_cr_sum / $warm_denom)) : 0;
  my $avg_tps = $tps_dur_sum > 0 ? round1_num($tps_out_sum / $tps_dur_sum) : $last_tps;

  my $idle_sec = defined($last_turn_at_ms) ? int(($now_ms - $last_turn_at_ms) / 1000) : undef;
  $idle_sec = 0 if defined($idle_sec) && $idle_sec < 0;

  my $cache_temp = 'cold';
  if ($current_ctx >= 4000 && defined($idle_sec)) {
    if ($idle_sec < 60) {
      $cache_temp = 'hot';
    } elsif ($idle_sec < $ttl_sec) {
      $cache_temp = 'warm';
    } else {
      $cache_temp = 'cold';
    }
  }

  my $compact_advice = 'none';
  if ($current_ctx >= $crit_tokens) {
    $compact_advice = 'critical_compact';
  } elsif ($cache_temp eq 'cold' && $current_ctx >= $cold_tokens) {
    $compact_advice = 'opportunistic_cold_compact';
  } elsif ($cache_temp ne 'cold' && $weighted_hit_rate >= 0.85 && $current_ctx >= $delay_min) {
    $compact_advice = 'delay_hot_cache';
  }

  return {
    model                => $last_model,
    profileId            => $profile_id,
    windowTokens         => 0 + $window_tokens,
    currentContextTokens => 0 + $current_ctx,
    usedPct              => $used_pct,
    warnTokens           => 0 + $warn_tokens,
    criticalTokens       => 0 + $crit_tokens,
    coldCompactTokens    => 0 + $cold_tokens,
    watermark            => $watermark,
    weightedHitRate      => $weighted_hit_rate,
    turns                => 0 + $turns,
    lastOutputTokens     => 0 + $last_out,
    lastDurationSec      => $last_dur,
    lastTps              => $last_tps,
    avgTps               => $avg_tps,
    totalInputTokens     => 0 + $total_in,
    totalCacheReadTokens => 0 + $total_cr,
    totalOutputTokens    => 0 + $total_out,
    lastTurnAtMs         => defined($last_turn_at_ms) ? (0 + $last_turn_at_ms) : JSON::PP::null,
    ttlSec               => 0 + $ttl_sec,
    idleSec              => defined($idle_sec) ? (0 + $idle_sec) : JSON::PP::null,
    cacheTemperature     => $cache_temp,
    compactAdvice        => $compact_advice,
    updatedAtMs          => 0 + $now_ms,
  };
}

my $tel_dart_last_check = 0;
my $tel_dart_cached = {
  available   => JSON::PP::false,
  totalEvents => 0,
  savedBytes  => 0,
  cliFiltered => 0,
  dedupHits   => 0,
};

sub read_dart_stats_cached {
  my ($db_path, $force_now) = @_;
  my $now = time();
  return $tel_dart_cached if !$force_now && ($now - $tel_dart_last_check) < 10;
  $tel_dart_last_check = $now;

  my $default_res = {
    available   => JSON::PP::false,
    totalEvents => 0,
    savedBytes  => 0,
    cliFiltered => 0,
    dedupHits   => 0,
  };
  return ($tel_dart_cached = $default_res) unless defined($db_path) && -f $db_path && -x '/usr/bin/sqlite3';

  my $sql = "SELECT COUNT(*), COALESCE(SUM(MAX(0, MAX(sandbox_bytes, bytes, returned_bytes) - returned_bytes)), 0), "
          . "COALESCE(SUM(CASE WHEN kind LIKE '%cli_filter%' THEN 1 ELSE 0 END), 0), "
          . "COALESCE(SUM(CASE WHEN kind LIKE '%dedup%' OR kind LIKE '%deny%' OR kind LIKE '%guard%' THEN 1 ELSE 0 END), 0) FROM events;";
  my $pid = open(my $fh, '-|');
  if (!defined $pid) {
    return $tel_dart_cached;
  }
  if ($pid == 0) {
    open STDERR, '>', '/dev/null';
    exec('/usr/bin/sqlite3', '-readonly', '-cmd', '.timeout 400', '-separator', '|', $db_path, $sql) or POSIX::_exit(127);
  }
  my $line = <$fh>;
  close $fh;
  if ($? == 0 && defined($line) && $line =~ /^\s*(\d+)\|(\d+)\|(\d+)\|(\d+)\s*$/) {
    $tel_dart_cached = {
      available   => JSON::PP::true,
      totalEvents => 0 + $1,
      savedBytes  => 0 + $2,
      cliFiltered => 0 + $3,
      dedupHits   => 0 + $4,
    };
  }
  return $tel_dart_cached;
}

my $tel_last_file = '';
my $tel_last_sig  = '';
my $tel_last_snap = undef;

sub collect_telemetry_snapshot {
  my ($b_dir, $db_path, $force_dart) = @_;
  my $home = $ENV{HOME} // '';
  $b_dir = "$home/.gemini/antigravity/brain" unless defined($b_dir) && length($b_dir);
  $db_path = "$home/.agy-dart/context.db" unless defined($db_path) && length($db_path);

  my $best_conv = '';
  my $best_file = '';
  my $best_mtime = -1;
  my $best_size = 0;

  if (-d $b_dir && opendir(my $dh, $b_dir)) {
    while (my $ent = readdir($dh)) {
      next if $ent =~ /^\./;
      my $cand = "$b_dir/$ent/.system_generated/logs/transcript.jsonl";
      next unless -f $cand;
      my @st = stat($cand);
      next unless @st && $st[7] > 0;
      if ($st[9] > $best_mtime) {
        $best_mtime = $st[9];
        $best_size  = $st[7];
        $best_file  = $cand;
        $best_conv  = $ent;
      }
    }
    closedir($dh);
  }

  my $now_ms = int(time() * 1000);
  my $dart_stats = read_dart_stats_cached($db_path, $force_dart);

  if (!length($best_file)) {
    my $empty = parse_transcript_telemetry('', $now_ms);
    $empty->{conversationId} = '';
    $empty->{dartStats} = $dart_stats;
    return $empty;
  }

  my $file_sig = "$best_size:$best_mtime";
  my $parsed;
  if ($best_file eq $tel_last_file && $file_sig eq $tel_last_sig && defined($tel_last_snap)) {
    $parsed = { %$tel_last_snap };
    $parsed->{updatedAtMs} = 0 + $now_ms;
    if (defined($parsed->{lastTurnAtMs}) && !ref($parsed->{lastTurnAtMs})) {
      my $idle = int(($now_ms - $parsed->{lastTurnAtMs}) / 1000);
      $idle = 0 if $idle < 0;
      $parsed->{idleSec} = 0 + $idle;
      my $ttl = $parsed->{ttlSec} || 300;
      if ($parsed->{currentContextTokens} >= 4000) {
        $parsed->{cacheTemperature} = $idle < 60 ? 'hot' : ($idle < $ttl ? 'warm' : 'cold');
      }
    }
  } else {
    my $tail_text = '';
    if (open(my $tfh, '<:raw', $best_file)) {
      my $max_tail = 256 * 1024;
      my $start = $best_size > $max_tail ? ($best_size - $max_tail) : 0;
      seek($tfh, $start, 0) if $start > 0;
      local $/;
      my $raw_bytes = <$tfh>;
      close $tfh;
      if (defined $raw_bytes) {
        if ($start > 0) {
          my $nl = index($raw_bytes, "\n");
          $raw_bytes = substr($raw_bytes, $nl + 1) if $nl >= 0;
        }
        $tail_text = decode_utf8($raw_bytes);
      }
    }
    $parsed = parse_transcript_telemetry($tail_text, $now_ms);
    $tel_last_file = $best_file;
    $tel_last_sig  = $file_sig;
    $tel_last_snap = { %$parsed };
  }

  $parsed->{conversationId} = $best_conv;
  $parsed->{dartStats} = $dart_stats;
  return $parsed;
}

sub build_telemetry_push_expr {
  my ($snap) = @_;
  my $json_str = JSON::PP->new->utf8(0)->encode($snap);
  return "window.__AGY_PT_TELEMETRY__ = $json_str;"
       . "window.dispatchEvent(new CustomEvent('agy-pt-telemetry', { detail: window.__AGY_PT_TELEMETRY__ }));";
}

sub telemetry_change_key {
  my ($snap) = @_;
  return join('|',
    $snap->{conversationId} // '',
    $snap->{model} // '',
    $snap->{currentContextTokens} // 0,
    $snap->{turns} // 0,
    $snap->{lastTps} // 0,
    $snap->{cacheTemperature} // '',
    $snap->{compactAdvice} // '',
    $snap->{dartStats}{totalEvents} // 0,
    $snap->{dartStats}{savedBytes} // 0
  );
}

sub run_main {
  GetOptions(
    'port=i'         => \$port,
    'picker=s'       => \$picker_path,
    'config=s'       => \$config_path,
    'hans-overlay=s' => \$hans_overlay_path,
    'watch-pid=i'    => \$watch_pid,
    'pid-file=s'     => \$pid_file,
    'interval=i'     => \$interval,
    'startup-wait=i' => \$startup_wait,
    'once'           => \$once,
    'quiet'          => \$quiet,
    'no-telemetry'   => \$no_telemetry,
    'dump-telemetry' => \$dump_telemetry,
    'brain-dir=s'    => \$brain_dir,
    'dart-db=s'      => \$dart_db_path,
    'help|h'         => \$help,
  ) or die "参数解析失败，请使用 --help 查看用法。\n";

  if ($dump_telemetry) {
    my $snap = collect_telemetry_snapshot($brain_dir, $dart_db_path, 1);
    print encode_utf8(JSON::PP->new->utf8(0)->encode($snap)) . "\n";
    exit 0;
  }

  if ($help || !$port || !$picker_path) {
    print <<'EOF';
用法: agy-pt-cdp.pl --port <PORT> --picker <periodic-model-picker.js> [选项]

选项:
  --port <N>             本机 127.0.0.1 CDP 调试端口（必需）
  --picker <file>        periodic-model-picker.js 路径（必需）
  --config <file>        periodic-model-config.json 路径（可选）
  --hans-overlay <file>  全局汉化基座脚本路径（如 hans-base-overlay.js，可选）
  --watch-pid <PID>      关联的 Antigravity 主进程 PID，退出后自动结束守护进程
  --pid-file <file>      写入守护进程 PID 文件（自动清理陈旧实例）
  --interval <sec>       轮询间隔秒数（默认: 2）
  --startup-wait <s>     等待 CDP 端口首次就绪的最大秒数（默认: 30）
  --once                 立即扫描并注入一次后退出
  --quiet                静默模式（仅输出错误）
  --no-telemetry         禁用上下文/速度遥测推送
  --dump-telemetry       打印一次当前遥测 JSON 后退出
  --brain-dir <dir>      自定义 Antigravity brain 目录（可选）
  --dart-db <file>       自定义 agy-dart context.db 路径（可选）
  -h, --help             显示本帮助
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

  my $hans_info = ($hans_overlay_path && -f $hans_overlay_path) ? ", hans_overlay=$hans_overlay_path" : ", hans_overlay=off";
  log_msg("启动 CDP 注入守护进程 (127.0.0.1:$port, picker=$picker_path$hans_info" . ($watch_pid ? ", watch_pid=$watch_pid" : '') . ")");

  my %injected; # target_id => "$url|$payload_hash"
  my $seen_ready   = 0;
  my $start_time   = time();
  my $miss_streak  = 0;
  my $total_ok     = 0;
  my $last_tel_key = '';

  while ($running) {
    my ($payload_str, $payload_hash) = load_payload_if_changed();
    my $targets = http_get_json_list($port);

    if (defined $targets) {
      $seen_ready  = 1;
      $miss_streak = 0;

      my $tel_snap = $no_telemetry ? undef : collect_telemetry_snapshot($brain_dir, $dart_db_path, 0);
      my $tel_key  = defined($tel_snap) ? telemetry_change_key($tel_snap) : '';
      my $tel_changed = ($tel_key ne $last_tel_key) ? 1 : 0;
      my $tel_expr = defined($tel_snap) ? build_telemetry_push_expr($tel_snap) : '';

      my %alive_ids;
      for my $t (@$targets) {
        next unless is_allowed_target($t);
        my $tid = $t->{id} // $t->{webSocketDebuggerUrl};
        my $url = $t->{url} // '';
        $alive_ids{$tid} = 1;

        my $sig = "$url|$payload_hash";
        if (!defined($injected{$tid}) || $injected{$tid} ne $sig) {
          my ($ok, $err) = inject_target($t, $payload_str);
          if ($ok) {
            $injected{$tid} = $sig;
            $total_ok++;
            my $title = $t->{title} // $url // $tid;
            $title = substr($title, 0, 60) if length($title) > 60;
            my $what = ($hans_overlay_path && -f $hans_overlay_path) ? '全局汉化 + 元素周期表' : '元素周期表';
            log_msg("已注入${what} -> [$tid] $title");
            eval_target($t, $tel_expr) if length($tel_expr);
          } else {
            log_err("注入失败 [$tid]: $err");
          }
        } elsif ($tel_changed && length($tel_expr)) {
          eval_target($t, $tel_expr);
        }
      }
      $last_tel_key = $tel_key if defined($tel_snap);

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
