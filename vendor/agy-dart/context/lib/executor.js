import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const OUTPUT_CAP = 16384; // 16 KB default preview cap
export const DEFAULT_TIMEOUT_MS = 120000; // 120s default sandbox timeout
export const MIN_TIMEOUT_MS = 1000;
export const MAX_TIMEOUT_MS = 300000; // 300s max sandbox timeout

/** Clamp execution timeout safely into [1s, 300s] */
export function resolveExecTimeoutMs(timeoutMs, fallbackMs = DEFAULT_TIMEOUT_MS) {
  const fb =
    Number.isFinite(Number(fallbackMs)) && Number(fallbackMs) > 0 ? Math.floor(Number(fallbackMs)) : DEFAULT_TIMEOUT_MS;
  const clampedFb = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, fb));
  if (timeoutMs === undefined || timeoutMs === null || timeoutMs === "" || typeof timeoutMs === "boolean") {
    return clampedFb;
  }
  const n = Number(timeoutMs);
  if (!Number.isFinite(n) || n <= 0) return clampedFb;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(n)));
}

function trimIncompleteUtf8Tail(buf) {
  if (!buf || buf.length === 0) return buf;
  let start = buf.length - 1;
  while (start > 0 && buf.length - start < 4 && (buf[start] & 0xc0) === 0x80) {
    start -= 1;
  }
  const lead = buf[start];
  if ((lead & 0x80) === 0) return buf;
  let expectedLen = 0;
  if ((lead & 0xe0) === 0xc0) expectedLen = 2;
  else if ((lead & 0xf0) === 0xe0) expectedLen = 3;
  else if ((lead & 0xf8) === 0xf0) expectedLen = 4;
  else return buf.subarray(0, start);
  if (buf.length - start < expectedLen) {
    return buf.subarray(0, start);
  }
  return buf;
}

const ESM_REGEX_PREFIX_KW = new Set([
  "return",
  "case",
  "throw",
  "in",
  "of",
  "typeof",
  "void",
  "delete",
  "new",
  "yield",
  "await",
  "else",
  "do"
]);

/** Detect top-level ESM syntax (static import/export or import.meta) linearly without regex/template false positives */
export function isLikelyEsmCode(src) {
  if (!src || typeof src !== "string") return false;
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  const len = src.length;
  if (src.startsWith("#!", i)) {
    const nl = src.indexOf("\n", i);
    if (nl === -1) return false;
    i = nl + 1;
  }
  let braceDepth = 0;
  let parenDepth = 0;
  const templateReturnDepths = [];
  let lastSigChar = "";
  let lastIdent = "";

  const consumeTemplateBody = () => {
    while (i < len) {
      const c = src[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        i += 1;
        lastSigChar = "`";
        lastIdent = "";
        return;
      }
      if (c === "$" && src[i + 1] === "{") {
        templateReturnDepths.push(braceDepth);
        braceDepth += 1;
        lastSigChar = "{";
        lastIdent = "";
        i += 2;
        return;
      }
      i += 1;
    }
    lastSigChar = "`";
    lastIdent = "";
  };

  while (i < len) {
    const ch = src[i];
    if (ch <= " ") {
      i += 1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i + 2);
      if (nl === -1) break;
      i = nl + 1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const q = ch;
      i += 1;
      while (i < len) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      lastSigChar = q;
      lastIdent = "";
      continue;
    }
    if (ch === "`") {
      i += 1;
      consumeTemplateBody();
      continue;
    }
    if (ch === "/") {
      const canStartRegex =
        lastSigChar === "" ||
        "=(,:![&|?{};~+-*%^<>".includes(lastSigChar) ||
        (lastIdent !== "" && ESM_REGEX_PREFIX_KW.has(lastIdent));
      if (canStartRegex) {
        i += 1;
        let inClass = false;
        while (i < len) {
          const rc = src[i];
          if (rc === "\\") {
            i += 2;
            continue;
          }
          if (rc === "\n" || rc === "\r") break;
          if (rc === "[") inClass = true;
          else if (rc === "]") inClass = false;
          else if (!inClass && rc === "/") {
            i += 1;
            while (i < len && ((src[i] >= "a" && src[i] <= "z") || (src[i] >= "A" && src[i] <= "Z"))) {
              i += 1;
            }
            break;
          }
          i += 1;
        }
        lastSigChar = "/";
        lastIdent = "";
        continue;
      }
    }
    if (ch === "{") {
      braceDepth += 1;
      lastSigChar = "{";
      lastIdent = "";
      i += 1;
      continue;
    }
    if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      i += 1;
      if (templateReturnDepths.length > 0 && braceDepth === templateReturnDepths[templateReturnDepths.length - 1]) {
        templateReturnDepths.pop();
        consumeTemplateBody();
        continue;
      }
      lastSigChar = "}";
      lastIdent = "";
      continue;
    }
    if (ch === "(") {
      parenDepth += 1;
      lastSigChar = "(";
      lastIdent = "";
      i += 1;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      lastSigChar = ")";
      lastIdent = "";
      i += 1;
      continue;
    }
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_" || ch === "$") {
      const start = i;
      i += 1;
      while (i < len) {
        const c = src[i];
        if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_" || c === "$") {
          i += 1;
        } else {
          break;
        }
      }
      const word = src.slice(start, i);
      const beforeChar = start > 0 ? src[start - 1] : "";
      if (beforeChar !== "." && lastSigChar !== ".") {
        if (word === "import") {
          let k = i;
          while (k < len && src[k] <= " ") k += 1;
          if (src[k] === ".") return true; // import.meta
          if (braceDepth === 0 && parenDepth === 0 && src[k] !== "(") return true; // top-level static import
        } else if (word === "export" && braceDepth === 0 && parenDepth === 0) {
          return true;
        }
      }
      lastSigChar = word[word.length - 1];
      lastIdent = word;
      continue;
    }
    lastSigChar = ch;
    lastIdent = "";
    i += 1;
  }
  return false;
}

/** Run a process and capture stdout / stderr with time and byte bounding */
export function runProcess({
  cmd,
  args = [],
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = 10 * 1024 * 1024,
  env = process.env,
  stdinData = null,
  windowsVerbatimArguments = false
}) {
  return new Promise((resolve) => {
    const stdoutBuffer = [];
    const stderrBuffer = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutStoredBytes = 0;
    let stderrStoredBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let finished = false;
    let childExited = false;
    const effTimeoutMs = resolveExecTimeoutMs(timeoutMs);

    let forceCloseTimer = null;

    const child = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      detached: process.platform !== "win32",
      windowsHide: true,
      windowsVerbatimArguments: Boolean(windowsVerbatimArguments),
      stdio: ["pipe", "pipe", "pipe"]
    });

    child.stdin?.on("error", () => {});
    child.stdout?.on("error", () => {});
    child.stderr?.on("error", () => {});

    const onFinish = (exitCode, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
        forceCloseTimer = null;
      }

      const rawStdout = Buffer.concat(stdoutBuffer);
      const rawStderr = Buffer.concat(stderrBuffer);
      const stdout = (stdoutTruncated ? trimIncompleteUtf8Tail(rawStdout) : rawStdout).toString("utf8");
      const stderr = (stderrTruncated ? trimIncompleteUtf8Tail(rawStderr) : rawStderr).toString("utf8");
      const rawBytes = stdoutBytes + stderrBytes;

      resolve({
        ok: exitCode === 0 && !timedOut,
        exitCode: timedOut ? 124 : (exitCode ?? (signal ? 1 : 0)),
        signal,
        timedOut,
        stdout,
        stderr,
        rawBytes
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      const pid = child.pid;
      const fallbackKill = () => {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      };
      try {
        if (pid) {
          if (process.platform === "win32") {
            const sysRoot = process.env.SystemRoot || process.env.WINDIR;
            const taskkillBin = sysRoot ? path.join(sysRoot, "System32", "taskkill.exe") : "taskkill";
            const killer = spawn(taskkillBin, ["/F", "/T", "/PID", String(pid)], {
              stdio: "ignore",
              windowsHide: true
            });
            killer.on("error", fallbackKill);
            killer.on("close", (kCode) => {
              if (kCode !== 0 && !childExited) fallbackKill();
            });
            killer.unref();
          } else {
            try {
              process.kill(-pid, "SIGKILL");
            } catch {
              fallbackKill();
            }
          }
        } else {
          fallbackKill();
        }
      } catch {
        fallbackKill();
      }
      try {
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
      } catch {
        // ignore
      }
      forceCloseTimer = setTimeout(() => onFinish(124, "SIGKILL"), 500);
      forceCloseTimer.unref?.();
    }, effTimeoutMs);

    if (stdinData && child.stdin) {
      try {
        child.stdin.end(stdinData);
      } catch {
        // ignore
      }
    } else if (child.stdin) {
      try {
        child.stdin.end();
      } catch {
        // ignore
      }
    }

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutStoredBytes < maxBytes) {
        const remain = maxBytes - stdoutStoredBytes;
        if (chunk.byteLength <= remain) {
          stdoutBuffer.push(chunk);
          stdoutStoredBytes += chunk.byteLength;
        } else {
          stdoutBuffer.push(chunk.subarray(0, remain));
          stdoutStoredBytes = maxBytes;
          stdoutTruncated = true;
        }
      } else {
        stdoutTruncated = true;
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.byteLength;
      if (stderrStoredBytes < maxBytes) {
        const remain = maxBytes - stderrStoredBytes;
        if (chunk.byteLength <= remain) {
          stderrBuffer.push(chunk);
          stderrStoredBytes += chunk.byteLength;
        } else {
          stderrBuffer.push(chunk.subarray(0, remain));
          stderrStoredBytes = maxBytes;
          stderrTruncated = true;
        }
      } else {
        stderrTruncated = true;
      }
    });

    child.on("error", (err) => {
      childExited = true;
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (forceCloseTimer) {
        clearTimeout(forceCloseTimer);
        forceCloseTimer = null;
      }
      resolve({
        ok: false,
        exitCode: 1,
        signal: null,
        timedOut: false,
        stdout: "",
        stderr: String(err && err.message ? err.message : err),
        rawBytes: 0
      });
    });

    child.on("close", (code, sig) => {
      childExited = true;
      onFinish(code, sig);
    });
  });
}

/** Execute code in specified runtime (nodejs, python, shell, pwsh, cmd) */
export async function executeCode({
  language = "shell",
  code = "",
  file = "",
  args = [],
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  env = {}
}) {
  const normLang = String(language || "shell").toLowerCase().trim();
  const workdir = cwd || process.cwd();
  const safeArgs = Array.isArray(args) ? args.map((a) => String(a)) : [];

  // 1. Node.js
  if (normLang === "nodejs" || normLang === "node" || normLang === "javascript" || normLang === "js") {
    if (file) {
      const scriptPath = path.isAbsolute(file) ? file : path.resolve(workdir, file);
      return runProcess({
        cmd: process.execPath,
        args: [scriptPath, ...safeArgs],
        cwd: workdir,
        timeoutMs,
        env
      });
    }
    const nodeFlags = isLikelyEsmCode(code) ? ["--input-type=module", "-e", code, "--", ...safeArgs] : ["-e", code, "--", ...safeArgs];
    return runProcess({
      cmd: process.execPath,
      args: nodeFlags,
      cwd: workdir,
      timeoutMs,
      env
    });
  }

  // 2. Python
  if (normLang === "python" || normLang === "python3" || normLang === "py") {
    const pythonBin = process.platform === "win32" ? "python" : "python3";
    if (file) {
      const scriptPath = path.isAbsolute(file) ? file : path.resolve(workdir, file);
      return runProcess({
        cmd: pythonBin,
        args: [scriptPath, ...safeArgs],
        cwd: workdir,
        timeoutMs,
        env
      });
    }
    return runProcess({
      cmd: pythonBin,
      args: ["-c", code, ...safeArgs],
      cwd: workdir,
      timeoutMs,
      env
    });
  }

  // Helper for safe Windows .bat / .cmd script execution with literal args
  const runCmdBatchFile = (scriptPath) => {
    if (
      scriptPath.includes('"') ||
      /[\r\n\0]/.test(scriptPath) ||
      safeArgs.some((a) => a.includes('"') || /[\r\n\0]/.test(a))
    ) {
      return {
        ok: false,
        exitCode: 1,
        signal: null,
        timedOut: false,
        stdout: "",
        stderr: "Invalid script file path or argument for cmd execution",
        rawBytes: 0
      };
    }
    const cmdEnv = { ...env, __AGY_CMD_FILE: scriptPath };
    const argRefs = safeArgs.map((arg, idx) => {
      const key = `__AGY_CMD_ARG_${idx}`;
      cmdEnv[key] = arg;
      return `"%${key}%"`;
    });
    const cmdLine = `"${['"%__AGY_CMD_FILE%"', ...argRefs].join(" ")}"`;
    return runProcess({
      cmd: "cmd.exe",
      args: ["/d", "/s", "/c", cmdLine],
      cwd: workdir,
      timeoutMs,
      env: cmdEnv,
      windowsVerbatimArguments: true
    });
  };

  // 3. PowerShell
  const runPowerShellCommand = async (bin, scriptText) => {
    const psScript = scriptText || "";
    if (safeArgs.length === 0) {
      return runProcess({
        cmd: bin,
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
        cwd: workdir,
        timeoutMs,
        env
      });
    }
    // Execute via ephemeral .ps1 file so literal safeArgs bind cleanly via -File, exit N & $LASTEXITCODE
    // propagate accurately on both Windows PowerShell 5.1 and pwsh 7+, and zero __AGY_PS_* env vars leak.
    let tmpPs1 = "";
    try {
      tmpPs1 = path.join(os.tmpdir(), `agy-dart-ps-${process.pid}-${Date.now()}-${randomBytes(4).toString("hex")}.ps1`);
      fs.writeFileSync(tmpPs1, `\uFEFF${psScript}`, { encoding: "utf8", mode: 0o600 });
      return await runProcess({
        cmd: bin,
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tmpPs1, ...safeArgs],
        cwd: workdir,
        timeoutMs,
        env
      });
    } catch {
      const psEnv = { ...env, __AGY_PS_CODE: psScript };
      const clearStmts = ["Remove-Item Env:__AGY_PS_CODE -ErrorAction SilentlyContinue"];
      const psArgItems = safeArgs.map((arg, idx) => {
        const key = `__AGY_PS_ARG_${idx}`;
        psEnv[key] = arg;
        clearStmts.push(`Remove-Item Env:${key} -ErrorAction SilentlyContinue`);
        return `$env:${key}`;
      });
      const wrapper = `$__agyCode = $env:__AGY_PS_CODE; $__agyArgs = @(${psArgItems.join(", ")}); ${clearStmts.join("; ")}; $global:LASTEXITCODE = $null; & ([scriptblock]::Create($__agyCode)) @__agyArgs; if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`;
      return runProcess({
        cmd: bin,
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", wrapper],
        cwd: workdir,
        timeoutMs,
        env: psEnv
      });
    } finally {
      if (tmpPs1) {
        try {
          fs.rmSync(tmpPs1, { force: true });
        } catch {}
      }
    }
  };

  if (normLang === "pwsh" || normLang === "powershell") {
    const bin = process.platform === "win32" ? "powershell.exe" : "pwsh";
    if (file) {
      const scriptPath = path.isAbsolute(file) ? file : path.resolve(workdir, file);
      if (process.platform === "win32" && /\.(?:bat|cmd)$/i.test(scriptPath)) {
        return runCmdBatchFile(scriptPath);
      }
      return runProcess({
        cmd: bin,
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...safeArgs],
        cwd: workdir,
        timeoutMs,
        env
      });
    }
    return runPowerShellCommand(bin, code);
  }

  // 4. Windows CMD
  if (normLang === "cmd" || normLang === "bat") {
    if (!code && file) {
      const scriptPath = path.isAbsolute(file) ? file : path.resolve(workdir, file);
      return runCmdBatchFile(scriptPath);
    }
    return runProcess({
      cmd: "cmd.exe",
      args: ["/d", "/s", "/c", code || ""],
      cwd: workdir,
      timeoutMs,
      env
    });
  }

  // 5. Default Shell
  if (process.platform === "win32") {
    if (!code && file) {
      const scriptPath = path.isAbsolute(file) ? file : path.resolve(workdir, file);
      if (/\.(?:bat|cmd)$/i.test(scriptPath)) {
        return runCmdBatchFile(scriptPath);
      }
      return runProcess({
        cmd: "powershell.exe",
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...safeArgs],
        cwd: workdir,
        timeoutMs,
        env
      });
    }
    return runPowerShellCommand("powershell.exe", code || "");
  } else {
    const shell = process.env.SHELL || "/bin/sh";
    if (!code && file) {
      const scriptPath = path.isAbsolute(file) ? file : path.resolve(workdir, file);
      return runProcess({
        cmd: shell,
        args: [scriptPath, ...safeArgs],
        cwd: workdir,
        timeoutMs,
        env
      });
    }
    return runProcess({
      cmd: shell,
      args: safeArgs.length > 0 ? ["-c", code || "", "--", ...safeArgs] : ["-c", code || ""],
      cwd: workdir,
      timeoutMs,
      env
    });
  }
}
