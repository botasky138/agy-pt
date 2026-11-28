#!/usr/bin/env node
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { enableVersionedCompileCache } from "../hooks/compile-cache.mjs";

try {
  enableVersionedCompileCache();
} catch {}

const [{ stableSortObject }, { ContextModeStore }, { createTools }, handoffMod] = await Promise.all([
  import("./lib/stable-json.js"),
  import("./lib/store.js"),
  import("./lib/tools.js"),
  import("./lib/handoff.js").catch(() => ({}))
]);
const inferWorkspaceFromStore =
  typeof handoffMod?.inferWorkspaceFromStore === "function" ? handoffMod.inferWorkspaceFromStore : null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const IS_INSTALLED_PLUGIN_COPY = !fs.existsSync(path.join(PLUGIN_ROOT, ".git"));
let pkgVersion = "1.3.0";
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "package.json"), "utf8"));
  if (pkg.version) pkgVersion = pkg.version;
} catch {}

const RESERVED_SESSION_SENTINELS = new Set(["all", "lifetime", "app"]);

function resolveDirectoryCandidate(raw) {
  if (typeof raw !== "string") return null;
  let candidate = raw.trim();
  if (!candidate) return null;
  if (/^file:\/\//i.test(candidate)) {
    try {
      candidate = fileURLToPath(candidate);
    } catch {
      return null;
    }
  }
  try {
    const abs = path.resolve(candidate);
    if (fs.statSync(abs).isDirectory()) return abs;
  } catch {}
  return null;
}

const store = new ContextModeStore();
let currentCwd =
  resolveDirectoryCandidate(process.env.ANTIGRAVITY_WORKSPACE_ROOT) ||
  resolveDirectoryCandidate(process.env.VSCODE_CWD) ||
  process.cwd();
let explicitWorkspaceConfigured = Boolean(
  resolveDirectoryCandidate(process.env.ANTIGRAVITY_WORKSPACE_ROOT) ||
    resolveDirectoryCandidate(process.env.VSCODE_CWD)
);
let initSessionId = null;
const callContext = new AsyncLocalStorage();

function normalizeCallSessionId(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 128) return null;
  if (/[\x00-\x1f\x7f\\/]/.test(trimmed)) return null;
  if (RESERVED_SESSION_SENTINELS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function resolveSessionIdForCall() {
  return (
    callContext.getStore()?.sessionId ||
    initSessionId ||
    normalizeCallSessionId(process.env.ANTIGRAVITY_ROOT_CONVERSATION_ID) ||
    normalizeCallSessionId(process.env.ANTIGRAVITY_PARENT_CONVERSATION_ID) ||
    normalizeCallSessionId(process.env.ANTIGRAVITY_CONVERSATION_ID) ||
    normalizeCallSessionId(process.env.CONVERSATION_ID) ||
    "default"
  );
}

function resolveActiveWorkspaceCwd() {
  if (explicitWorkspaceConfigured) return currentCwd;
  const sameAsPlugin =
    process.platform === "win32"
      ? path.resolve(currentCwd).toLowerCase() === PLUGIN_ROOT.toLowerCase()
      : path.resolve(currentCwd) === PLUGIN_ROOT;
  if (sameAsPlugin && IS_INSTALLED_PLUGIN_COPY && inferWorkspaceFromStore) {
    const inferred = inferWorkspaceFromStore(store, resolveSessionIdForCall());
    if (inferred) return inferred;
  }
  return currentCwd;
}

const tools = createTools({
  store,
  getCwd: resolveActiveWorkspaceCwd,
  getSessionId: resolveSessionIdForCall,
  getDirectConversationId: () =>
    callContext.getStore()?.directConversationId ||
    callContext.getStore()?.sessionId ||
    initSessionId ||
    normalizeCallSessionId(process.env.ANTIGRAVITY_CONVERSATION_ID) ||
    normalizeCallSessionId(process.env.CONVERSATION_ID) ||
    "default"
});

// Deterministic, compact Turn-0 tool schemas (keeps server KV-cache prefix lean and stable)
const RAW_TOOL_DEFINITIONS = [
  {
    name: "ctx_batch",
    description: "Run sequential shell commands, index output into FTS5, and return matching snippets (<=8.8 KB).",
    inputSchema: {
      type: "object",
      properties: {
        commands: { type: "array", items: { type: "string" } },
        cwd: { type: "string" },
        queries: { type: "array", items: { type: "string" } }
      },
      required: ["commands"]
    }
  },
  {
    name: "ctx_doctor",
    description: "Check SQLite WAL/FTS5 health, DB size, feature toggles, and runtimes.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" }
      }
    }
  },
  {
    name: "ctx_execute",
    description: "Run JS/Python/Shell/PowerShell in sandbox to filter >16 KB logs or giant JSON/CSV/API data (<=8.8 KB inline + FTS5 index).",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["javascript", "nodejs", "python", "shell", "powershell", "cmd"] },
        code: { type: "string" },
        file: { type: "string" },
        args: { type: "array", items: { type: "string" } },
        cwd: { type: "string" },
        intent: { type: "string" },
        timeoutSec: { type: "integer", minimum: 1, maximum: 300 }
      }
    }
  },
  {
    name: "ctx_index",
    description: "Index local file, URL, or raw text into SQLite FTS5 (heading-aware for Markdown).",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" },
        path: { type: "string" },
        url: { type: "string" },
        content: { type: "string" },
        label: { type: "string" }
      }
    }
  },
  {
    name: "ctx_purge",
    description: "Purge indexed sources/events for session, worktree, all, or stale TTL entries (optional VACUUM).",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" },
        scope: { type: "string", enum: ["session", "worktree", "all", "stale"] },
        sessionId: { type: "string" },
        olderThanDays: { type: "integer" },
        vacuum: { type: "boolean" }
      }
    }
  },
  {
    name: "ctx_resume",
    description: "Recover indexed sources/events and PostToolUse checkpoint after /compact.",
    inputSchema: {
      type: "object",
      properties: {
        seq: { type: "integer" },
        sessionId: { type: "string" }
      }
    }
  },
  {
    name: "ctx_search",
    description: "Search SQLite FTS5 sources via Porter BM25 + Trigram RRF.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" },
        queries: { type: "array", items: { type: "string" } },
        sourceId: { type: "string" },
        scope: { type: "string", enum: ["session", "worktree", "all"] },
        limit: { type: "integer" },
        offset: { type: "integer" }
      },
      required: ["queries"]
    }
  },
  {
    name: "ctx_stats",
    description: "Show context savings report (sandbox, CLI filter, read dedup, interceptions).",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean" },
        sessionId: { type: "string" }
      }
    }
  }
];

export const TOOL_DEFINITIONS = Object.freeze(
  RAW_TOOL_DEFINITIONS
    .map((def) => stableSortObject(def))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
);

function sendJsonRpc(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendResponse(id, result) {
  sendJsonRpc({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  sendJsonRpc({
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) }
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let inFlightCalls = 0;
let stdinClosed = false;

function maybeCloseStoreOnDrain() {
  if (stdinClosed && inFlightCalls === 0) {
    try {
      store.close();
    } catch {}
  }
}

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch (err) {
    sendError(null, -32700, "Parse error", String(err));
    return;
  }

  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    sendError(null, -32600, "Invalid Request", "JSON-RPC message must be a JSON object");
    return;
  }

  const { id, method, params } = msg;
  if (id === undefined || id === null) return;

  inFlightCalls += 1;
  try {
    switch (method) {
      case "initialize": {
        const wsFolder = Array.isArray(params?.workspaceFolders) ? params.workspaceFolders[0]?.uri : null;
        const initDir =
          resolveDirectoryCandidate(wsFolder) ||
          resolveDirectoryCandidate(params?.rootUri) ||
          resolveDirectoryCandidate(params?.rootPath);
        if (initDir) {
          currentCwd = initDir;
          explicitWorkspaceConfigured = true;
        }
        const initSid = normalizeCallSessionId(params?.sessionId);
        if (initSid) initSessionId = initSid;
        sendResponse(id, {
          protocolVersion: params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "agy-dart-context",
            version: pkgVersion
          }
        });
        break;
      }

      case "ping": {
        sendResponse(id, {});
        break;
      }

      case "tools/list": {
        sendResponse(id, { tools: TOOL_DEFINITIONS });
        break;
      }

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        // Strictly per-call session isolation via AsyncLocalStorage: never mutate process-global
        // session state across concurrent conversations sharing one long-lived MCP stdio server.
        const callSessionId =
          [
            toolArgs.sessionId,
            toolArgs.conversationId,
            params?._meta?.rootConversationId,
            params?._meta?.conversationId,
            params?._meta?.sessionId,
            params?.sessionId
          ]
            .map(normalizeCallSessionId)
            .find(Boolean) ?? null;
        const callDirectConvId =
          [
            toolArgs.conversationId,
            toolArgs.sessionId,
            params?._meta?.conversationId,
            params?._meta?.sessionId,
            params?.sessionId
          ]
            .map(normalizeCallSessionId)
            .find(Boolean) ?? null;

        if (typeof toolName !== "string" || !Object.hasOwn(tools, toolName)) {
          sendError(id, -32601, `Unknown tool: ${toolName}`);
          break;
        }

        try {
          const result = await callContext.run(
            { sessionId: callSessionId, directConversationId: callDirectConvId },
            () => tools[toolName](toolArgs)
          );
          sendResponse(id, {
            content: [
              {
                type: "text",
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
              }
            ],
            isError: false
          });
        } catch (toolErr) {
          sendResponse(id, {
            content: [
              {
                type: "text",
                text: `Tool error (${toolName}): ${toolErr.message || String(toolErr)}`
              }
            ],
            isError: true
          });
        }
        break;
      }

      default: {
        sendError(id, -32601, `Method not found: ${method}`);
        break;
      }
    }
  } catch (handlerErr) {
    sendError(id, -32603, "Internal server error", String(handlerErr));
  } finally {
    inFlightCalls = Math.max(0, inFlightCalls - 1);
    maybeCloseStoreOnDrain();
  }
});

rl.on("close", () => {
  stdinClosed = true;
  maybeCloseStoreOnDrain();
});

process.on("SIGINT", () => {
  store.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  store.close();
  process.exit(0);
});
