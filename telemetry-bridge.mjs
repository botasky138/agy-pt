#!/usr/bin/env node
/**
 * telemetry-bridge.mjs — Cross-platform read-only telemetry parser & CDP pusher for AGY-PT.
 * Zero external npm dependencies (Node.js >= 22 built-ins only).
 *
 * Exports pure helpers (`resolveModelWindow`, `parseTranscriptTelemetry`, `collectLatestTelemetry`)
 * and can also run directly as a CLI (`--dump` or `--port <CDP_PORT>`).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAIL_READ_BYTES = 256 * 1024;
const DEFAULT_TTL_SEC = 300;

export function resolveModelProfileInfo(modelName) {
  const raw = typeof modelName === "string" ? modelName.trim() : "";
  if (raw) {
    if (/claude.*(?:^|[-_/\s[(])(?:1m|1000k)\b/i.test(raw)) {
      return { id: "claude-1m", windowTokens: 1000000, ttlSec: 300 };
    }
    if (/claude/i.test(raw)) {
      return { id: "claude-200k", windowTokens: 200000, ttlSec: 300 };
    }
    if (/gemini.*flash/i.test(raw)) {
      return { id: "gemini-flash-1m", windowTokens: 1000000, ttlSec: 300 };
    }
    if (/(?:gemini[-_/\s]?4(?:\.\d+)?\b|(?:^|[-_/\s.])(?:neon|carbon|argon|hydrogen)(?:$|[-_/\s.\d]))/i.test(raw)) {
      return { id: "gemini-4-1m", windowTokens: 1000000, ttlSec: 300 };
    }
    if (/gemini[-_/\s]?[23](?:\.\d+)?\b|gemini[-_/\s]?1\.5\b|gemini.*1m\b/i.test(raw)) {
      return { id: "gemini-1m", windowTokens: 1000000, ttlSec: 300 };
    }
    if (/gpt[-_]?4\.1\b/i.test(raw)) {
      return { id: "gpt-4.1-1m", windowTokens: 1000000, ttlSec: 300 };
    }
    if (/gpt[-_]?5(?:\.\d+)?\b/i.test(raw)) {
      return { id: "gpt-5-400k", windowTokens: 400000, ttlSec: 300 };
    }
    if (/gpt[-_]?4o\b/i.test(raw)) {
      return { id: "gpt-4o-128k", windowTokens: 128000, ttlSec: 300 };
    }
    if (/(?:^|[-_/\s])o[134](?:[-_/\s.]|$)/i.test(raw)) {
      return { id: "openai-o-200k", windowTokens: 200000, ttlSec: 300 };
    }
    if (/deepseek/i.test(raw)) {
      return { id: "deepseek-128k", windowTokens: 128000, ttlSec: 600 };
    }
    if (/qwen.*(?:coder|256k|3\b)/i.test(raw)) {
      return { id: "qwen-256k", windowTokens: 256000, ttlSec: 300 };
    }
    if (/qwen/i.test(raw)) {
      return { id: "qwen-128k", windowTokens: 128000, ttlSec: 300 };
    }
  }
  return { id: "default-200k", windowTokens: 200000, ttlSec: DEFAULT_TTL_SEC };
}

export function resolveModelWindow(modelName) {
  return resolveModelProfileInfo(modelName).windowTokens;
}

function toNonNegNum(val) {
  if (typeof val === "number") return Number.isFinite(val) && val >= 0 ? val : 0;
  if (typeof val === "string" && val.trim()) {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

function parseIsoMs(val) {
  if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
  if (typeof val !== "string" || !val.trim()) return null;
  const ms = Date.parse(val);
  return Number.isFinite(ms) ? ms : null;
}

function round1(val) {
  if (!Number.isFinite(val)) return 0;
  return Number(val.toFixed(1));
}

function round2(val) {
  if (!Number.isFinite(val)) return 0;
  return Number(val.toFixed(2));
}

export function parseTranscriptTelemetry(jsonlText, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const lines = typeof jsonlText === "string" ? jsonlText.split(/\r?\n/) : [];

  let lastModel = "";
  let currentContextTokens = 0;
  let lastTurnAtMs = null;
  let turns = 0;
  let totalInputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalOutputTokens = 0;
  let warmInputSum = 0;
  let warmCacheReadSum = 0;

  let tpsOutSum = 0;
  let tpsDurSum = 0;
  let lastOutputTokens = 0;
  let lastDurationSec = 0;
  let lastTps = 0;
  let prevStepCreatedAtMs = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line[0] !== "{") continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object") continue;

    const createdMs = parseIsoMs(obj.created_at ?? obj.timestamp ?? obj.ts);
    const isPlanner = obj.type === "PLANNER_RESPONSE";

    const inp = toNonNegNum(
      obj.input_tokens ?? obj.usage?.input_tokens ?? obj.usageMetadata?.promptTokenCount
    );
    const cacheRead = toNonNegNum(
      obj.cache_read_tokens ?? obj.usage?.cache_read_input_tokens ?? obj.usageMetadata?.cachedContentTokenCount
    );
    const cacheCreate = toNonNegNum(obj.usage?.cache_creation_input_tokens);
    const out = toNonNegNum(
      obj.output_tokens ?? obj.usage?.output_tokens ?? obj.usageMetadata?.candidatesTokenCount
    );

    const hasUsage = isPlanner && (inp > 0 || cacheRead > 0 || cacheCreate > 0 || out > 0);
    if (hasUsage) {
      turns += 1;
      if (typeof obj.model === "string" && obj.model.trim()) {
        lastModel = obj.model.trim();
      }
      const ctx = inp + cacheRead + cacheCreate;
      if (ctx > 0) {
        currentContextTokens = ctx;
      }
      totalInputTokens += inp + cacheCreate;
      totalCacheReadTokens += cacheRead;
      totalOutputTokens += out;

      if (turns > 1 || cacheRead > 0) {
        warmInputSum += inp + cacheCreate;
        warmCacheReadSum += cacheRead;
      }
      if (createdMs !== null) {
        lastTurnAtMs = createdMs;
      }

      if (out > 0 && createdMs !== null && prevStepCreatedAtMs !== null) {
        const diffSec = (createdMs - prevStepCreatedAtMs) / 1000;
        if (diffSec >= 1 && diffSec <= 600) {
          const dur = diffSec;
          tpsOutSum += out;
          tpsDurSum += dur;
          lastOutputTokens = out;
          lastDurationSec = round2(dur);
          lastTps = round1(out / dur);
        } else if (lastOutputTokens === 0) {
          lastOutputTokens = out;
        }
      } else if (out > 0 && lastOutputTokens === 0) {
        lastOutputTokens = out;
      }
    } else if (typeof obj.model === "string" && obj.model.trim() && !lastModel) {
      lastModel = obj.model.trim();
    }

    if (createdMs !== null) {
      prevStepCreatedAtMs = createdMs;
    }
  }

  const profile = resolveModelProfileInfo(lastModel);
  const windowTokens = profile.windowTokens;
  const ttlSec = profile.ttlSec || DEFAULT_TTL_SEC;
  const warnTokens = Math.round(windowTokens * 0.65);
  const criticalTokens = Math.round(windowTokens * 0.8);
  const coldCompactTokens = Math.round(windowTokens * 0.3);
  const delayHotMinTokens = Math.round(windowTokens * 0.15);

  const usedPct = windowTokens > 0 ? round1((currentContextTokens / windowTokens) * 100) : 0;
  const watermark =
    currentContextTokens >= criticalTokens
      ? "critical"
      : currentContextTokens >= warnTokens
        ? "warn"
        : "ok";

  const warmDenom = warmInputSum + warmCacheReadSum;
  const weightedHitRate = warmDenom > 0 ? Number((warmCacheReadSum / warmDenom).toFixed(4)) : 0;
  const avgTps = tpsDurSum > 0 ? round1(tpsOutSum / tpsDurSum) : lastTps;

  const idleSec = lastTurnAtMs !== null ? Math.max(0, Math.round((nowMs - lastTurnAtMs) / 1000)) : null;
  let cacheTemperature = "cold";
  if (currentContextTokens >= 4000 && idleSec !== null) {
    if (idleSec < 60) cacheTemperature = "hot";
    else if (idleSec < ttlSec) cacheTemperature = "warm";
    else cacheTemperature = "cold";
  }

  let compactAdvice = "none";
  if (currentContextTokens >= criticalTokens) {
    compactAdvice = "critical_compact";
  } else if (cacheTemperature === "cold" && currentContextTokens >= coldCompactTokens) {
    compactAdvice = "opportunistic_cold_compact";
  } else if (cacheTemperature !== "cold" && weightedHitRate >= 0.85 && currentContextTokens >= delayHotMinTokens) {
    compactAdvice = "delay_hot_cache";
  }

  return {
    model: lastModel,
    profileId: profile.id,
    windowTokens,
    currentContextTokens,
    usedPct,
    warnTokens,
    criticalTokens,
    coldCompactTokens,
    watermark,
    weightedHitRate,
    turns,
    lastOutputTokens,
    lastDurationSec,
    lastTps,
    avgTps,
    totalInputTokens,
    totalCacheReadTokens,
    totalOutputTokens,
    lastTurnAtMs,
    ttlSec,
    idleSec,
    cacheTemperature,
    compactAdvice,
    updatedAtMs: nowMs
  };
}

function readTailText(filePath, maxBytes = TAIL_READ_BYTES) {
  const st = fs.statSync(filePath);
  const size = st.size;
  if (size <= 0) return "";
  const fd = fs.openSync(filePath, "r");
  try {
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.allocUnsafe(len);
    const bytesRead = fs.readSync(fd, buf, 0, len, start);
    let txt = buf.subarray(0, bytesRead).toString("utf8");
    if (start > 0) {
      const nl = txt.indexOf("\n");
      if (nl >= 0) txt = txt.slice(nl + 1);
    }
    return txt;
  } finally {
    fs.closeSync(fd);
  }
}

function findLatestTranscriptFile(brainDir, preferredConvId = "") {
  if (!brainDir || !fs.existsSync(brainDir)) return null;
  if (preferredConvId && /^[a-zA-Z0-9_-]{8,128}$/.test(preferredConvId)) {
    const candidate = path.join(brainDir, preferredConvId, ".system_generated", "logs", "transcript.jsonl");
    try {
      const st = fs.statSync(candidate);
      if (st.isFile() && st.size > 0) {
        return { convId: preferredConvId, filePath: candidate, mtimeMs: st.mtimeMs };
      }
    } catch {}
  }

  let latest = null;
  let entries;
  try {
    entries = fs.readdirSync(brainDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const candidate = path.join(brainDir, ent.name, ".system_generated", "logs", "transcript.jsonl");
    try {
      const st = fs.statSync(candidate);
      if (!st.isFile() || st.size <= 0) continue;
      if (!latest || st.mtimeMs > latest.mtimeMs) {
        latest = { convId: ent.name, filePath: candidate, mtimeMs: st.mtimeMs };
      }
    } catch {}
  }
  return latest;
}

async function readDartStatsSafe(dartDbPath) {
  const out = { available: false, totalEvents: 0, savedBytes: 0, cliFiltered: 0, dedupHits: 0 };
  if (!dartDbPath || !fs.existsSync(dartDbPath)) return out;
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dartDbPath, { readOnly: true });
    try {
      const row = db
        .prepare(
          "SELECT COUNT(*) AS totalEvents, COALESCE(SUM(MAX(0, MAX(sandbox_bytes, bytes, returned_bytes) - returned_bytes)), 0) AS savedBytes, COALESCE(SUM(CASE WHEN kind LIKE '%cli_filter%' THEN 1 ELSE 0 END), 0) AS cliFiltered, COALESCE(SUM(CASE WHEN kind LIKE '%dedup%' OR kind LIKE '%deny%' OR kind LIKE '%guard%' THEN 1 ELSE 0 END), 0) AS dedupHits FROM events"
        )
        .get();
      out.available = true;
      out.totalEvents = Number(row?.totalEvents || 0);
      out.savedBytes = Number(row?.savedBytes || 0);
      out.cliFiltered = Number(row?.cliFiltered || 0);
      out.dedupHits = Number(row?.dedupHits || 0);
    } finally {
      db.close();
    }
  } catch {}
  return out;
}

export async function collectLatestTelemetry(options = {}) {
  const home = os.homedir();
  const brainDir = options.brainDir || path.join(home, ".gemini", "antigravity", "brain");
  const dartDbPath = options.dartDbPath || path.join(home, ".agy-dart", "context.db");
  const found = findLatestTranscriptFile(brainDir, options.preferredConvId || "");
  const dartStats = await readDartStatsSafe(dartDbPath);

  if (!found) {
    return {
      conversationId: "",
      ...parseTranscriptTelemetry("", options),
      dartStats
    };
  }

  const tail = readTailText(found.filePath);
  const parsed = parseTranscriptTelemetry(tail, options);
  return {
    conversationId: found.convId,
    ...parsed,
    dartStats
  };
}

function httpGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    const req = http.get(urlStr, { timeout: 2000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("HTTP timeout"));
    });
  });
}

function encodeWsTextFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = 0x80 | payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ mask[i % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

function pushCdpEvaluate(wsUrlStr, expression) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrlStr);
    const port = Number(u.port || 80);
    const host = u.hostname === "::1" ? "::1" : u.hostname || "127.0.0.1";
    const key = crypto.randomBytes(16).toString("base64");
    const sock = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error("CDP push timeout"));
    }, 3000);

    let handshakeDone = false;
    let buf = Buffer.alloc(0);

    sock.on("connect", () => {
      const req = [
        `GET ${u.pathname}${u.search} HTTP/1.1`,
        `Host: ${u.host}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        ""
      ].join("\r\n");
      sock.write(req);
    });

    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshakeDone) {
        const sep = buf.indexOf("\r\n\r\n");
        if (sep < 0) return;
        const hdr = buf.subarray(0, sep).toString("utf8");
        if (!/^HTTP\/1\.[01]\s+101\b/i.test(hdr)) {
          clearTimeout(timer);
          sock.destroy();
          return reject(new Error("WebSocket upgrade failed"));
        }
        handshakeDone = true;
        buf = buf.subarray(sep + 4);
        const msg = JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: false, returnByValue: false }
        });
        sock.write(encodeWsTextFrame(msg));
        setTimeout(() => {
          clearTimeout(timer);
          sock.end();
          resolve(true);
        }, 120);
      }
    });

    sock.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function isAllowedTarget(t) {
  if (!t || typeof t !== "object") return false;
  const ws = String(t.webSocketDebuggerUrl || "");
  if (!/^ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+\//i.test(ws)) return false;
  const type = String(t.type || "").toLowerCase();
  if (type !== "page" && type !== "webview" && type !== "app") return false;
  const url = String(t.url || "").toLowerCase();
  if (/^(?:devtools|chrome-extension|chrome|edge|about):/.test(url)) return false;
  return (
    url === "" ||
    /^(?:file|vscode-file|vscode-webview|app|antigravity|plugin):/.test(url) ||
    /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/.test(url)
  );
}

async function main(argv) {
  const args = argv.slice(2);
  let port = 0;
  let interval = 2;
  let once = false;
  let dump = false;
  let brainDir = "";
  let dartDbPath = "";

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dump") dump = true;
    else if (a === "--once") once = true;
    else if (a === "--port" && args[i + 1]) port = Number(args[++i]);
    else if (a === "--interval" && args[i + 1]) interval = Math.max(1, Number(args[++i]) || 2);
    else if (a === "--brain-dir" && args[i + 1]) brainDir = args[++i];
    else if (a === "--dart-db" && args[i + 1]) dartDbPath = args[++i];
  }

  if (dump) {
    const snap = await collectLatestTelemetry({ brainDir, dartDbPath });
    process.stdout.write(JSON.stringify(snap) + "\n");
    return;
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Usage: telemetry-bridge.mjs (--dump | --port <CDP_PORT>) [--interval 2] [--once]");
    process.exit(1);
  }

  let lastSig = "";
  while (true) {
    try {
      const snap = await collectLatestTelemetry({ brainDir, dartDbPath });
      const { updatedAtMs: _ignore, idleSec: _ignoreIdle, ...sigObj } = snap;
      const sig = JSON.stringify(sigObj);
      if (sig !== lastSig) {
        const expr =
          `window.__AGY_PT_TELEMETRY__ = ${JSON.stringify(snap)};` +
          `window.dispatchEvent(new CustomEvent('agy-pt-telemetry', { detail: window.__AGY_PT_TELEMETRY__ }));`;
        const targets = await httpGetJson(`http://127.0.0.1:${port}/json/list`);
        for (const t of Array.isArray(targets) ? targets : []) {
          if (!isAllowedTarget(t)) continue;
          try {
            await pushCdpEvaluate(t.webSocketDebuggerUrl, expr);
          } catch {}
        }
        lastSig = sig;
      }
    } catch {}
    if (once) break;
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

const selfPath = path.resolve(fileURLToPath(import.meta.url));
let arg1 = process.argv[1] ? path.resolve(process.argv[1]) : "";
try {
  arg1 = arg1 ? (fs.realpathSync.native || fs.realpathSync)(arg1) : "";
} catch {}
let selfReal = selfPath;
try {
  selfReal = (fs.realpathSync.native || fs.realpathSync)(selfPath);
} catch {}

if (arg1 && arg1 === selfReal) {
  main(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
