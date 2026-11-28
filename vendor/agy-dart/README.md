<div align="center">

<img src="assets/logo.svg" alt="agy-dart logo" width="80" />

# agy-dart

**All-in-One Latency Accelerator & Context-Window Guard Plugin for Google Antigravity**

Zero Runtime Dependencies · Dual-Engine Co-op · Hard `<= 8.8 KB` No-Spill Budget · Built-in Live Sidecar Dashboard · Optional Auto `rg` Setup

[简体中文](README.zh-CN.md) · English · [Community Feedback & Improvements](#community-feedback--improvements) · [Third-Party Notices](THIRD_PARTY_NOTICES.md)

</div>

---

## Why `agy-dart`?

Long coding sessions in Google Antigravity (Desktop 2.0 / IDE / CLI) hit two compounding bottlenecks:
1. **Round-trip & check latency**: per-turn TTFT, split `edit_file` calls, serial shell searches, and Antigravity's ~10 KB MCP `output.txt` disk spill causing extra turns.
2. **Context bloat & agent amnesia**: multi-megabyte build logs, giant JSON/CSV payloads, and un-paged file dumps flooding the prompt.

Installing separate acceleration and context-guard plugins naively causes friction (over-eager 8 KB read blocks fighting local 7ms `read_file`, conflicting `AGENTS.md` routing rules, MCP previews spilling past 10 KB, and missing Sidecar assets from npm installs).

**`agy-dart`** fuses both capabilities into **one clean native Antigravity plugin** with unified zero-conflict routing, single-process lifecycle hooks, an isolated SQLite store (`~/.agy-dart/context.db`), and a live Aux Pane dashboard.

---

## What's New in v1.3.0

1. **4-Tier Host-Aligned Read Guard & Review Workflow First-Class Support**:
   - Aligned default source-file cutoff to **`45 KiB` (`46,080 B` / `<= 800` lines, `host-45k` mode)** matching Antigravity's native `read_file` cap with **2-strike soft guard** (5-branch session/subagent/anonymous TTL key isolation) so large source files and MCP-less subagents never deadlock, while keeping high-noise logs/locks/minified bundles at **`16 KB`** (`noiseMaxReadBytes`) and `.patch`/`.diff` code-review files at **`128 KB`** (`reviewMaxReadBytes`) with native `ByteOffset` / open-ended `StartLine` pagination continuation.
   - Decoupled `read_file` size exemptions (`exemptExtensions`, linear ReDoS-proof `exemptPaths`, `readGuardMode: "soft"|"strict"|"off"`) from **both** `readDedup`/`diffRead` (exempt text files still enjoy duplicate-read protection) and `run_command` (which now uses an independent `shellDumpMaxBytes = 16 KB` and no longer allows `cat huge.png` / `curl .../archive.zip` bypasses).
   - Fixed pre-1a read-cache priority (eliminating the 3-strike trap), `measureLineRangeBytes` `>2 MB && startLine > 1` blind spot, multi-line prose mislabeling as minified, `sensitive_read_confirm` TTL/isolation, `getExemptExtensions` split-state bug, Sidecar `/api/purge` `"conversation"` scope error, dynamic custom cutoff dropdown echo, and bidirectional upgrade migration (`cutoff:source` migrates legacy `16384` default while preserving custom cutoffs).
2. **Native Diff Outlines & 3-Stage Context-Preserving `git diff` / `gh pr diff` Filter**:
   - Added zero-dependency `.patch`/`.diff` outline parser (`extractDiffSymbols`) to `agy-dart_fast` `read_slices({ outlines })` mapping changed files (`+add/-del`) and `@@` hunks.
   - Upgraded `filterGitDiff` to 3-stage context fidelity (Stage 1 lossless within `<= 7.9 KB` budget → Stage 2 `-U`/`--unified`/`-W`/`--word-diff` context-preserved cap → Stage 3 1-line context before compact `+/-`, plus mailbox `From <sha>` / `---` support) and fixed `filterGhCli` so `gh pr view` with Markdown diff fences is never wiped.

## What's New in v1.2.2

1. **Long-Task Continuity & Anti-Premature-Handoff Protections**:
   - Removed mid-task `/compact` prompts from `rules/AGENTS.md` and routed `>60s` builds/tests + background tasks (`WaitMsBeforeAsync <= 2000`, `cliFilterAsyncBypassMs`) directly to native `run_command` (preserving live streaming logs and attaching read-only `permissionOverrides` for plugin scripts on sync `overwrite`).
   - Raised `ctx_execute` default timeout to `120s` (`execTimeoutMs`, per-call `timeoutSec: 1..300`) with `timedOut: true` guidance, added workspace `cwd` support across `agy-dart_context` tools + MCP `initialize` `workspaceFolders`/`rootUri`, suppressed mid-turn tool-loop (`invocationNum >= 1`) TTL/cold-compact banners in `PreInvocation` (scaling 1M-window `ttlMinContext` to `300k`), and added step-based read-dedup decay (`readDedupMaxSteps: 40`).
2. **Second-Round Deep Audit, Cross-Platform CI & Protocol Hardening (42 Verified Fixes)**:
   - **Access-Control, SSRF, ReDoS & Windows Shell Fidelity**: Enforced end-to-end `sensitiveFileGuard=deny` (including symlinked files, `.envrc`/`*.env`, and `\\?\` ADS paths) across `PreToolUse`, `fast/mcp-server.mjs`, `ctx_index`, and `ctx_execute` (`P1-03`); forced `-n` on `git remote show` to block network SSRF (`P1-04`); hardened `install.mjs` against internal symlinks/NTFS junctions, UNC shares, and `.git` clones/worktrees while supporting self-`uninstall` (`P1-05`/`P1-06`); respected per-directory `PATHEXT` precedence and PowerShell `,`/`--`/`"` safety in `cli-filter` (`P1-07`); and capped serialized `fast` JSON-RPC payloads `<= 8.8 KB` with mixed `\n\n`/`\r\n\r\n` frame safety, dangling-symlink rollback, and bounded glob/regex/Markdown linear parsers (`P1-09`–`P1-13`).
   - **Session Isolation, Process-Group Teardown & Multi-Provider Accuracy**: Enforced strict session/worktree/lifetime isolation in Sidecar `/api/search` and MCP `ctx_search`/`ctx_resume` (`P1-01`); added POSIX `detached` process-group + Windows `taskkill /T /F` teardown, linear JS ESM `--input-type=module` lexer, recursive subshell inspection, and graceful Windows `413` socket close; wrapped `pruneByTtl` in transactions, computed per-turn USD cost across `model_switch`, fixed OpenAI gateway cached-token double-counting, and anchored 1h implicit-write replay deltas (126/126 tests across Linux & Windows on Node 22/24).

## What's New in v1.2.1

1. **Full-Repository Security & Stability Hardening (76 Audited Fixes)**:
   - Split `apply_edits` temp-file write from `rename` fallback with guaranteed rollback (`C-1`), attached `child.stdin`/`stdout`/`stderr` error handlers and `close`-drained capture in `context/lib/executor.js` (`C-2`/`H-10`), hardened PowerShell `-Command` argument passing via env-var indirection (`M-21`), closed read-only `git branch`/`tag` `OPTARG` bypasses (`H-1`), hardened Windows `\\?\`/`\\.\`/8.3 path canonicalization (`H-2`/`H-3`), and eliminated $O(N^4)$ CSS/SFC outline ReDoS (`H-7`).

## What's New in v1.2.0

1. **Sidecar Security Hardening & Unified Config (`~/.agy-dart/config.json`)**:
   - Standalone HTTP Sidecar requires per-process `X-Agy-Dart-Token` across all `/api/*` endpoints (while `SidecarApp` mode enforces `POST` + `X-Sidecar-Token`); `/api/search` and all mutating endpoints (`/api/purge`, `/api/toggle-active`, `/api/cutoff`, `/api/exemptions`, `/api/maintenance`, `/api/cli-filter`, `/api/read-dedup`) are strictly `POST`-only with `Content-Type: application/json`, `Host`/`Origin`/`Sec-Fetch-Site` anti-DNS-rebinding guards, a `64 KB` request body cap, and XSS-safe DOM rendering.
   - Consolidated 20+ `AGY_DART_*` toggles into `~/.agy-dart/config.json` (with `AGY_DART_*` env vars always overriding); `doctor` and `ctx_doctor` print effective flags and override provenance.
2. **SmartCrusher, Expanded CLI Rules & Hardened Shell Guard**:
   - Reversible zero-dep JSON/JSONL structural compactor (`context/lib/json-crusher.js`) extracts schema, head/tail samples, and prioritized anomalies (`status >= 400`, `ok: false`, fatal/error rows) while indexing raw output into FTS5.
   - Added built-in CLI rules for `gh`, `kubectl`, `terraform`, and `playwright`, project-level declarative `.agy-dart/filters.json` (with ReDoS validator), safe `cd [/d] <path> && <cmd> [2>&1]` unwrapping, and stricter cmd/PowerShell metacharacter rejection (`%`, `!`, `{}`, `@`, non-git `^`).
3. **Opt-In Three-State Diff-Read Cache (Safe by Default)**:
   - Compact unified-diff re-reads on modified files are **OFF by default** (`diffRead: true` in `~/.agy-dart/config.json` or `AGY_DART_ENABLE_DIFF_READ=1` to opt in), scoped strictly to direct `conversationId` (zero parent↔subagent baseline leaks), bounded by recency (`diffReadMaxTurns` / `diffReadMaxAgeMs`), and carry baseline SHA/timestamp + 2-strike full-file bypass hints.
4. **KV-Cache Diagnostics, Policy Replay, Handoff Brief & Persistent L2 Caches**:
   - Added `npm run cache:audit` (global Prompt Cache audit), `npm run cache:simulate` (7-policy offline replay comparing 5m vs 1h TTL, cold-boundary compact, and cutoffs), Sidecar **Handoff Brief** + live 1s TTL countdown, 7-bucket `contextComposition` & `subagentBreakdown`, subagent Turn-0 stable-prefix sharing, persistent SQLite L2 `outline_cache`, per-feature ROI telemetry (`featureRoi`), and cross-Node 22/24 zero-`stderr` SQLite warning suppression.
5. **Modular Store & Lean Runtime Install**:
   - Split `context/lib/store.js` into focused `context/lib/store/` submodules and `context/lib/cache/profiles.js`; default `scripts/install.mjs install` copies **runtime files only** (pass `--with-devtools` to also copy offline benchmark/audit CLIs), verified automatically by `npm run verify:pkg`.

## What's New in v1.1.0

1. **Transparent CLI Output Filtering (`PreToolUse.overwrite`)**: Automatically wraps safe noisy dev commands (`git status/diff/log`, `npm/pnpm/yarn/node/pytest/cargo/go/dotnet` tests, `tsc/eslint/ruff/mypy/vite/cargo` builds, package installs, `docker build`) through zero-dependency `hooks/cli-filter.mjs` in **1 turn** (zero deny/retry overhead!), preserving exact exit codes, stripping ANSI/spinners, capping inline output `<= 8.8 KB`, and indexing raw output in SQLite FTS5.
2. **Server-Side KV-Cache Protection & Diagnostics**:
   - Deterministic prefix-stable `SessionStart` ordering (static routing line → semi-static Project/Layout + `git HEAD`-cached import hubs → volatile `git status` last) and slimmed canonical Turn-0 MCP tool schemas (`npm run prefix:budget` ~2,832–2,950 est. tokens).
   - Model-aware dynamic watermarks, idle TTL, and cost-discount estimation (`resolveModelProfile` across Claude / Gemini / GPT / DeepSeek / Qwen tiers, with env overrides) + **Doom-Loop / Oscillation Watch** (`edit↔fail` cycles & normalized tool-call repeat rate).
   - Zero-prefix-pollution `PreInvocation` hook using Antigravity's UI-only `metadata.user_markdown` (`systemMessage: ""`) for dynamic context watermark, hot-cache compact-delay, idle TTL expiry, multimodal TTFT cliff, and convergence alerts.
   - Deep `transcript.jsonl` cache-bust attribution, last-15-turns ASCII hit-rate trend, and Top-3 context-growth tool attribution in both `fast/benchmark.mjs cache` and the live Sidecar Dashboard (with mini hit-rate bar chart).
3. **2-Strike Session Read Deduplication, Bounded Slice Cache & Structured `ctx_resume` Checkpoint**:
   - Tracks `(session, file, range, mtime, size)` in SQLite to prevent redundant unchanged re-reads while automatically invalidating on edits or compaction (`ctx_resume`), and maintains a compact `sessionCheckpoint` ledger (modified files + latest test/build status) returned by `ctx_resume` with zero extra MCP tools.
   - Cross-call `(mtimeMs, size)` LRU caches in `agy-dart_fast` for both `read_slices({ outlines })` (128 entries) and `read_slices({ slices })` (bounded <= 4 MB total / <= 256 KB per file, actively invalidated by `apply_edits`).
4. **Security Hardening & DB Maintenance**:
   - SSRF-hardened `ctx_index(url)` (`http:`/`https:` whitelist, max 5 redirects with relative `Location` resolution, per-hop DNS & IPv4/IPv6 private/loopback/link-local blocking with DNS pinning), configurable secret redaction before indexing/return (`AGY_DART_DISABLE_SECRET_REDACTION=1` to opt out), and optional sensitive-file read guard (`AGY_DART_SENSITIVE_FILE_GUARD=warn|deny`).
   - Heading-aware Markdown chunking, SHA-256 content dedup, daily TTL pruning, `ctx_purge({ scope: "stale", vacuum: true })`, and one-click **Prune & Vacuum** in the Sidecar Dashboard.

---

## Community Feedback & Improvements

This dedicated section tracks real-world friction reported by the community (preserving the original feedback), along with the exact engineering fixes and underlying design principles shipped in response.

### `[v1.3.0]` 16 KB Default Read Guard Blocking Code Review (`.patch`) & MCP-less Subagents

#### 1. Original Community Feedback

> *"Claude doesn't have this limit — it reads large files in chunks without stopping. This 16 KB limit isn't built into Antigravity either; it's a pre-read check (`agy-dart protection`) from your local config. Relaxing it or exempting the review directory fixes it — is a 16 KB single-file read/write limit seriously the default config?"*
>
> *(Original Chinese: 「Claude 没有这个限制。大文件它会分段读完，不会因此停下来。这个 16 KB 的限制也不是 Antigravity 自带的，而是你那台机器上 Antigravity 配置里加的一道读前检查（agy-dart protection），放宽它或者给评审目录开个例外就能解决，16kb 单文件读写居然是默认配置吗」)*

> *"`@xcq`: I use it as a reviewer in my workflow and hit this exact issue — git `.patch` files get rejected directly because a single patch easily exceeds 16 KB and fails under the default config, so I fell back to `AGY_DART_DISABLE_READ_HOOK=1`."*
>
> *(Original Chinese: 「@xcq: 我是让他做我工作流的 reviewer，会碰到这种情况，git 的 patch 文件直接拒绝读写，因为单个 patch 文件随便就超过 16kb 了碰到现在的默认设置就会失败，我走了 `AGY_DART_DISABLE_READ_HOOK=1`」)*

*(Note: `agy-dart` never restricts writes—only pre-read guards—but blocking `.patch` reads is enough to stall a review workflow.)*

End-to-end codebase auditing against these reports exposed **5 deeper root causes in `v1.2.2`**:
1. **Permanent hard-deny at 35% of the host's native cap**: Antigravity's native `read_file` already caps each call at `46,080 B` (45 KiB) / 800 lines with native pagination, yet `v1.2.2` inherited a 16 KB hard-deny with no 2-strike bypass (unlike `read-dedup` and `diff-read` in the same file).
2. **Valid host pagination blocked by the hook itself**: `ByteOffset` was parsed *after* the size guard, open-ended `StartLine` continuations hit `isWideRange`, and wide multi-line prose/logs exceeding 36 KB were mislabeled as `"giant single-line/minified content"`.
3. **Broken code-review fallback chain**: `agy-dart_fast` `read_slices({ outlines })` had no `.patch`/`.diff` parser, while `filterGitDiff` stripped all `' '` context lines from `git diff` and `gh pr diff` (and `filterGhCli` wiped `gh pr view` metadata whenever a PR body contained a Markdown diff fence).
4. **MCP-less subagent deadlock (same class as upstream `context-mode#1311`)**: Reviewer/research subagents without `agy-dart_context` tools stalled when hard-denied with MCP-only instructions.
5. **Cross-channel coupling**: Text extension exemptions short-circuited before `readDedup`, and `run_command` (`cat`/`curl`) shared `maxReadBytes` and `exemptExtensions`, meaning disabling the read cutoff or adding exemptions could inadvertently punch holes through shell dump protection.

#### 2. Solution Shipped (`v1.2.2` → `v1.3.0`)

| Area | Before (`v1.2.2`) | After (`v1.3.0`) |
| :--- | :--- | :--- |
| **Read Threshold Model** | Flat `16 KB / 410 lines` permanent hard `deny` | **4-Tier Risk Model + 2-Strike Soft Guard (default `host-45k`)**:<br>• Tier 0 (attachments / instructions / binaries): 0-SQLite allow<br>• Tier 1 (high-noise logs / lockfiles / minified): **`16 KB`** (`noiseMaxReadBytes`)<br>• Tier 2 (source code / docs): **`45 KiB` (`46,080 B`) / 800 lines** + 2-strike<br>• Tier 3 (`.patch` / `.diff` review): **`128 KB`** (`reviewMaxReadBytes`) direct allow, 2-strike above |
| **Pagination & Anti-Deadlock** | Blocked `ByteOffset` & open-ended `StartLine`; stalled MCP-less subagents | Pre-guard `ByteOffset` remaining-bytes check & valid continuation allow; split minified vs wide multi-line slices (computing `suggestedLines`); 5-branch session/subagent/anonymous TTL isolation + pre-1a read-cache priority (eliminates 3-strike trap); subagent 2-strike native fallback |
| **Channel Decoupling & Security** | Exemptions skipped `readDedup` & leaked into `cat`/`curl` | `read_file` size exemptions skip Section 1a only (**preserving `readDedup`/`diffRead`**); `run_command` uses independent `shellDumpMaxBytes = 16 KB` with `exemptExtensions` removed; `realpathSync` symlink checks & strict integer `parseLineArg` |
| **First-Class Code Review** | No `.patch` outliner; `git diff` stripped context | Native zero-dep `.patch`/`.diff` parser (`extractDiffSymbols`) in `read_slices({ outlines })`; **3-stage context-preserving `filterGitDiff`** inside `<= 7.9 KB` (lossless within budget → `-U`/`-W` preserved cap → 1-line context before compact `+/-`) + fixed `gh pr view` detection |
| **Trusted Config & Upgrade** | Required `AGY_DART_DISABLE_READ_HOOK=1` | `~/.agy-dart/config.json` adds `readGuardMode` (`soft`/`strict`/`off`), per-tier cutoffs, `exemptExtensions`, and linear ReDoS-proof `exemptPaths`; `cutoff:source` migrates legacy `16384` default to `46080` while preserving user-chosen cutoffs |

#### 3. Underlying Design Principles

1. **Align with the host's physical ceiling to eliminate negative-ROI blocks**: Because Antigravity's host `read_file` already caps single responses at `46,080 B` (~11.5K tokens) / 800 lines, hard-blocking `16 KB–45 KiB` files saves minimal tokens while paying an extra full-prefix LLM round trip (negative ROI). Aligning source defaults to `45 KiB` guarantees 1-turn lossless reads below the cap and intervenes only when multi-turn paging is actually unavoidable.
2. **Tier by signal-to-noise ratio and reading mode, not flat file size**: Logs, lockfiles, and minified bundles rarely benefit from sequential reading (`ctx_execute` cuts >90%, keeping `16 KB`); source code aligns to `45 KiB`; sequential code-review `.patch`/`.diff` files need linear inspection to catch logic bugs (`128 KB` direct allow + native Diff Outline above).
3. **Soft 2-strike guardrails over permanent deadlocks**: Hooks cannot assume every subagent has MCP tools. A 2-strike retry path (bounded by the host's 45 KiB ceiling) preserves Turn-1 guidance while guaranteeing zero deadlocks—backed by 5-branch TTL key isolation, TTL refresh across continuation pages, and read-cache priority so retries never loop into 3-strike chains.
4. **Strictly decouple host-capped channels from uncapped channels**: `read_file` has a 45 KiB host cap, whereas `cat`, `curl`, and `git diff` do not. Relaxing `read_file` must never relax shell dump guards (`shellDumpMaxBytes`) or bypass `cli-filter.mjs` via `skipFlags` (which would expose unbounded 5 MB diffs without secret redaction), and skipping first-read size checks must never disable `readDedup`.
5. **Preserve the security threat model**: `exemptPaths` and `exemptExtensions` are loaded exclusively from trusted user-level `~/.agy-dart/config.json` and env vars (never from untrusted repo configs), run strictly after `sensitiveFileGuard`, validate symlink targets via `fs.realpathSync`, and use linear segment matching to eliminate ReDoS.

### `[v1.2.2]` Premature Handoffs & Interrupted Long-Running Tasks

#### 1. Original Community Feedback

> *"After enabling dart (`agy-dart`), it becomes very hard to run long tasks — it automatically hands off within a very short time."*
>
> *(Original Chinese: 「使用了dart之后，就很难进行长任务了，会自动在很短的时间内交接」)*

Auditing Antigravity's executor loop alongside `v1.2.1` revealed that "premature automatic handoffs" reflected both **early turn termination yielding control back to the user** and **frequent `Handoff Brief` / `/compact` banners firing after just a few minutes**, driven by **5 concrete root causes**:
1. **Imperative phase-boundary `/compact` rule inducing self-handoffs**: `rules/AGENTS.md` instructed the agent to *"compact at cold/phase boundaries then call `ctx_resume`"*. Because `/compact` is a UI-only slash command that the model cannot invoke via tools, obedient models following `<user_rules>` stopped calling tools at the end of Phase 1 (within minutes) and handed control back to the user asking them to run `/compact`.
2. **Hardcoded `30s` MCP sandbox kill on long scripts**: While native `run_command` transitions seamlessly into asynchronous background tasks after `WaitMsBeforeAsync`, `ctx_execute` hardcoded a `30,000 ms` kill timer (`exitCode: 124`) with no timeout parameter (and `run_checks` defaulted to `60s`), killing long builds or batch scripts within 30–60s and forcing an error handoff.
3. **`PreToolUse.overwrite` friction with Terminal Sandbox & async background streams**: `cli-filter.mjs` buffered stdout/stderr until process exit (leaving `manage_task(status)` blank during background runs). Worse, under `Default`/`Auto` Terminal Sandbox presets, `~/.gemini/config/plugins/agy-dart` sits outside the workspace mount—causing rewritten commands to fail inside the sandbox, request unsandboxed execution, and pause for manual user approval.
4. **Mid-turn tool-loop & 1M-window false `Handoff Brief` alerts**: `PreInvocation` did not distinguish user idle time from long tool/subagent execution gaps (`invocationNum >= 1`), firing 5-minute TTL handoff banners mid-task; meanwhile `ttlMinContext` was clamped via `Math.min(..., 60000)` to `60k`—just 6% of a 1M-token window.
5. **Unbounded `read-dedup` burning `MAX_INVOCATIONS` budget**: In deep 50+ step tasks, re-verifying a file read dozens of steps earlier still triggered a Strike-1 `deny`, consuming extra model invocations against the host's per-turn `MAX_INVOCATIONS` ceiling.

#### 2. Solution Shipped (`v1.2.1` → `v1.2.2`)

| Area | Before (`v1.2.1`) | After (`v1.2.2`) |
| :--- | :--- | :--- |
| **Phase-Boundary Rule (`AGENTS.md`)** | Imperative prompt to compact at cold/phase boundaries | **Strictly passive rule**: never pause mid-task to ask for `/compact`; keep long tasks continuous and call `ctx_resume` only after user compaction; route `>60s` & async commands to native `run_command` |
| **MCP Sandbox Timeout** | Hardcoded `30s` kill in `ctx_execute` with no parameter | Raised default to **`120s`** (`execTimeoutMs`), exposed per-call `timeoutSec: 1..300`, and added explicit `timedOut: true` + native background `run_command` fallback guidance |
| **Sandbox & Async Stream Bypass** | Rewrote async commands (buffering live logs); lacked sandbox read grant; orphan shells on kill | Bypass `cli-filter` when `WaitMsBeforeAsync <= 2000ms` (`cliFilterAsyncBypassMs`) or `IsDaemon: true`; attach read-only `permissionOverrides` (`read_file(<PLUGIN_ROOT>)`) on sync `overwrite`; full Windows `taskkill /T /F` & POSIX `detached` process-group teardown |
| **Mid-Turn & 1M Watermark Alerts** | Fired TTL/handoff banners mid-loop and at `60k` on 1M models | Suppress idle TTL & cold-compact handoff banners during mid-turn tool loops (`invocationNum >= 1` & `diag.inToolLoop`); scale `ttlMinContext` to model `coldCompactTokens` (`60k` on 200k models, **`300k`** on 1M models) |
| **Step-Decayed Read Dedup** | Session-wide dedup regardless of trajectory depth | Track `read_step` in `file_reads` and auto-allow re-reads after `readDedupMaxSteps` (default **`40` steps**), preserving `MAX_INVOCATIONS` budget in deep tasks |

#### 3. Underlying Design Principles

1. **Never put user-only actions as imperative commands inside `<user_rules>`**: Antigravity injects `AGENTS.md` as highest-priority mandatory instructions. Because an agent cannot execute UI slash commands like `/compact`, any imperative to "compact at phase boundaries" forces compliant models to halt execution and hand off to the human. Framing compaction strictly as a post-hoc recovery hook (`ctx_resume` after user action) keeps multi-phase execution uninterrupted.
2. **Separate synchronous data filtering from asynchronous lifecycle management**: MCP `tools/call` is inherently synchronous and bounded by RPC/stream idle timeouts—ideal for `<=120s` sandbox data reduction (`ctx_execute`), whereas long builds, test suites, and daemons rely on Antigravity's native background task streaming (`manage_task`) and reactive wakeup. Routing by `WaitMsBeforeAsync <= 2000ms` and `>60s` preserves both fast inline filtering and multi-hour background durability.
3. **Least-privilege sandbox bridging (read-only code vs. isolated DB state)**: Mounting `~/.agy-dart` read-write into the Terminal Sandbox would let untrusted repo test scripts tamper with `context.db`. Granting only `read_file(<PLUGIN_ROOT>)` via `permissionOverrides` exposes immutable plugin JS so rewritten commands never trigger unsandboxed approval prompts, while `cli-filter.mjs` degrades gracefully in memory whenever SQLite writes are sandbox-restricted.
4. **Distinguish turn-entry user idle from mid-turn tool execution**: When `invocationNum >= 1` inside an active tool loop (`inToolLoop`), elapsed time since `lastPlannerAt` reflects a long tool or subagent run—not human inactivity—and the user cannot run `/compact` mid-turn anyway. Scaling `ttlMinContext` to `30%` of the active model's window (`coldCompactTokens`) keeps alerts meaningful across both 200k and 1M context models.
5. **Balance attention decay against `MAX_INVOCATIONS` step budgets**: Blocking duplicate reads within `<= 40` steps eliminates pure token waste, but 40+ steps into a complex refactor, re-reading a target file before editing prevents stale-context hallucinations without burning extra `deny`/retry turns.

---

## Credits & Open-Source Inspirations

`agy-dart` is 100% MIT-licensed with zero runtime npm dependencies (full upstream notices and compliance boundaries are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

| Project | License | What Was Reused / Inspired | What `agy-dart` Built / Improved |
| :--- | :---: | :--- | :--- |
| **[INK-Q/agy-fast](https://github.com/INK-Q/agy-fast)** | MIT | Reused 4-tool batching engine (`batch_search`, `apply_edits`, `read_slices`, `run_checks`), `SessionStart` snapshot, `<= 8.8 KB` no-spill rule, and `benchmark.mjs` | Bundled as `agy-dart_fast`, prefix-stabilized startup hook, extended `benchmark.mjs` with KV-cache bust attribution & `cache` CLI |
| **[Domush/antigravity-plugin-context-mode](https://github.com/Domush/antigravity-plugin-context-mode)** | MIT | Reused & adapted `node:sqlite` FTS5 engine, 8 `ctx_*` tools, `PreToolUse` guard, and Aux Pane Sidecar dashboard | `${PLUGIN_ROOT}` paths, isolated `~/.agy-dart/context.db`, 16 KB / 410-line cutoff, `<= 8.8 KB` cap, `SKILL.md` exemptions, heading-aware MD chunking, DB TTL/Vacuum, and live KV-cache card |
| **MIT Pattern References** (`mpecan/tokf`, `uuie/agent-cache-optimizer`, `rkolesnichenko/ccdrift`, `ooples/token-optimizer-mcp`, `tobi/qmd`, `DeusData/codebase-memory-mcp`, `tirth8205/code-review-graph`, `lennartschoch/opencode-cache-compact`) | MIT | Clean-room pattern inspiration for declarative CLI filters, prefix stability, cache-bust attribution, read dedup, MD heading chunking, `git HEAD`-cached import hubs, and compaction handoff briefs | Pure zero-dep Node.js ESM implementation integrated natively with Antigravity `PreToolUse.overwrite`, `PostToolUse`, `PreInvocation`, and Sidecar |
| **Architectural Inspiration Only** (`mksglu/context-mode`, `rtk-ai/rtk`, `opencode-dynamic-context-pruning`, `the-cybersapien/claude-cache`, `huiliyi37/Tianshu-harness`) | Non-MIT / Apache-2.0 (**zero code included**) | High-level conceptual inspiration only (Thinking in Code, transparent CLI hook rewriting, duplicate-read awareness, KV-cache TTL continuity, versioned V8 compile cache, SHA-256 dedup, prefix budget audit, Ghost efficiency feedback, SessionWarmth compact-delay) | Strictly zero source code reused; 100% clean-room MIT implementation |

---

## Dual-Engine Routing Overview

| Workload | Designated Tool | Why |
| :--- | :--- | :--- |
| Multi-query code search / glob / read-only `git` | `agy-dart_fast` → `batch_search` | Up to 20 concurrent queries via `rg`/Node, `<= 8.8 KB` inline |
| Unknown large source / `.patch` (>300 lines) | `agy-dart_fast` → `read_slices({ outlines })` + parallel `read_file` | Map symbols or diff files/hunks once, then read exact ranges with 7ms local `read_file` |
| Source files (<45 KiB) & diffs (<128 KB) | Built-in `read_file` (parallel, `<= 800` lines) | 0 remote checks (~7ms), 45 KiB host cap, 2-strike soft guard above cutoff |
| Multi-hunk / multi-file edits + verify | `agy-dart_fast` → `apply_edits` | Atomic commits, `bestEffort`, inline `verify` saves full turns |
| Concurrent build / lint / test checks | `agy-dart_fast` → `run_checks` | True concurrency pool with noise stripping (never sequential `ctx_batch`) |
| **Large logs (>16 KB – MBs), giant JSON/CSV, API dumps** | `agy-dart_context` → `ctx_execute` | Run local Node/Python/Shell filter scripts; return only concise answers (`<= 8.8 KB`) |
| **Long docs, web URLs, or repeatedly queried logs** | `agy-dart_context` → `ctx_index` + `ctx_search` | Local SQLite FTS5 BM25 + Trigram RRF; use `ctx_resume` after `/compact` |

---

## Quick Install

Requires **Node.js >= 22** (uses built-in `node:sqlite`; **no `npm install` needed**).

### Windows (PowerShell)
```powershell
git clone https://github.com/zou172866/agy-dart.git
cd agy-dart

# Install with host-aligned 45 KiB soft guard + live doctor check
.\install.ps1

# Recommended: also auto-install official ripgrep (rg.exe) to ~/.local/bin
.\install.ps1 -InstallRg
```

### macOS / Linux
```bash
git clone https://github.com/zou172866/agy-dart.git
cd agy-dart
./install.sh
```

### Cross-Platform CLI
```bash
node scripts/install.mjs install                           # default host-45k (preserves custom cutoffs on upgrade)
node scripts/install.mjs install --with-devtools             # also install offline audit/benchmark CLIs
node scripts/install.mjs install --project /path/to/repo   # workspace-scoped
node scripts/install.mjs doctor
node scripts/install.mjs mode fast-32k                     # host-45k | fast-32k | balanced-16k | strict-8k | no-read-hook
node scripts/install.mjs uninstall
```

### Let Antigravity Install It For You

Paste this prompt into Antigravity:

```text
Clone https://github.com/zou172866/agy-dart.git to a temp folder, run `node scripts/install.mjs install` (add `--install-rg` on Windows if `rg` is missing), and confirm `doctor` passes.
```

Restart Antigravity (or reload window) and start a new conversation. If you previously installed standalone `agy-fast` or `antigravity-plugin-context-mode`, disable or remove them under **Customizations → Installed** to avoid duplicate MCP servers/hooks.

---

## Testing & Benchmarking

```bash
# Run full test suite (integration, v1.1, v1.2, security hardening & property/fuzz tests)
npm test

# Verify static runtime import graph & zero devtools leakage
npm run verify:pkg

# Audit Turn-0 prefix budget, MCP schema determinism & token estimator calibration
npm run prefix:budget
node scripts/prefix-budget.mjs --calibrate

# Audit global Antigravity Prompt Cache hygiene & simulate 7 cache policies locally
npm run cache:audit -- --workspace . --no-live
npm run cache:simulate
```

## License

[MIT](LICENSE). Upstream MIT notices and compliance boundaries are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
