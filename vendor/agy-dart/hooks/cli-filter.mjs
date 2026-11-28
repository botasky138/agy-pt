#!/usr/bin/env node
/**
 * Transparent CLI output filter runner for agy-dart PreToolUse.overwrite.
 * Runs the decoded command, preserves exact exit code, compacts noisy output
 * to <= 8.8 KB total inline budget, and indexes raw output into SQLite FTS5.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { enableVersionedCompileCache } from "./compile-cache.mjs";

const MAX_CAPTURE_BYTES = 2 * 1024 * 1024; // 2 MB cap per stream to prevent OOM

function decodePayload(encoded) {
  if (!encoded) return "";
  if (encoded.startsWith("b:")) {
    return Buffer.from(encoded.slice(2), "base64url").toString("utf8");
  }
  return Buffer.from(encoded, "base64").toString("utf8");
}

function parseCliArgs(argv) {
  let ruleId = "";
  let cmdB64 = "";
  let origB64 = "";
  let sessionId = process.env.ANTIGRAVITY_CONVERSATION_ID || "default";
  let noteB64 = "";

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--rule" && i + 1 < argv.length) {
      ruleId = argv[++i];
    } else if (a === "--b64" && i + 1 < argv.length) {
      cmdB64 = argv[++i];
    } else if (a === "--orig-b64" && i + 1 < argv.length) {
      origB64 = argv[++i];
    } else if (a === "--session" && i + 1 < argv.length) {
      sessionId = decodePayload(argv[++i]) || sessionId;
    } else if (a === "--note" && i + 1 < argv.length) {
      noteB64 = argv[++i];
    }
  }

  const command = decodePayload(cmdB64);
  const originalCommand = origB64 ? decodePayload(origB64) : command;
  const note = decodePayload(noteB64);
  return { ruleId, command, originalCommand, sessionId, note };
}

function expandHomePrefix(dirPath) {
  if (dirPath === "~") return os.homedir();
  if (dirPath.startsWith("~/") || dirPath.startsWith("~\\")) {
    return path.join(os.homedir(), dirPath.slice(2));
  }
  return dirPath;
}

function decodeUtf8TrimIncomplete(chunks, trimTrailingIncomplete = false) {
  let buf = Buffer.concat(chunks);
  if (trimTrailingIncomplete && buf.length > 0) {
    let start = buf.length - 1;
    while (start > 0 && (buf[start] & 0xc0) === 0x80) {
      start -= 1;
    }
    const lead = buf[start];
    let expectedLen = 1;
    if ((lead & 0xe0) === 0xc0) expectedLen = 2;
    else if ((lead & 0xf0) === 0xe0) expectedLen = 3;
    else if ((lead & 0xf8) === 0xf0) expectedLen = 4;
    if (buf.length - start < expectedLen) {
      buf = buf.subarray(0, start);
    }
  }
  return buf.toString("utf8");
}

function runCommandCaptured(command, unwrapFn = null, helpers = {}) {
  const resolveWinExe = helpers.resolveWindowsExeOnPath;
  const parseSimple = helpers.tryParseSimpleCommand;
  return new Promise((resolve) => {
    const parts = typeof unwrapFn === "function" ? unwrapFn(command) : null;
    let execCwd = process.cwd();
    let execCmd = command;
    let mergeStderrToStdout = false;

    if (parts) {
      execCmd = parts.innerCommand;
      mergeStderrToStdout = Boolean(parts.hasStderrRedirect);
      if (parts.cdPath) {
        execCwd = path.resolve(process.cwd(), expandHomePrefix(parts.cdPath));
        try {
          if (!fs.statSync(execCwd).isDirectory()) {
            resolve({
              stdout: "",
              stderr: `cd: not a directory: ${parts.cdPath}\n`,
              exitCode: 1,
              truncatedCapture: false,
              execCwd: process.cwd(),
              innerCommand: execCmd
            });
            return;
          }
        } catch {
          resolve({
            stdout: "",
            stderr: `cd: no such file or directory: ${parts.cdPath}\n`,
            exitCode: 1,
            truncatedCapture: false,
            execCwd: process.cwd(),
            innerCommand: execCmd
          });
          return;
        }
      }
    }

    // On Windows, prefer direct shell:false spawn for resolved native .exe binaries when single-command
    // syntax contains quotes/`^` (avoids cmd.exe `^` stripping, PS 5.1 embedded `"` loss inside `'...'`,
    // PS alias hijacking of curl/diff/ls/sort, and PS OEM encoding). For .ps1/.cmd shims (npm/npx/vitest),
    // pass -ExecutionPolicy Bypass and force UTF-8 console encoding.
    const usePowerShell = process.platform === "win32" && /['^%]/.test(execCmd) && !/&&/.test(execCmd);
    let directWinExe = null;
    let directWinArgs = null;
    if (process.platform === "win32" && usePowerShell && typeof parseSimple === "function" && typeof resolveWinExe === "function") {
      const parsedSimple = parseSimple(execCmd);
      if (parsedSimple) {
        const exePath = resolveWinExe(parsedSimple.bin, execCwd, process.env);
        if (exePath) {
          directWinExe = exePath;
          directWinArgs = parsedSimple.args;
        }
      }
    }

    const psCommand =
      usePowerShell && !directWinExe
        ? `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8\n${execCmd}\nif ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }\nif (-not $?) { exit 1 }\nexit 0`
        : null;

    const child = directWinExe
      ? spawn(directWinExe, directWinArgs, {
          shell: false,
          cwd: execCwd,
          env: process.env,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        })
      : usePowerShell
        ? spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psCommand], {
            cwd: execCwd,
            env: process.env,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
          })
        : spawn(execCmd, {
            shell: true,
            detached: process.platform !== "win32",
            cwd: execCwd,
            env: process.env,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
          });

    const outChunks = [];
    const errChunks = [];
    let outLen = 0;
    let errLen = 0;
    let outTruncated = false;
    let errTruncated = false;
    let truncatedCapture = false;

    const appendOut = (chunk) => {
      if (outLen < MAX_CAPTURE_BYTES) {
        const take = Math.min(chunk.length, MAX_CAPTURE_BYTES - outLen);
        if (take < chunk.length) {
          outTruncated = true;
          truncatedCapture = true;
        }
        outChunks.push(take === chunk.length ? chunk : chunk.subarray(0, take));
        outLen += take;
      } else {
        outTruncated = true;
        truncatedCapture = true;
      }
    };

    child.stdout.on("data", appendOut);

    child.stderr.on("data", (chunk) => {
      if (mergeStderrToStdout) {
        appendOut(chunk);
      }
      if (errLen < MAX_CAPTURE_BYTES) {
        const take = Math.min(chunk.length, MAX_CAPTURE_BYTES - errLen);
        if (take < chunk.length) {
          errTruncated = true;
          if (!mergeStderrToStdout) truncatedCapture = true;
        }
        errChunks.push(take === chunk.length ? chunk : chunk.subarray(0, take));
        errLen += take;
      } else {
        errTruncated = true;
        if (!mergeStderrToStdout) truncatedCapture = true;
      }
    });

    let childClosed = false;
    let terminatingSignal = null;
    const killChildProcessTree = (sig) => {
      const pid = child.pid;
      const fallback = () => {
        try {
          child.kill(sig);
        } catch {}
      };
      if (!pid) {
        fallback();
        return;
      }
      if (process.platform === "win32") {
        try {
          const sysRoot = process.env.SystemRoot || process.env.WINDIR;
          const taskkillBin = sysRoot ? path.join(sysRoot, "System32", "taskkill.exe") : "taskkill";
          const killer = spawn(taskkillBin, ["/F", "/T", "/PID", String(pid)], {
            stdio: "ignore",
            windowsHide: true
          });
          killer.on("error", fallback);
          killer.on("close", (kCode) => {
            if (kCode !== 0 && !childClosed) fallback();
          });
          killer.unref();
        } catch {
          fallback();
        }
      } else {
        try {
          process.kill(-pid, sig);
        } catch {
          fallback();
        }
      }
    };
    const onSignal = (sig) => {
      if (terminatingSignal) return;
      terminatingSignal = sig;
      const sigExitCode = sig === "SIGINT" ? 130 : sig === "SIGTERM" ? 143 : 1;
      killChildProcessTree(sig);
      const forceExitTimer = setTimeout(() => {
        if (process.platform !== "win32" && child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {}
        }
        try {
          child.stdout?.destroy();
          child.stderr?.destroy();
        } catch {}
        process.exit(sigExitCode);
      }, 400);
      forceExitTimer.unref?.();
      child.once("close", () => {
        clearTimeout(forceExitTimer);
        process.exit(sigExitCode);
      });
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);

    child.on("error", (err) => {
      childClosed = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve({
        stdout: "",
        stderr: `Failed to execute command: ${err.message}`,
        exitCode: 1,
        truncatedCapture: false,
        execCwd,
        innerCommand: execCmd
      });
    });

    child.on("close", (code, signal) => {
      childClosed = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      const stderrText = decodeUtf8TrimIncomplete(errChunks, errTruncated);
      resolve({
        stdout: decodeUtf8TrimIncomplete(outChunks, outTruncated),
        stderr: mergeStderrToStdout ? "" : stderrText,
        capturedStderr: mergeStderrToStdout ? stderrText : "",
        exitCode: code !== null && code !== undefined ? code : signal ? 1 : 0,
        truncatedCapture,
        execCwd,
        innerCommand: execCmd
      });
    });
  });
}

function extractCompactVerdict(filteredText, exitCode) {
  const lines = String(filteredText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("[agy-dart cli-filter:"));
  if (lines.length === 0) return exitCode === 0 ? "passed (exit 0)" : `failed (exit ${exitCode})`;
  const priorityRe =
    exitCode !== 0
      ? /(?:FAIL|ERROR|ERR!|AssertionError|✖|not ok|\b[1-9]\d*\s+failed\b|exit\s+[1-9])/i
      : /(?:pass|passed|tests\s+\d+|ok\b|built|compiled|0\s+errors|succeeded|done)/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (priorityRe.test(lines[i])) return lines[i].slice(0, 200);
  }
  return lines[lines.length - 1].slice(0, 200);
}

async function main() {
  enableVersionedCompileCache();

  const { ruleId, command, originalCommand, sessionId, note } = parseCliArgs(process.argv);
  if (!command) {
    process.stderr.write("agy-dart cli-filter: missing --b64 command\n");
    process.exit(2);
  }

  const {
    applyFilterRule,
    MAX_FILTERED_OUTPUT_BYTES,
    unwrapSafeCompoundCommand,
    resolveWindowsExeOnPath,
    tryParseSimpleCommand
  } = await import("./filter-rules.mjs");
  const [res, { ContextModeStore }, { redactSecrets }] = await Promise.all([
    runCommandCaptured(command, unwrapSafeCompoundCommand, { resolveWindowsExeOnPath, tryParseSimpleCommand }),
    import("../context/lib/store.js"),
    import("../context/lib/security.js")
  ]);

  const redOut = redactSecrets(res.stdout || "");
  const redErr = redactSecrets(res.stderr || "");
  const safeOriginalCommand = redactSecrets(originalCommand || "").text;
  const safeStdout = redOut.text;
  const safeStderr = redErr.text;
  const safeCapturedStderr = res.capturedStderr ? redactSecrets(res.capturedStderr).text : "";

  const rawCombined =
    safeStdout +
    (safeStderr ? (safeStdout && !safeStdout.endsWith("\n") ? "\n" : "") + safeStderr : "");
  const rawBytes = Buffer.byteLength(rawCombined, "utf8");

  let sourceId = null;
  let store = null;
  const effectiveCwd = res.execCwd || process.cwd();

  // Index full raw output (redacted) into SQLite FTS5 when non-trivial so filtered details stay searchable
  if (rawBytes >= 2048 || (res.exitCode !== 0 && rawBytes >= 1024)) {
    try {
      store = new ContextModeStore({ hookMode: true });
      const indexed = store.indexContent({
        sessionId,
        worktree: effectiveCwd,
        agent: "antigravity",
        kind: "tool_output",
        label: `cli:${ruleId || "cmd"} ${safeOriginalCommand.slice(0, 60)}`,
        content: rawCombined,
        dedup: true
      });
      sourceId = indexed.sourceId;
    } catch {
      // Fail-open: never break command output on DB error
    }
  }

  const totalRedacted = redOut.redactedCount + redErr.redactedCount;
  const effectiveNote = [
    note,
    res.truncatedCapture ? "raw stream capped at 2MB" : "",
    totalRedacted > 0 ? `redacted ${totalRedacted} secret(s)` : ""
  ]
    .filter(Boolean)
    .join("; ");

  const filtered = applyFilterRule(ruleId, safeStdout, safeStderr, res.exitCode, {
    cwd: effectiveCwd,
    fallbackCwd: process.cwd(),
    command: res.innerCommand || command,
    capturedStderr: safeCapturedStderr,
    maxBytes: MAX_FILTERED_OUTPUT_BYTES,
    note: effectiveNote || null,
    sourceId
  });

  // Record telemetry & session verification checkpoint for Sidecar dashboard, ctx_stats & ctx_resume
  try {
    if (!store) store = new ContextModeStore({ hookMode: true });
    if (filtered.wasFiltered || rawBytes > 0) {
      store.recordEvent({
        sessionId,
        worktree: effectiveCwd,
        agent: "antigravity",
        kind: "cli_filter",
        tool: "run_command",
        key: ruleId || "generic",
        path: safeOriginalCommand.slice(0, 120),
        ok: res.exitCode === 0 ? 1 : 0,
        exitCode: res.exitCode,
        bytes: filtered.rawBytes,
        body: filtered.filteredText.slice(0, 500),
        sandboxBytes: filtered.rawBytes,
        returnedBytes: filtered.filteredBytes
      });
    }
    if (ruleId === "test-runner" || ruleId === "playwright" || ruleId === "build-lint" || ruleId === "docker-build") {
      store.recordVerificationResult(sessionId, {
        kind: ruleId === "test-runner" || ruleId === "playwright" ? "test" : "build",
        command: safeOriginalCommand,
        ruleId,
        exitCode: res.exitCode,
        passed: res.exitCode === 0,
        summary: extractCompactVerdict(filtered.filteredText, res.exitCode),
        sourceId,
        worktree: effectiveCwd
      });
    }
  } catch {
    // Fail-open
  } finally {
    if (store) {
      try {
        store.close();
      } catch {}
    }
  }

  if (filtered.filteredText) {
    process.stdout.write(
      filtered.filteredText.endsWith("\n") ? filtered.filteredText : `${filtered.filteredText}\n`
    );
  }
  process.exit(res.exitCode);
}

main().catch((err) => {
  process.stderr.write(`agy-dart cli-filter error: ${err?.message || err}\n`);
  process.exit(1);
});
