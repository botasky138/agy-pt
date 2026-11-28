# Install-AgyPT.ps1 — 将 AGY-PT（Antigravity 元素周期表 + 输入框 HUD + 内置 AGY-Dart）安装或更新到 %LOCALAPPDATA%\Antigravity-Hans
# 不修改 Antigravity 原版安装目录，支持 -Uninstall 一键还原。
param(
  [string]$TargetDir = (Join-Path $env:LOCALAPPDATA "Antigravity-Hans"),
  [string]$DartMode = "",
  [switch]$SkipDart,
  [switch]$InstallRg,
  [switch]$UninstallDart,
  [switch]$Force,
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Uninstall) {
  foreach ($f in @("periodic-model-picker.js", "periodic-model-config.json", "telemetry-bridge.mjs", "Sync-HansOverlay.ps1", "antigravity-hans-overlay.js", ".overlay-sync.state.json")) {
    $p = Join-Path $TargetDir $f
    if (Test-Path -LiteralPath $p) {
      Remove-Item -LiteralPath $p -Force
      Write-Output "已移除: $p"
    }
  }
  if ($UninstallDart) {
    $dartInst = Join-Path $RepoDir "vendor\agy-dart\scripts\install.mjs"
    if ((Test-Path -LiteralPath $dartInst) -and (Get-Command node -ErrorAction SilentlyContinue)) {
      & node $dartInst uninstall
    }
  }
  Write-Output "卸载完成。如之前手动修改过启动脚本，可恢复备份或直接启动 Antigravity-Hans。"
  exit 0
}

if (-not (Test-Path -LiteralPath $TargetDir)) {
  throw "未找到 Antigravity-Hans 目录：$TargetDir。请先安装 Antigravity-Hans 或通过 -TargetDir 指定目录。"
}

# 复制核心脚本（若目标已有自定义配置且未加 -Force，保留原配置不覆盖）
Copy-Item -LiteralPath (Join-Path $RepoDir "periodic-model-picker.js") -Destination (Join-Path $TargetDir "periodic-model-picker.js") -Force
Copy-Item -LiteralPath (Join-Path $RepoDir "Sync-HansOverlay.ps1") -Destination (Join-Path $TargetDir "Sync-HansOverlay.ps1") -Force
$telemetrySrc = Join-Path $RepoDir "telemetry-bridge.mjs"
if (Test-Path -LiteralPath $telemetrySrc) {
  Copy-Item -LiteralPath $telemetrySrc -Destination (Join-Path $TargetDir "telemetry-bridge.mjs") -Force
}

$dstCfg = Join-Path $TargetDir "periodic-model-config.json"
if ($Force -or -not (Test-Path -LiteralPath $dstCfg)) {
  Copy-Item -LiteralPath (Join-Path $RepoDir "periodic-model-config.json") -Destination $dstCfg -Force
  Write-Output "已写入配置: $dstCfg"
} else {
  Write-Output "保留已有配置（如需覆盖请追加 -Force）: $dstCfg"
}

# 若目录中存在 antigravity-hans-windows-amd64.exe，立即自动合成 antigravity-hans-overlay.js
$hansExe = Join-Path $TargetDir "antigravity-hans-windows-amd64.exe"
if (Test-Path -LiteralPath $hansExe) {
  & (Join-Path $TargetDir "Sync-HansOverlay.ps1") -HansDir $TargetDir -Force
  Write-Output "安装并合成完成。使用 --trust-external-overlay 启动 Antigravity-Hans 即可生效。"
} else {
  Write-Warning "已复制文件，但未在 $TargetDir 找到 antigravity-hans-windows-amd64.exe，请放入后再运行 Sync-HansOverlay.ps1。"
}

# 可选自动安装内置 agy-dart 插件（需要 Node.js >= 22）
$dartInstaller = Join-Path $RepoDir "vendor\agy-dart\scripts\install.mjs"
if (-not $SkipDart -and (Test-Path -LiteralPath $dartInstaller)) {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) {
    $nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]") 2>$null)
    if ($nodeMajor -ge 22) {
      $dartArgs = @($dartInstaller, "install", "--with-devtools")
      if ($DartMode) { $dartArgs += @("--mode", $DartMode) }
      if ($InstallRg) { $dartArgs += "--install-rg" }
      & node @dartArgs
    } else {
      Write-Warning "检测到 Node.js 版本低于 22，已跳过 agy-dart 安装（AGY-PT 界面增强仍可正常使用）。"
    }
  } else {
    Write-Warning "未检测到 Node.js，已跳过 agy-dart 安装（如需启用请先安装 Node.js >= 22）。"
  }
}
