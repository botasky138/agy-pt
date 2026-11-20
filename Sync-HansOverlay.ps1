# Sync-HansOverlay.ps1 — 自动合成 Antigravity-Hans 外部脚本（原版动态汉化 + 元素周期表模型选择器）
# 存放在 %LOCALAPPDATA%\Antigravity-Hans 目录，Antigravity 原版更新不会覆盖本目录。
# 当 antigravity-hans-windows-amd64.exe、periodic-model-picker.js 或 periodic-model-config.json 任一更新时，
# 本脚本会自动重新提取最新汉化基座并重新合成 antigravity-hans-overlay.js。

param(
  [string]$HansDir = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$ExePath    = Join-Path $HansDir "antigravity-hans-windows-amd64.exe"
$PickerPath = Join-Path $HansDir "periodic-model-picker.js"
$ConfigPath = Join-Path $HansDir "periodic-model-config.json"
$OutPath    = Join-Path $HansDir "antigravity-hans-overlay.js"
$CacheBase  = Join-Path $HansDir "hans-base-overlay.cache.js"
$StatePath  = Join-Path $HansDir ".overlay-sync.state.json"

if (-not (Test-Path -LiteralPath $ExePath)) {
  throw "未找到 Antigravity-Hans 主程序：$ExePath"
}
if (-not (Test-Path -LiteralPath $PickerPath)) {
  throw "未找到元素周期表模块脚本：$PickerPath"
}

function Get-FileSha256Safe([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return "" }
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

# 1. 快速哈希校验：若所有输入文件均未变化且输出文件存在，直接跳过重建实现零延迟启动
$exeHash    = Get-FileSha256Safe $ExePath
$pickerHash = Get-FileSha256Safe $PickerPath
$configHash = Get-FileSha256Safe $ConfigPath
$syncVer    = "1.0.0"

if (-not $Force -and (Test-Path -LiteralPath $OutPath) -and (Test-Path -LiteralPath $StatePath)) {
  try {
    $prev = Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($prev.syncVer -eq $syncVer -and
        $prev.exeHash -eq $exeHash -and
        $prev.pickerHash -eq $pickerHash -and
        $prev.configHash -eq $configHash) {
      Write-Output "Overlay up-to-date (cached): $OutPath"
      exit 0
    }
  } catch {
    # 状态文件损坏时忽略并重新生成
  }
}

# 2. 在原始字节流中高速查找子序列偏移（借助 CLR 原生 Array.IndexOf 跳跃，7.8MB 仅需 ~10ms）
function Find-BytesIndex([byte[]]$Haystack, [byte[]]$Needle, [int]$StartIndex = 0) {
  $limit = $Haystack.Length - $Needle.Length
  if ($Needle.Length -eq 0 -or $StartIndex -lt 0 -or $StartIndex -gt $limit) { return -1 }
  $first = $Needle[0]
  $pos = $StartIndex
  while ($pos -le $limit) {
    $hit = [System.Array]::IndexOf($Haystack, $first, $pos)
    if ($hit -lt 0 -or $hit -gt $limit) { return -1 }
    $ok = $true
    for ($j = 1; $j -lt $Needle.Length; $j++) {
      if ($Haystack[$hit + $j] -ne $Needle[$j]) { $ok = $false; break }
    }
    if ($ok) { return $hit }
    $pos = $hit + 1
  }
  return -1
}

# 3. 从 antigravity-hans-windows-amd64.exe 提取最新的内嵌汉化脚本（纯字节级定位，避免二进制乱码导致 UTF-8 索引错位）
function Extract-HansBaseOverlay([string]$BinaryPath) {
  $bytes = [System.IO.File]::ReadAllBytes($BinaryPath)
  $utf8  = New-Object System.Text.UTF8Encoding($false)

  $markerBytes  = $utf8.GetBytes("__antigravityZhPatchInstalled")
  $cleanupBytes = $utf8.GetBytes("__antigravityZhPatchCleanup")
  $iifeArrow    = $utf8.GetBytes("(() => {")
  $iifeFunc     = $utf8.GetBytes("(function")
  $domBytes     = $utf8.GetBytes("DOMContentLoaded")
  $closeBytes   = $utf8.GetBytes("})();")

  $pos = 0
  $scriptStart = -1

  while (($pos = Find-BytesIndex $bytes $markerBytes $pos) -ge 0) {
    # 在标记之后 900 字节内必须出现清理钩子，确认命中真正的 JS 脚本而非 Go 提示字符串
    $cleanupPos = Find-BytesIndex $bytes $cleanupBytes $pos
    if ($cleanupPos -gt $pos -and ($cleanupPos - $pos) -lt 900) {
      # 在标记之前最多 400 字节内向后扫描最后的 IIFE 起点字节偏移
      $searchFrom = [Math]::Max(0, $pos - 400)
      $candidate = -1
      foreach ($sig in @($iifeArrow, $iifeFunc)) {
        $p = $searchFrom
        while (($p = Find-BytesIndex $bytes $sig $p) -ge 0 -and $p -lt $pos) {
          if ($p -gt $candidate) { $candidate = $p }
          $p += $sig.Length
        }
      }
      if ($candidate -ge 0) {
        $scriptStart = $candidate
        break
      }
    }
    $pos += $markerBytes.Length
  }

  if ($scriptStart -lt 0) {
    return $null
  }

  # 优先在脚本起点之后定位 DOMContentLoaded 块及其紧随的结尾 '})();'
  $maxEnd = [Math]::Min($bytes.Length, $scriptStart + 1048576)
  $scriptEnd = -1

  $scanDom = $scriptStart + 5000
  $lastDomPos = -1
  while ($scanDom -lt $maxEnd -and ($scanDom = Find-BytesIndex $bytes $domBytes $scanDom) -ge 0 -and $scanDom -lt $maxEnd) {
    $lastDomPos = $scanDom
    $scanDom += $domBytes.Length
  }

  if ($lastDomPos -gt $scriptStart) {
    $closePos = Find-BytesIndex $bytes $closeBytes $lastDomPos
    if ($closePos -gt $lastDomPos -and ($closePos - $lastDomPos) -lt 600) {
      $scriptEnd = $closePos + $closeBytes.Length
    }
  }

  # 兜底：若未来新版未含 DOMContentLoaded，则在首个非法二进制控制字节前取最后一个 '})();'
  if ($scriptEnd -lt 0) {
    $safeEnd = $maxEnd
    for ($k = $scriptStart; $k -lt $maxEnd; $k++) {
      $b = $bytes[$k]
      if ($b -eq 0 -or ($b -lt 32 -and $b -ne 9 -and $b -ne 10 -and $b -ne 13)) {
        $safeEnd = $k
        break
      }
    }
    $scanClose = $scriptStart + 5000
    $lastClose = -1
    while ($scanClose -lt $safeEnd -and ($scanClose = Find-BytesIndex $bytes $closeBytes $scanClose) -ge 0 -and $scanClose -lt $safeEnd) {
      $lastClose = $scanClose
      $scanClose += $closeBytes.Length
    }
    if ($lastClose -gt $scriptStart) {
      $scriptEnd = $lastClose + $closeBytes.Length
    }
  }

  if ($scriptEnd -le ($scriptStart + 5000)) {
    return $null
  }

  # 保留单个末尾换行（与原内嵌文件字节级一致）
  if ($scriptEnd -lt $bytes.Length -and $bytes[$scriptEnd] -eq 10) {
    $scriptEnd += 1
  }

  $extracted = $utf8.GetString($bytes, $scriptStart, $scriptEnd - $scriptStart)
  if (-not $extracted.Contains("__antigravityZhPatchCleanup")) {
    return $null
  }
  return $extracted
}

$baseScript = Extract-HansBaseOverlay $ExePath
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if ($baseScript) {
  [System.IO.File]::WriteAllText($CacheBase, $baseScript, $utf8NoBom)
} elseif (Test-Path -LiteralPath $CacheBase) {
  Write-Warning "从新版 Hans 提取内嵌脚本失败，已回退使用缓存汉化基座：$CacheBase"
  $baseScript = [System.IO.File]::ReadAllText($CacheBase, $utf8NoBom)
} else {
  throw "无法从 $ExePath 提取原版汉化基座，且不存在缓存基座。"
}

# 4. 读取可选外部配置（验证 JSON 格式，损坏时忽略自定义配置并使用内置默认）
$configJson = "{}"
if (Test-Path -LiteralPath $ConfigPath) {
  try {
    $rawCfg = [System.IO.File]::ReadAllText($ConfigPath, $utf8NoBom)
    $null = $rawCfg | ConvertFrom-Json
    $configJson = $rawCfg.Trim()
  } catch {
    Write-Warning "periodic-model-config.json 格式无效，将使用内置默认配置：$($_.Exception.Message)"
  }
}

$pickerScript = [System.IO.File]::ReadAllText($PickerPath, $utf8NoBom)

# 5. 合成最终的 antigravity-hans-overlay.js（原版汉化 + 配置 + 元素周期表模型选择器）
$sb = New-Object System.Text.StringBuilder
$null = $sb.AppendLine($baseScript.TrimEnd())
$null = $sb.AppendLine("")
$null = $sb.AppendLine("// ============================================================================")
$null = $sb.AppendLine("// Antigravity Periodic Model Picker (Update-Safe Overlay Extension)")
$null = $sb.AppendLine("// 自动合成文件，请勿直接手工修改；如需调整配置请编辑 periodic-model-config.json")
$null = $sb.AppendLine("// ============================================================================")
$null = $sb.AppendLine("window.__ANTIGRAVITY_PERIODIC_CONFIG__ = $configJson;")
$null = $sb.AppendLine($pickerScript.TrimEnd())

$tmpOut = "$OutPath.tmp"
[System.IO.File]::WriteAllText($tmpOut, $sb.ToString(), $utf8NoBom)
Move-Item -LiteralPath $tmpOut -Destination $OutPath -Force

# 6. 写入同步状态缓存
$stateObj = @{
  syncVer     = $syncVer
  updatedAt   = (Get-Date).ToString("o")
  exeHash     = $exeHash
  pickerHash  = $pickerHash
  configHash  = $configHash
  outputBytes = (Get-Item -LiteralPath $OutPath).Length
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($StatePath, $stateObj, $utf8NoBom)

Write-Output "Synthesized overlay OK: $OutPath ($((Get-Item -LiteralPath $OutPath).Length) bytes)"
