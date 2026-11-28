import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  collectLatestTelemetry,
  parseTranscriptTelemetry,
  resolveModelWindow
} from "../telemetry-bridge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

test("1. resolveModelWindow maps Gemini 4, Claude, GPT-5, Qwen, DeepSeek & fallback accurately", () => {
  assert.equal(resolveModelWindow("gemini-4-neon-high"), 1000000);
  assert.equal(resolveModelWindow("gemini-4-argon-high"), 1000000);
  assert.equal(resolveModelWindow("claude-sonnet-4-6"), 200000);
  assert.equal(resolveModelWindow("claude-opus-4-6-1m"), 1000000);
  assert.equal(resolveModelWindow("gpt-5.1"), 400000);
  assert.equal(resolveModelWindow("qwen3-coder"), 256000);
  assert.equal(resolveModelWindow("deepseek-chat"), 128000);
  assert.equal(resolveModelWindow("unknown-model"), 200000);
});

test("2. parseTranscriptTelemetry computes context %, cache temperature, advice & tok/s without NaN", () => {
  const sampleLines = [
    JSON.stringify({ step_index: 1, type: "USER_INPUT", created_at: "2026-11-27T10:00:00Z" }),
    JSON.stringify({
      step_index: 2,
      type: "PLANNER_RESPONSE",
      created_at: "2026-11-27T10:00:04Z",
      model: "gemini-4-neon-high",
      input_tokens: 40000,
      cache_read_tokens: 0,
      output_tokens: 200
    }),
    JSON.stringify({ step_index: 3, type: "GENERIC", created_at: "2026-11-27T10:00:08Z" }),
    JSON.stringify({
      step_index: 4,
      type: "PLANNER_RESPONSE",
      created_at: "2026-11-27T10:00:13Z",
      model: "gemini-4-neon-high",
      input_tokens: 20000,
      cache_read_tokens: 340000,
      output_tokens: 500
    })
  ].join("\n");

  // Hot cache (<60s after lastTurnAtMs)
  const hotNow = Date.parse("2026-11-27T10:00:33Z");
  const hot = parseTranscriptTelemetry(sampleLines, { nowMs: hotNow });
  assert.equal(hot.model, "gemini-4-neon-high");
  assert.equal(hot.windowTokens, 1000000);
  assert.equal(hot.currentContextTokens, 360000);
  assert.equal(hot.usedPct, 36);
  assert.equal(hot.watermark, "ok");
  assert.equal(hot.turns, 2);
  assert.equal(hot.lastOutputTokens, 500);
  assert.equal(hot.lastDurationSec, 5);
  assert.equal(hot.lastTps, 100);
  assert.ok(hot.avgTps > 50 && hot.avgTps < 100);
  assert.equal(hot.cacheTemperature, "hot");
  assert.equal(hot.compactAdvice, "delay_hot_cache");

  // Cold cache (>=300s idle and >=30% of 1M = 300k)
  const coldNow = Date.parse("2026-11-27T10:06:00Z");
  const cold = parseTranscriptTelemetry(sampleLines, { nowMs: coldNow });
  assert.equal(cold.cacheTemperature, "cold");
  assert.equal(cold.compactAdvice, "opportunistic_cold_compact");

  // Critical Claude 200K (>=80% = 160k)
  const claudeLines = [
    JSON.stringify({ step_index: 1, type: "USER_INPUT", created_at: "2026-11-27T11:00:00Z" }),
    JSON.stringify({
      step_index: 2,
      type: "PLANNER_RESPONSE",
      created_at: "2026-11-27T11:00:05Z",
      model: "claude-sonnet-4-6",
      input_tokens: 5000,
      cache_read_tokens: 165000,
      output_tokens: 250
    })
  ].join("\n");
  const claudeSnap = parseTranscriptTelemetry(claudeLines, { nowMs: Date.parse("2026-11-27T11:00:10Z") });
  assert.equal(claudeSnap.windowTokens, 200000);
  assert.equal(claudeSnap.usedPct, 85);
  assert.equal(claudeSnap.watermark, "critical");
  assert.equal(claudeSnap.compactAdvice, "critical_compact");
});

test("3. Perl agy-pt-cdp.pl --dump-telemetry matches telemetry-bridge.mjs output", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-pt-tel-parity-"));
  const convId = "11111111-2222-3333-4444-555555555555";
  const logDir = path.join(tmpDir, convId, ".system_generated", "logs");
  fs.mkdirSync(logDir, { recursive: true });

  const nowIso1 = new Date(Date.now() - 25000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const nowIso2 = new Date(Date.now() - 20000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const nowIso3 = new Date(Date.now() - 12000).toISOString().replace(/\.\d{3}Z$/, "Z");

  fs.writeFileSync(
    path.join(logDir, "transcript.jsonl"),
    [
      JSON.stringify({ step_index: 1, type: "USER_INPUT", created_at: nowIso1 }),
      JSON.stringify({
        step_index: 2,
        type: "PLANNER_RESPONSE",
        created_at: nowIso2,
        model: "gemini-4-argon-high",
        thinking: "中文测试推理内容",
        input_tokens: 3000,
        cache_read_tokens: 217000,
        output_tokens: 400
      }),
      JSON.stringify({ step_index: 3, type: "SYSTEM_MESSAGE", created_at: nowIso3 }),
      JSON.stringify({
        step_index: 4,
        type: "PLANNER_RESPONSE",
        created_at: nowIso3,
        model: "gemini-4-argon-high",
        input_tokens: 2000,
        cache_read_tokens: 228000,
        output_tokens: 999
      }),
      JSON.stringify({
        step_index: 5,
        type: "PLANNER_RESPONSE",
        created_at: new Date(Date.parse(nowIso3) + 8000).toISOString().replace(/\.\d{3}Z$/, "Z"),
        model: "gemini-4-argon-high",
        input_tokens: 2000,
        cache_read_tokens: 229000,
        output_tokens: 640
      })
    ].join("\n") + "\n",
    "utf8"
  );

  try {
    const nodeSnap = await collectLatestTelemetry({
      brainDir: tmpDir,
      dartDbPath: path.join(tmpDir, "missing.db")
    });

    const perlRes = spawnSync(
      "/usr/bin/perl",
      [
        path.join(REPO_ROOT, "macos", "agy-pt-cdp.pl"),
        "--dump-telemetry",
        "--brain-dir",
        tmpDir,
        "--dart-db",
        path.join(tmpDir, "missing.db")
      ],
      { encoding: "utf8" }
    );
    assert.equal(perlRes.status, 0, `Perl failed: ${perlRes.stderr}`);
    const perlSnap = JSON.parse(perlRes.stdout.trim());

    assert.equal(perlSnap.conversationId, nodeSnap.conversationId);
    assert.equal(perlSnap.model, nodeSnap.model);
    assert.equal(perlSnap.windowTokens, nodeSnap.windowTokens);
    assert.equal(perlSnap.currentContextTokens, nodeSnap.currentContextTokens);
    assert.equal(perlSnap.usedPct, nodeSnap.usedPct);
    assert.equal(perlSnap.watermark, nodeSnap.watermark);
    assert.equal(perlSnap.turns, nodeSnap.turns);
    assert.equal(perlSnap.lastOutputTokens, nodeSnap.lastOutputTokens);
    assert.equal(perlSnap.lastTps, nodeSnap.lastTps);
    assert.equal(perlSnap.avgTps, nodeSnap.avgTps);
    assert.equal(perlSnap.cacheTemperature, nodeSnap.cacheTemperature);
    assert.ok(Math.abs(perlSnap.weightedHitRate - nodeSnap.weightedHitRate) <= 0.001);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("4. periodic-model-picker.js syntax, config default dual halo, and HUD API / cleanup smoke check", () => {
  const pickerSrc = fs.readFileSync(path.join(REPO_ROOT, "periodic-model-picker.js"), "utf8");
  const cfg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "periodic-model-config.json"), "utf8"));

  assert.equal(cfg.composerHud?.enabled, true);
  assert.equal(cfg.composerHud?.quotaHaloMode, "dual");
  assert.doesNotThrow(() => new vm.Script(pickerSrc, { filename: "periodic-model-picker.js" }));

  // Minimal DOM mock to verify IIFE mounts public API cleanly and periodicCleanup leaves zero timers
  const listeners = new Map();
  const makeEl = (tag) => {
    const attrs = new Map();
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      children,
      childNodes: children,
      isConnected: true,
      parentElement: null,
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      removeAttribute: (k) => attrs.delete(k),
      hasAttribute: (k) => attrs.has(k),
      closest: () => null,
      matches: () => false,
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (c) => {
        c.parentElement = el;
        children.push(c);
        return c;
      },
      insertAdjacentElement: (_pos, c) => {
        children.push(c);
        return c;
      },
      attachShadow: () => ({
        innerHTML: "",
        addEventListener: () => {},
        querySelector: () => null
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      remove: () => {
        el.isConnected = false;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 100 })
    };
    return el;
  };

  const doc = {
    body: makeEl("body"),
    documentElement: makeEl("html"),
    createElement: makeEl,
    querySelectorAll: () => [],
    addEventListener: (t, fn) => listeners.set(t, fn),
    removeEventListener: (t) => listeners.delete(t)
  };
  const win = {
    location: { protocol: "file:", hostname: "" },
    document: doc,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
  };
  const timers = new Set();
  const intervals = new Set();
  const ctx = {
    window: win,
    document: doc,
    Element: class Element {},
    getComputedStyle: () => ({ position: "relative", borderTopLeftRadius: "12px", backgroundColor: "rgb(18,22,30)" }),
    requestAnimationFrame: () => 0,
    setTimeout: (fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.add(id);
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
      clearTimeout(id);
    },
    setInterval: (fn, ms) => {
      const id = setInterval(fn, ms);
      intervals.add(id);
      return id;
    },
    clearInterval: (id) => {
      intervals.delete(id);
      clearInterval(id);
    },
    console
  };
  win.window = win;
  vm.runInNewContext(pickerSrc, ctx);

  assert.equal(win.__agPeriodicPickerBuild, 341);
  const api = win.__ANTIGRAVITY_PERIODIC_API__;
  assert.equal(typeof api.getHudState, "function");
  assert.equal(typeof api.setHudPrefs, "function");
  assert.equal(typeof api.updateTelemetry, "function");
  assert.equal(api.getHudState().prefs.quotaHaloMode, "dual");

  const nextPrefs = api.setHudPrefs({ quotaHaloMode: "auto" });
  assert.equal(nextPrefs.quotaHaloMode, "auto");

  // Trigger cleanup and ensure intervals/timers cleared
  win.__agPeriodicPickerCleanupV30();
  assert.equal(intervals.size, 0, "periodicCleanup must clear all HUD intervals");
  assert.equal(timers.size, 0, "periodicCleanup must clear all pending HUD timers");
});

test("5. Composer HUD mounts inside nearest horizontal flex row to the right of modelBtn wrapper, never inside block wrapper", () => {
  const pickerSrc = fs.readFileSync(path.join(REPO_ROOT, "periodic-model-picker.js"), "utf8");
  const timers = new Set();
  const intervals = new Set();

  class MockElement {
    constructor(tag, styles = {}) {
      this.tagName = tag.toUpperCase();
      this.id = "";
      this.textContent = "";
      this.style = {};
      this._computedStyle = {
        display: "block",
        flexDirection: "row",
        justifyContent: "normal",
        visibility: "visible",
        opacity: "1",
        position: "relative",
        borderTopLeftRadius: "12px",
        borderTopWidth: "0px",
        backgroundColor: "rgb(18,22,30)",
        ...styles
      };
      this._rect = { left: 0, top: 0, width: 400, height: 100 };
      this._attrs = new Map();
      this.children = [];
      this.childNodes = this.children;
      this.parentElement = null;
      this.isConnected = true;
    }

    get previousElementSibling() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return idx > 0 ? this.parentElement.children[idx - 1] : null;
    }

    setAttribute(k, v) {
      if (k === "id") this.id = String(v);
      this._attrs.set(k, String(v));
    }

    getAttribute(k) {
      if (k === "id" && this.id) return this.id;
      return this._attrs.has(k) ? this._attrs.get(k) : null;
    }

    removeAttribute(k) {
      if (k === "id") this.id = "";
      this._attrs.delete(k);
    }

    hasAttribute(k) {
      return (k === "id" && Boolean(this.id)) || this._attrs.has(k);
    }

    closest(sel) {
      if (typeof sel === "string" && sel.includes("button") && this.tagName === "BUTTON") return this;
      return null;
    }

    matches() {
      return false;
    }

    appendChild(child) {
      if (child.parentElement) {
        const prevIdx = child.parentElement.children.indexOf(child);
        if (prevIdx >= 0) child.parentElement.children.splice(prevIdx, 1);
      }
      child.parentElement = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
      return child;
    }

    insertAdjacentElement(pos, child) {
      if (pos === "afterend" && this.parentElement) {
        if (child.parentElement) {
          const prevIdx = child.parentElement.children.indexOf(child);
          if (prevIdx >= 0) child.parentElement.children.splice(prevIdx, 1);
        }
        const idx = this.parentElement.children.indexOf(this);
        child.parentElement = this.parentElement;
        child.isConnected = this.parentElement.isConnected;
        this.parentElement.children.splice(idx + 1, 0, child);
        return child;
      }
      return this.appendChild(child);
    }

    attachShadow() {
      return {
        innerHTML: "",
        addEventListener: () => {},
        querySelector: () => null
      };
    }

    querySelector(sel) {
      if (typeof sel === "string" && sel.includes("textarea")) {
        const stack = [...this.children];
        while (stack.length) {
          const cur = stack.shift();
          if (cur.tagName === "TEXTAREA") return cur;
          stack.push(...cur.children);
        }
      }
      return null;
    }

    querySelectorAll() {
      return [];
    }

    addEventListener() {}
    removeEventListener() {}

    remove() {
      if (this.parentElement) {
        const idx = this.parentElement.children.indexOf(this);
        if (idx >= 0) this.parentElement.children.splice(idx, 1);
      }
      this.parentElement = null;
      this.isConnected = false;
    }

    getBoundingClientRect() {
      return this._rect;
    }
  }

  // Simulate Antigravity 2.0 composer DOM:
  // composerEl (flex-col, has textarea) -> footer (flex-row, space-between) ->
  // toolbarRow (flex-row, justify: normal) -> wrapper2 (block) -> wrapper1 (block) -> modelBtn
  const body = new MockElement("body");
  const html = new MockElement("html");
  const composerEl = new MockElement("div", { display: "flex", flexDirection: "column" });
  composerEl._rect = { left: 375, top: 1078, width: 766, height: 102 };
  const textarea = new MockElement("textarea");
  const footer = new MockElement("div", { display: "flex", flexDirection: "row", justifyContent: "space-between" });
  const toolbarRow = new MockElement("div", { display: "flex", flexDirection: "row", justifyContent: "normal" });
  const wrapper2 = new MockElement("div", { display: "block" });
  const wrapper1 = new MockElement("div", { display: "block" });
  const modelBtn = new MockElement("button", { display: "flex", flexDirection: "row" });
  modelBtn._rect = { left: 409, top: 1124, width: 249, height: 28 };
  modelBtn.setAttribute("aria-label", "Select model, current: Gemini 4 Neon High");
  modelBtn.textContent = "Gemini 4 Neon High";

  body.appendChild(composerEl);
  composerEl.appendChild(textarea);
  composerEl.appendChild(footer);
  footer.appendChild(toolbarRow);
  toolbarRow.appendChild(wrapper2);
  wrapper2.appendChild(wrapper1);
  wrapper1.appendChild(modelBtn);

  const findById = (root, id) => {
    if (root.id === id) return root;
    for (const c of root.children) {
      const hit = findById(c, id);
      if (hit) return hit;
    }
    return null;
  };

  const doc = {
    body,
    documentElement: html,
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => findById(body, id),
    querySelectorAll: (sel) => (typeof sel === "string" && sel.includes("button") ? [modelBtn] : []),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const win = {
    location: { protocol: "file:", hostname: "" },
    document: doc,
    innerWidth: 1440,
    innerHeight: 1200,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
  };
  win.window = win;

  const ctx = {
    window: win,
    document: doc,
    Element: MockElement,
    getComputedStyle: (el) => el._computedStyle || {},
    requestAnimationFrame: () => 0,
    setTimeout: (fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.add(id);
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
      clearTimeout(id);
    },
    setInterval: (fn, ms) => {
      const id = setInterval(fn, ms);
      intervals.add(id);
      return id;
    },
    clearInterval: (id) => {
      intervals.delete(id);
      clearInterval(id);
    },
    console
  };

  vm.runInNewContext(pickerSrc, ctx);
  const api = win.__ANTIGRAVITY_PERIODIC_API__;
  api.updateTelemetry({
    turns: 1,
    currentContextTokens: 50000,
    windowTokens: 1000000,
    usedPct: 5,
    watermark: "ok",
    lastTps: 60,
    lastTurnAtMs: Date.now()
  });

  const hudEl = doc.getElementById("ag-pt-composer-hud");
  assert.ok(hudEl, "HUD host element should be mounted");
  assert.equal(hudEl.parentElement, toolbarRow, "HUD must mount inside horizontal flex row, not block wrapper or space-between footer");
  assert.equal(hudEl.previousElementSibling, wrapper2, "HUD must sit directly after wrapper2 inside toolbarRow");
  assert.equal(wrapper1.children.includes(hudEl), false, "HUD must not mount inside block wrapper1");
  assert.equal(wrapper2.children.includes(hudEl), false, "HUD must not mount inside block wrapper2");

  win.__agPeriodicPickerCleanupV30();
  assert.equal(doc.getElementById("ag-pt-composer-hud"), null, "cleanup must remove HUD element");
  assert.equal(intervals.size, 0, "cleanup must clear all intervals");
  assert.equal(timers.size, 0, "cleanup must clear all timers");
});
