// agy-fast SessionStart Hook (bundled zero-dependency ESM)

// src/utils/snapshot.ts
import { promises as fs } from "node:fs";
import path from "node:path";

// src/utils/exec-utils.ts
import { spawn } from "node:child_process";
var DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;
function killChildTree(pid, detached) {
  if (!pid) return;
  if (process.platform === "win32") {
    const fallbackKill = () => {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
      }
    };
    try {
      const sysRoot = process.env.SystemRoot || process.env.WINDIR;
      const taskkillBin = sysRoot ? path.join(sysRoot, "System32", "taskkill.exe") : "taskkill";
      const killer = spawn(taskkillBin, ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
      killer.on("error", fallbackKill);
      killer.unref();
    } catch {
      fallbackKill();
    }
    return;
  }
  try {
    if (detached) {
      process.kill(-pid, "SIGTERM");
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
  }
  setTimeout(() => {
    try {
      if (detached) {
        process.kill(-pid, "SIGKILL");
      } else {
        process.kill(pid, "SIGKILL");
      }
    } catch {
    }
  }, 400).unref();
}
function execBinaryAsync(bin, args, options) {
  return spawnAndCollect(bin, args, false, options);
}
function spawnAndCollect(commandOrBin, args, shell, options) {
  const startMs = Date.now();
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const detached = process.platform !== "win32";
  return new Promise((resolve) => {
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;
    const stdoutChunks = [];
    const stderrChunks = [];
    let child;
    try {
      child = spawn(commandOrBin, args, {
        cwd: options.cwd,
        shell,
        detached,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: options.env ?? process.env
      });
    } catch (err) {
      resolve({
        exitCode: null,
        signal: null,
        timedOut: false,
        durationMs: Date.now() - startMs,
        stdout: "",
        stderr: "",
        truncated: false,
        error: err instanceof Error ? err.message : String(err)
      });
      return;
    }
    let settleFallbackTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      killChildTree(child.pid, detached);
      settleFallbackTimer = setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
        finish(null, "SIGKILL");
      }, 1500);
      settleFallbackTimer.unref();
    }, Math.max(100, options.timeoutMs));
    timer.unref();
    const finish = (exitCode, signal, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (settleFallbackTimer) clearTimeout(settleFallbackTimer);
      resolve({
        exitCode,
        signal,
        timedOut,
        durationMs: Date.now() - startMs,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        truncated,
        error
      });
    };
    child.stdout?.on("data", (chunk) => {
      if (stdoutBytes >= maxOutputBytes) {
        truncated = true;
        return;
      }
      const remaining = maxOutputBytes - stdoutBytes;
      if (chunk.length > remaining) {
        stdoutChunks.push(chunk.subarray(0, remaining));
        stdoutBytes += remaining;
        truncated = true;
      } else {
        stdoutChunks.push(chunk);
        stdoutBytes += chunk.length;
      }
    });
    child.stderr?.on("data", (chunk) => {
      if (stderrBytes >= maxOutputBytes) {
        truncated = true;
        return;
      }
      const remaining = maxOutputBytes - stderrBytes;
      if (chunk.length > remaining) {
        stderrChunks.push(chunk.subarray(0, remaining));
        stderrBytes += remaining;
        truncated = true;
      } else {
        stderrChunks.push(chunk);
        stderrBytes += chunk.length;
      }
    });
    child.on("error", (err) => {
      finish(null, null, err.message);
    });
    child.on("close", (code, signal) => {
      finish(code, signal);
    });
  });
}

// src/utils/fs-utils.ts
var DEFAULT_IGNORE_DIRS = /* @__PURE__ */ new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".cache",
  ".turbo",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".gradle",
  ".idea",
  "vendor"
]);

// src/utils/snapshot.ts
async function getGitSummary(workspaceDir, timeoutMs) {
  const [branchRes, symRefRes, statusRes, logRes] = await Promise.all([
    execBinaryAsync("git", ["--no-optional-locks", "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: workspaceDir,
      timeoutMs,
      maxOutputBytes: 4096
    }),
    execBinaryAsync("git", ["--no-optional-locks", "symbolic-ref", "--short", "HEAD"], {
      cwd: workspaceDir,
      timeoutMs,
      maxOutputBytes: 4096
    }),
    execBinaryAsync("git", ["--no-optional-locks", "status", "--porcelain=v1"], {
      cwd: workspaceDir,
      timeoutMs,
      maxOutputBytes: 32768
    }),
    execBinaryAsync("git", ["--no-optional-locks", "log", "-n", "3", "--format=%h %s"], {
      cwd: workspaceDir,
      timeoutMs,
      maxOutputBytes: 8192
    })
  ]);
  const hasValidRepo = !branchRes.error && branchRes.exitCode === 0 || !symRefRes.error && symRefRes.exitCode === 0 || !statusRes.error && statusRes.exitCode === 0;
  if (!hasValidRepo) {
    return null;
  }
  const branch = branchRes.exitCode === 0 && branchRes.stdout.trim() || symRefRes.exitCode === 0 && symRefRes.stdout.trim() || "HEAD";
  const isUnborn = branchRes.exitCode !== 0 && symRefRes.exitCode === 0;
  const statusLines = statusRes.exitCode === 0 ? statusRes.stdout.split(/\r?\n/).filter((l) => {
    const trimmed = l.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("?? ")) {
      const topSeg = trimmed.slice(3).split("/")[0]?.replace(/\/$/, "");
      if (topSeg && DEFAULT_IGNORE_DIRS.has(topSeg)) return false;
    }
    return true;
  }) : [];
  const logLines = logRes.exitCode === 0 ? logRes.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  const parts = [
    isUnborn ? `Git: branch \`${branch}\` (unborn, no commits yet)` : `Git: branch \`${branch}\``
  ];
  if (statusLines.length === 0) {
    parts.push("Working tree: clean");
  } else {
    const prefix = `Modified (${statusLines.length}): `;
    const maxModifiedChars = 260;
    const maxItems = 8;
    const shown = [];
    let currentLen = prefix.length;
    for (let i = 0; i < Math.min(statusLines.length, maxItems); i++) {
      const raw = statusLines[i].trim();
      const item = raw.length > 100 ? `${raw.slice(0, 97)}...` : raw;
      const sepLen = shown.length > 0 ? 2 : 0;
      const remainingAfter = statusLines.length - (i + 1);
      const moreReserve = remainingAfter > 0 ? ` (+${remainingAfter} more)`.length : 0;
      if (shown.length > 0 && currentLen + sepLen + item.length + moreReserve > maxModifiedChars) {
        break;
      }
      shown.push(item);
      currentLen += sepLen + item.length;
    }
    const more = shown.length < statusLines.length ? ` (+${statusLines.length - shown.length} more)` : "";
    parts.push(`${prefix}${shown.join(", ")}${more}`);
  }
  if (logLines.length > 0) {
    parts.push(
      `Recent commits:
${logLines.map((l) => `  - ${l.slice(0, 72)}`).join("\n")}`
    );
  }
  return parts.join("\n");
}
var SNAPSHOT_COLLAPSE_DIRS = /* @__PURE__ */ new Set([
  "tmp",
  "temp",
  "output",
  "outputs",
  "artifacts",
  "ssl",
  "SSL",
  "playwright-report",
  "test-results",
  "coverage",
  "logs"
]);
var SNAPSHOT_PRIORITY_SUBDIRS = /* @__PURE__ */ new Set([
  "src",
  "app",
  "lib",
  "packages",
  "server",
  "web",
  "client",
  "api",
  "tests",
  "test",
  "scripts"
]);
function isIgnoredSnapshotSubdir(name) {
  if (name.startsWith(".") || DEFAULT_IGNORE_DIRS.has(name)) return true;
  if (name === "playwright-report" || name === "test-results" || name.startsWith("dist-") || name.startsWith("build-")) {
    return true;
  }
  return false;
}
var MANIFEST_SKIP_SUBDIRS = /* @__PURE__ */ new Set([
  "docs",
  "doc",
  "assets",
  "scripts",
  "test",
  "tests",
  "fixtures",
  "examples",
  ...SNAPSHOT_COLLAPSE_DIRS
]);
function shortEntryName(name, maxLen = 28) {
  return name.length > maxLen ? `${name.slice(0, maxLen - 3)}...` : name;
}
async function getTwoLevelTree(workspaceDir) {
  let topEntries;
  try {
    topEntries = await fs.readdir(workspaceDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const filteredTop = topEntries.filter((e) => {
    if (e.name === ".DS_Store") return false;
    if (e.isDirectory()) {
      if (e.name.startsWith(".")) return false;
      if (DEFAULT_IGNORE_DIRS.has(e.name)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    const aCollapse = a.isDirectory() && SNAPSHOT_COLLAPSE_DIRS.has(a.name);
    const bCollapse = b.isDirectory() && SNAPSHOT_COLLAPSE_DIRS.has(b.name);
    if (aCollapse !== bCollapse) return aCollapse ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  if (filteredTop.length === 0) return null;
  const lines = [];
  const maxTop = 20;
  const shownTop = filteredTop.slice(0, maxTop);
  const subResults = await Promise.all(
    shownTop.map(async (entry) => {
      if (!entry.isDirectory()) {
        return {
          name: shortEntryName(entry.name),
          isDir: false,
          collapsedCount: null,
          children: [],
          more: 0
        };
      }
      try {
        const sub = await fs.readdir(path.join(workspaceDir, entry.name), {
          withFileTypes: true
        });
        const valid = sub.filter(
          (s) => s.name !== ".DS_Store" && !(s.isDirectory() && isIgnoredSnapshotSubdir(s.name))
        ).sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          if (a.isDirectory() && b.isDirectory()) {
            const aPrio = SNAPSHOT_PRIORITY_SUBDIRS.has(a.name);
            const bPrio = SNAPSHOT_PRIORITY_SUBDIRS.has(b.name);
            if (aPrio !== bPrio) return aPrio ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        if (SNAPSHOT_COLLAPSE_DIRS.has(entry.name)) {
          return {
            name: `${entry.name}/`,
            isDir: true,
            collapsedCount: valid.length,
            children: [],
            more: 0
          };
        }
        const maxSub = 6;
        const children = valid.slice(0, maxSub).map((s) => {
          const base = shortEntryName(s.name);
          return s.isDirectory() ? `${base}/` : base;
        });
        return {
          name: `${entry.name}/`,
          isDir: true,
          collapsedCount: null,
          children,
          more: Math.max(0, valid.length - maxSub)
        };
      } catch {
        return {
          name: `${entry.name}/`,
          isDir: true,
          collapsedCount: null,
          children: [],
          more: 0
        };
      }
    })
  );
  for (const item of subResults) {
    if (!item.isDir) {
      lines.push(`  ${item.name}`);
    } else if (item.collapsedCount !== null) {
      lines.push(`  ${item.name} (${item.collapsedCount} entries)`);
    } else if (item.children.length === 0) {
      lines.push(`  ${item.name}`);
    } else {
      const more = item.more > 0 ? `, +${item.more}` : "";
      lines.push(`  ${item.name} (${item.children.join(", ")}${more})`);
    }
  }
  if (filteredTop.length > maxTop) {
    lines.push(`  ... (+${filteredTop.length - maxTop} more top-level entries)`);
  }
  return `Layout (2 levels):
${lines.join("\n")}`;
}
async function detectManifestsInDir(dirPath, prefix) {
  const hints = [];
  await Promise.all([
    // package.json
    (async () => {
      try {
        const raw = await fs.readFile(path.join(dirPath, "package.json"), "utf8");
        const pkg = JSON.parse(raw);
        const scriptNames = pkg.scripts ? Object.keys(pkg.scripts).slice(0, 12) : [];
        const label = pkg.name ? `${prefix}package.json (${pkg.name})` : `${prefix}package.json`;
        hints.push(
          scriptNames.length > 0 ? `${label} scripts: ${scriptNames.join(", ")}` : label
        );
      } catch {
      }
    })(),
    // Makefile (root only to avoid noisy nested Makefiles)
    (async () => {
      if (prefix) return;
      for (const name of ["Makefile", "makefile"]) {
        try {
          const raw = await fs.readFile(path.join(dirPath, name), "utf8");
          const targets = [];
          for (const line of raw.split(/\r?\n/)) {
            const m = /^([A-Za-z0-9_.-]+)\s*:(?!=)/.exec(line);
            if (m && m[1] && !m[1].startsWith(".")) {
              if (!targets.includes(m[1])) targets.push(m[1]);
              if (targets.length >= 10) break;
            }
          }
          hints.push(
            targets.length > 0 ? `${name} targets: ${targets.join(", ")}` : name
          );
          break;
        } catch {
        }
      }
    })(),
    // pom.xml (Maven)
    (async () => {
      try {
        const raw = await fs.readFile(path.join(dirPath, "pom.xml"), "utf8");
        const stripped = raw.replace(/<parent>[\s\S]*?<\/parent>/i, "");
        const m = /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/i.exec(stripped);
        hints.push(
          m?.[1] ? `${prefix}pom.xml (${m[1]}, maven)` : `${prefix}pom.xml (maven)`
        );
      } catch {
      }
    })(),
    // build.gradle / build.gradle.kts
    (async () => {
      for (const name of ["build.gradle.kts", "build.gradle"]) {
        try {
          await fs.access(path.join(dirPath, name));
          hints.push(`${prefix}${name} (gradle)`);
          break;
        } catch {
        }
      }
    })(),
    // pyproject.toml
    (async () => {
      try {
        const raw = await fs.readFile(path.join(dirPath, "pyproject.toml"), "utf8");
        const tools = [];
        if (/\[tool\.pytest/.test(raw)) tools.push("pytest");
        if (/\[tool\.ruff/.test(raw)) tools.push("ruff");
        if (/\[tool\.mypy/.test(raw)) tools.push("mypy");
        if (/\[tool\.poetry/.test(raw)) tools.push("poetry");
        if (/\[tool\.uv/.test(raw)) tools.push("uv");
        hints.push(
          tools.length > 0 ? `${prefix}pyproject.toml (${tools.join(", ")})` : `${prefix}pyproject.toml`
        );
      } catch {
      }
    })(),
    // Cargo.toml
    (async () => {
      try {
        const raw = await fs.readFile(path.join(dirPath, "Cargo.toml"), "utf8");
        const isWorkspace = /\[workspace\]/.test(raw);
        hints.push(
          isWorkspace ? `${prefix}Cargo.toml (workspace)` : `${prefix}Cargo.toml`
        );
      } catch {
      }
    })(),
    // go.mod
    (async () => {
      try {
        const raw = await fs.readFile(path.join(dirPath, "go.mod"), "utf8");
        const m = /^module\s+(\S+)/m.exec(raw);
        hints.push(m?.[1] ? `${prefix}go.mod (${m[1]})` : `${prefix}go.mod`);
      } catch {
      }
    })()
  ]);
  return hints;
}
async function getProjectManifestSummary(workspaceDir) {
  const rootHints = await detectManifestsInDir(workspaceDir, "");
  const allHints = [...rootHints];
  try {
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    const subdirs = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith(".") && !DEFAULT_IGNORE_DIRS.has(e.name) && !MANIFEST_SKIP_SUBDIRS.has(e.name)
    ).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
    const nested = await Promise.all(
      subdirs.map(
        (d) => detectManifestsInDir(path.join(workspaceDir, d.name), `${d.name}/`)
      )
    );
    for (const list of nested) {
      allHints.push(...list);
    }
  } catch {
  }
  if (allHints.length === 0) return null;
  allHints.sort();
  return `Project:
${allHints.slice(0, 6).map((h) => `  - ${h}`).join("\n")}`;
}
function fitSectionToChars(section, budget, marker) {
  if (budget <= 0) return "";
  if (section.length <= budget) return section;
  if (budget <= marker.length + 1) {
    return section.slice(0, budget);
  }
  const cutoff = budget - marker.length - 1;
  let trimmed = section.slice(0, cutoff);
  const lastNl = trimmed.lastIndexOf("\n");
  if (lastNl > 0) {
    trimmed = trimmed.slice(0, lastNl);
  }
  return `${trimmed}
${marker}`;
}
async function buildWorkspaceSnapshot(workspaceDir, options = {}) {
  const maxChars = options.maxChars ?? 1500;
  const gitTimeoutMs = options.gitTimeoutMs ?? 800;
  try {
    const stat = await fs.stat(workspaceDir);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  const [gitSummary, treeSummary, projectSummary] = await Promise.all([
    getGitSummary(workspaceDir, gitTimeoutMs),
    getTwoLevelTree(workspaceDir),
    getProjectManifestSummary(workspaceDir)
  ]);
  const header = `[agy-dart startup snapshot] Workspace: ${workspaceDir}`;
  const sections = [header, gitSummary, projectSummary, treeSummary].filter(
    (s) => Boolean(s)
  );
  if (sections.length <= 1) return null;
  const suffix = "... [snapshot capped]";
  if (maxChars <= header.length + suffix.length + 4) {
    return fitSectionToChars(sections.join("\n"), maxChars, suffix);
  }
  // Strictly deterministic Turn-0 prefix stability: compute `projectPart` and `treePart`
  // solely from `header + projectSummary + treeSummary` (never influenced by `gitSummary`),
  // then allocate only the remaining character budget to the volatile `gitPart`.
  const stableJoined = [header, projectSummary, treeSummary].filter(Boolean).join("\n");
  let projectPart = "";
  let treePart = "";
  if (stableJoined.length <= maxChars) {
    projectPart = projectSummary || "";
    treePart = treeSummary || "";
  } else {
    const sepCount = (projectSummary ? 1 : 0) + (treeSummary ? 1 : 0);
    let budgetLeft = Math.max(0, maxChars - header.length - sepCount);
    if (projectSummary && budgetLeft > 0) {
      const otherPresent = Boolean(treeSummary);
      const projectCap = otherPresent
        ? Math.min(projectSummary.length, Math.max(80, Math.floor(budgetLeft * 0.25)))
        : budgetLeft;
      projectPart = fitSectionToChars(
        projectSummary,
        Math.min(budgetLeft, projectCap),
        "  ... [project capped]"
      );
      budgetLeft -= projectPart.length;
    }
    if (treeSummary && budgetLeft > 0) {
      treePart = fitSectionToChars(treeSummary, budgetLeft, suffix);
      budgetLeft -= treePart.length;
    }
  }
  const stableUsed = [header, projectPart, treePart].filter(Boolean).join("\n").length;
  const gitBudget = maxChars - stableUsed - 1;
  let gitPart = "";
  if (gitSummary && gitBudget >= 40) {
    gitPart = fitSectionToChars(
      gitSummary,
      gitBudget,
      "  ... [git capped]"
    );
  }
  return [header, gitPart, projectPart, treePart].filter(Boolean).join("\n");
}

// src/session-start.ts
function firstNonEmptyPath(list) {
  if (!Array.isArray(list)) return "";
  for (const item of list) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }
  }
  return "";
}
async function readStdin(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    const onData = (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.off("data", onData);
      process.stdin.off("end", finish);
      process.stdin.off("error", finish);
      try {
        process.stdin.pause();
        process.stdin.unref?.();
      } catch {
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const timer = setTimeout(finish, timeoutMs);
    timer.unref();
    process.stdin.on("data", onData);
    process.stdin.on("end", finish);
    process.stdin.on("error", finish);
  });
}
async function main() {
  try {
    const raw = (await readStdin()).trim();
    if (!raw) {
      process.stdout.write("{}\n");
      return;
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      process.stdout.write("{}\n");
      return;
    }
    const workspaceDir = typeof payload.cwd === "string" && payload.cwd.trim() || firstNonEmptyPath(payload.workspacePaths) || firstNonEmptyPath(payload.workspace_paths) || firstNonEmptyPath(payload.workspaceRoots) || firstNonEmptyPath(payload.workspace_roots);
    if (!workspaceDir) {
      process.stdout.write("{}\n");
      return;
    }
    const snapshot = await buildWorkspaceSnapshot(workspaceDir, {
      maxChars: 1500,
      gitTimeoutMs: 800
    });
    if (!snapshot) {
      process.stdout.write("{}\n");
      return;
    }
    const response = {
      injectSteps: [
        {
          systemMessage: {
            systemMessage: snapshot
          }
        }
      ]
    };
    process.stdout.write(`${JSON.stringify(response)}
`);
  } catch {
    process.stdout.write("{}\n");
  }
}
void main();
