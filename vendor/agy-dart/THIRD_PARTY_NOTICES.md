# Third-Party Notices & Open-Source Attributions

`agy-dart` is released under the MIT License with zero runtime npm dependencies. All reused MIT upstream copyright notices and clear architectural-inspiration boundaries are documented below.

---

## 1. Directly Reused / Adapted MIT Components

### 1.1 INK-Q/agy-fast (MIT License)

- **Repository**: https://github.com/INK-Q/agy-fast
- **License**: MIT License
- **What is reused / adapted**:
  - Zero-dependency bundled ESM artifacts (`fast/mcp-server.mjs`, `fast/session-start.mjs`, `fast/benchmark.mjs`) implementing the 4 batched latency-acceleration tools (`batch_search`, `apply_edits`, `read_slices`, `run_checks`), workspace `SessionStart` snapshot generator, and offline transcript benchmark CLI (extended in `agy-dart` with KV-cache attribution metrics and `cache` subcommand).
  - Tool-routing latency hygiene principles (inline schemas, `<= 8.8 KB` UTF-8 MCP inline budget, parallel ranged `read_file` after outlining, multimodal high-context TTFT isolation).

```text
MIT License

Copyright (c) 2026 agy-fast contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 1.2 Domush/antigravity-plugin-context-mode (MIT License)

- **Repository**: https://github.com/Domush/antigravity-plugin-context-mode
- **License**: MIT License
- **What is reused / adapted**:
  - Local-first `node:sqlite` WAL + FTS5 (Porter BM25 + Trigram RRF) storage engine (`context/lib/store.js`), sandboxed code executor (`context/lib/executor.js`), MCP tools (`context/lib/tools.js`, `context/server.js`), lifecycle `PreToolUse` protection logic (`hooks/pre-tool-use.mjs`), and Aux Pane Sidecar dashboard (`sidecars/dashboard/`).
  - Adapted in `agy-dart` with: `${PLUGIN_ROOT}` MCP paths, isolated `~/.agy-dart/context.db`, 4-tier host-aligned read guard (45 KiB / 800-line default source 2-strike, 16 KB noise/minified, 128 KB `.patch`/`.diff`), `<= 8.8 KB` UTF-8 hard output cap, single-connection SQLite reuse inside hooks, automatic exemption for agent instruction files (`SKILL.md`/`AGENTS.md`/`GEMINI.md`/`CLAUDE.md`), dynamic `sidecar_sdk` resolution, heading-aware Markdown chunking, read-dedup tracking, TTL pruning + VACUUM, and live KV-cache telemetry.

```text
MIT License

Copyright (c) 2026 Phillip Webber

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. Clean-Room MIT Pattern References (Original `agy-dart` Code)

The following MIT-licensed open-source projects served as design pattern references for clean-room, zero-dependency Node.js implementations written specifically for `agy-dart`:

| Project | License | Design Pattern Referenced |
| :--- | :---: | :--- |
| **[mpecan/tokf](https://github.com/mpecan/tokf)** | MIT | Declarative CLI output filter rules (`hooks/filter-rules.mjs`, `hooks/cli-filter.mjs`) compacting git, test, build, lint, install, and docker outputs while preserving exit codes |
| **[uuie/agent-cache-optimizer](https://github.com/uuie/agent-cache-optimizer)** | MIT | Deterministic static-before-volatile prompt prefix ordering (`hooks/session-start.mjs`) and Turn-0 tool schema stability (`context/server.js`) |
| **[rkolesnichenko/ccdrift](https://github.com/rkolesnichenko/ccdrift)** | MIT | Transcript-based Prompt Cache hit/bust attribution, wasted re-prefill token accounting, and idle TTL tracking (`context/lib/cache-analyzer.js`, `fast/benchmark.mjs`, Sidecar KV-cache card) |
| **[ooples/token-optimizer-mcp](https://github.com/ooples/token-optimizer-mcp)** | MIT | Session-level unchanged file-read deduplication and edit-triggered cache invalidation (`context/lib/store.js`, `hooks/pre-tool-use.mjs`, `hooks/post-tool-use.mjs`) |
| **[tobi/qmd](https://github.com/tobi/qmd)** | MIT | Heading-aware Markdown chunking with fenced code-block awareness and section breadcrumb titles (`context/lib/store.js`) |
| **[DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)** & **[tirth8205/code-review-graph](https://github.com/tirth8205/code-review-graph)** | MIT | Lightweight import-graph hub detection cached per `git HEAD` commit SHA (`context/lib/repo-skeleton.js`) |
| **[lennartschoch/opencode-cache-compact](https://github.com/lennartschoch/opencode-cache-compact)** | MIT | Clean-room design pattern for structured, byte-bounded compaction handoff briefs (`context/lib/handoff.js`) |

---

## 3. Architectural Inspiration Only — Zero Source Code Included

`agy-dart` strictly contains **zero source code** from any non-MIT, copyleft, source-available, or non-commercial project. We acknowledge the following projects solely for high-level architectural concepts:

- **[mksglu/context-mode](https://github.com/mksglu/context-mode)** (Elastic License 2.0 / ELv2 — **no code included**): conceptual inspiration for "Thinking in Code" output sandboxing, hybrid Porter + Trigram RRF indexing, and exempting agent-owned skill/rule files.
- **[rtk-ai/rtk](https://github.com/rtk-ai/rtk)** (contains BUSL-1.1 components — **no code included**): high-level concept of transparent hook-level CLI command rewriting before tool execution.
- **[Tarquinen/opencode-dynamic-context-pruning](https://github.com/Tarquinen/opencode-dynamic-context-pruning)** (AGPL-3.0 — **no code included**): high-level concept of preventing redundant duplicate file reads within an active session.
- **[the-cybersapien/claude-cache](https://github.com/the-cybersapien/claude-cache)** (Apache-2.0 — **no code included**): conceptual inspiration for KV-cache TTL preservation and structured session-handoff continuity (`context/lib/handoff.js`).
- **[huiliyi37/Tianshu-harness](https://github.com/huiliyi37/Tianshu-harness)** (Apache-2.0 — **no code included**): clean-room conceptual inspiration for incremental caching, safety, convergence, and observability ideas: versioned V8 compile cache (`hooks/compile-cache.mjs`), SHA-256 content dedup (`context/lib/store/fts.js`, `context/lib/tools.js`), dual-signal `(mtimeMs, size)` LRU outline & bounded slice caches (`fast/mcp-server.mjs`), deterministic slimmed schemas & Turn-0 prefix-budget audit (`context/lib/stable-json.js`, `scripts/prefix-budget.mjs`), SSRF URL guard & secret redaction (`context/lib/security.js`), Ghost eviction efficiency & per-feature ROI feedback (`context/lib/store/reads.js`, `context/lib/store/settings-maintenance.js`, `hooks/pre-tool-use.mjs`), model-aware SessionWarmth watermarks & doom-loop convergence watch (`context/lib/cache/profiles.js`, `context/lib/cache-analyzer.js`, `hooks/pre-invocation.mjs`), and structured `ctx_resume` session checkpoints (`context/lib/store/checkpoints.js`, `hooks/post-tool-use.mjs`, `hooks/cli-filter.mjs`).

## 4. Original `agy-dart` v1.2 Clean-Room Modules (MIT)

The following modules were authored from scratch under the MIT License for `agy-dart` v1.2 with zero external runtime dependencies:
- `context/lib/config.js` — unified `~/.agy-dart/config.json` + `AGY_DART_*` env-override configuration loader
- `context/lib/text-diff.js` — bounded Myers line-level unified diff engine with linear fallback & UTF-8 safety
- `context/lib/json-crusher.js` — reversible JSON/JSONL schema + anomaly compactor (SmartCrusher)
- `context/lib/handoff.js` — cache-friendly compaction handoff brief generator
- `context/lib/cache-simulator.js` — offline 7-policy KV-cache replay engine
- `scripts/cache-audit.mjs` — global Antigravity Prompt Cache environment auditor
- `scripts/verify-package-graph.mjs` & `scripts/gen-review-brief.mjs` — static import-graph packaging verifier and review-brief metrics generator
