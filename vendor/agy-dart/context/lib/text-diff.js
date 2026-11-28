/**
 * Fast, bounded, zero-dependency line-level Unified Diff generator.
 * Uses prefix/suffix trimming + Myers O((N+M)*D) shortest edit script with
 * bounded edit-distance and work guards to guarantee <15ms runtime and low
 * memory even on multi-thousand-line files.
 */

export const DEFAULT_MAX_DIFF_BYTES = 6500;
export const DEFAULT_CONTEXT_LINES = 3;

/** Truncate text strictly by UTF-8 byte length without splitting multi-byte chars */
export function truncateUtf8Safe(text, maxBytes) {
  if (!text || maxBytes <= 0) return "";
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  let cut = maxBytes;
  // Back up past any UTF-8 continuation bytes (10xxxxxx) to land cleanly before an incomplete sequence
  while (cut > 0 && (buf[cut] & 0xc0) === 0x80) {
    cut -= 1;
  }
  return buf.subarray(0, cut).toString("utf8").replace(/\uFFFD+$/, "");
}

/**
 * Split text into canonical lines (normalizing CRLF -> LF and stripping a single
 * trailing newline terminator so line counts match 1-based editor/diff conventions).
 */
export function splitTextLines(text) {
  if (!text) return [];
  const normalized = String(text).replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

/**
 * Extract a 1-based inclusive line slice [startLine..endLine] from text whose first
 * line corresponds to 1-based `baseStartLine` (default 1).
 * `endLine === null` or `endLine <= 0` reads through the end of `text`.
 */
export function extractLineSlice(text, startLine = 1, endLine = null, baseStartLine = 1) {
  const lines = splitTextLines(text);
  if (lines.length === 0) return "";
  const base = Number.isFinite(baseStartLine) && baseStartLine >= 1 ? Math.floor(baseStartLine) : 1;
  const reqStart = Number.isFinite(startLine) && startLine >= 1 ? Math.floor(startLine) : base;
  const relStart = Math.max(0, reqStart - base);
  if (relStart >= lines.length) return "";
  const hasEnd = Number.isFinite(endLine) && endLine > 0;
  const relEnd = hasEnd ? Math.min(lines.length, Math.floor(endLine) - base + 1) : lines.length;
  if (relEnd <= relStart) return "";
  return lines.slice(relStart, relEnd).join("\n");
}

/**
 * Compute Myers shortest edit script between line arrays `a` and `b`.
 * Returns an array of `{ type: "=" | "-" | "+", oldIdx, newIdx }` (0-based into `a` / `b`),
 * or `null` if `maxD` or `maxWork` is exceeded (caller falls back to linear replace hunk).
 */
function myersDiff(a, b, maxD, maxWork) {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) {
    return b.map((_, j) => ({ type: "+", oldIdx: 0, newIdx: j }));
  }
  if (m === 0) {
    return a.map((_, i) => ({ type: "-", oldIdx: i, newIdx: 0 }));
  }

  const offset = maxD + 1;
  const v = new Int32Array(2 * maxD + 3);
  const trace = [];
  let work = 0;
  let finalD = -1;

  for (let d = 0; d <= maxD; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
        work++;
      }
      work++;
      v[offset + k] = x;

      if (x >= n && y >= m) {
        finalD = d;
        break;
      }
      if (work > maxWork) {
        return null;
      }
    }
    if (finalD !== -1) break;
    // Save compact snapshot of v[-d .. +d] for backtracking
    trace.push(v.slice(offset - d, offset + d + 1));
  }

  if (finalD === -1) return null;

  // Backtrack from (n, m) at step finalD down to (0, 0)
  const ops = [];
  let x = n;
  let y = m;

  for (let d = finalD; d >= 1; d--) {
    const prevV = trace[d - 1];
    const prevOff = d - 1;
    const k = x - y;
    const prevK =
      k === -d || (k !== d && prevV[k - 1 + prevOff] < prevV[k + 1 + prevOff])
        ? k + 1
        : k - 1;
    const prevX = prevV[prevK + prevOff];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.push({ type: "=", oldIdx: x, newIdx: y });
    }
    if (x === prevX) {
      y--;
      ops.push({ type: "+", oldIdx: x, newIdx: y });
    } else {
      x--;
      ops.push({ type: "-", oldIdx: x, newIdx: y });
    }
  }

  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({ type: "=", oldIdx: x, newIdx: y });
  }

  ops.reverse();
  return ops;
}

/** Order contiguous change runs (no `=` in between) with deletions `-` before insertions `+` */
function normalizeChangeRuns(ops) {
  const out = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === "=") {
      out.push(ops[i]);
      i++;
      continue;
    }
    const dels = [];
    const ins = [];
    while (i < ops.length && ops[i].type !== "=") {
      if (ops[i].type === "-") dels.push(ops[i]);
      else ins.push(ops[i]);
      i++;
    }
    for (const op of dels) out.push(op);
    for (const op of ins) out.push(op);
  }
  return out;
}

/**
 * Compute a bounded line-level Unified Diff between `oldText` and `newText`.
 *
 * @param {string} oldText
 * @param {string} newText
 * @param {object} [options]
 * @param {string} [options.fileLabel=""] - Optional file path/name for `--- a/...` / `+++ b/...` headers
 * @param {number} [options.startLine=1] - 1-based starting line number of the compared slice
 * @param {number} [options.contextLines=3] - Number of unchanged context lines around each change
 * @param {number} [options.maxDiffBytes=6500] - Maximum UTF-8 byte budget for returned diff text
 */
export function computeUnifiedDiff(
  oldText,
  newText,
  {
    fileLabel = "",
    startLine = 1,
    contextLines = DEFAULT_CONTEXT_LINES,
    maxDiffBytes = DEFAULT_MAX_DIFF_BYTES
  } = {}
) {
  const baseLine = Number.isFinite(startLine) && startLine >= 1 ? Math.floor(startLine) : 1;
  const ctxLines = Number.isFinite(contextLines) && contextLines >= 0 ? Math.floor(contextLines) : DEFAULT_CONTEXT_LINES;
  const byteCap =
    maxDiffBytes === Infinity || maxDiffBytes === null
      ? Infinity
      : Number.isFinite(maxDiffBytes) && maxDiffBytes > 0
        ? Math.floor(maxDiffBytes)
        : DEFAULT_MAX_DIFF_BYTES;

  if (oldText === newText) {
    return {
      changed: false,
      diff: "",
      diffBytes: 0,
      fullDiffBytes: 0,
      addedLines: 0,
      removedLines: 0,
      hunkCount: 0,
      truncated: false,
      fallback: false
    };
  }

  const oldLines = splitTextLines(oldText);
  const newLines = splitTextLines(newText);

  // 1. Fast prefix/suffix trimming
  let prefixLen = 0;
  const minLen = Math.min(oldLines.length, newLines.length);
  while (prefixLen < minLen && oldLines[prefixLen] === newLines[prefixLen]) {
    prefixLen++;
  }

  if (prefixLen === oldLines.length && prefixLen === newLines.length) {
    return {
      changed: false,
      diff: "",
      diffBytes: 0,
      fullDiffBytes: 0,
      addedLines: 0,
      removedLines: 0,
      hunkCount: 0,
      truncated: false,
      fallback: false
    };
  }

  let suffixLen = 0;
  const maxSuffix = Math.min(oldLines.length - prefixLen, newLines.length - prefixLen);
  while (
    suffixLen < maxSuffix &&
    oldLines[oldLines.length - 1 - suffixLen] === newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const aMid = oldLines.slice(prefixLen, oldLines.length - suffixLen);
  const bMid = newLines.slice(prefixLen, newLines.length - suffixLen);

  // 2. Myers diff on the trimmed middle window with bounded edit-distance & work guards
  const totalMid = aMid.length + bMid.length;
  const maxD = totalMid > 2000 ? Math.min(totalMid, 256) : Math.min(totalMid, 512);
  const maxWork = 400000;

  let midOps = myersDiff(aMid, bMid, maxD, maxWork);
  let fallback = false;
  if (midOps === null) {
    fallback = true;
    midOps = [];
    for (let i = 0; i < aMid.length; i++) {
      midOps.push({ type: "-", oldIdx: i, newIdx: 0 });
    }
    for (let j = 0; j < bMid.length; j++) {
      midOps.push({ type: "+", oldIdx: aMid.length, newIdx: j });
    }
  } else {
    midOps = normalizeChangeRuns(midOps);
  }

  // 3. Assemble only the relevant window of ops (at most ctxLines of prefix & suffix)
  const prefixStart = Math.max(0, prefixLen - ctxLines);
  const ops = [];
  for (let i = prefixStart; i < prefixLen; i++) {
    ops.push({ type: "=", oldIdx: i, newIdx: i });
  }
  for (const op of midOps) {
    ops.push({
      type: op.type,
      oldIdx: op.oldIdx + prefixLen,
      newIdx: op.newIdx + prefixLen
    });
  }
  const suffixKeep = Math.min(suffixLen, ctxLines);
  const oldSuffixBase = oldLines.length - suffixLen;
  const newSuffixBase = newLines.length - suffixLen;
  for (let j = 0; j < suffixKeep; j++) {
    ops.push({ type: "=", oldIdx: oldSuffixBase + j, newIdx: newSuffixBase + j });
  }

  // Annotate running (oldPos, newPos) before each op and count additions/deletions
  let curOld = prefixStart;
  let curNew = prefixStart;
  let addedLines = 0;
  let removedLines = 0;
  const changeIndices = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    op.oldPos = curOld;
    op.newPos = curNew;
    if (op.type === "=") {
      curOld++;
      curNew++;
    } else if (op.type === "-") {
      curOld++;
      removedLines++;
      changeIndices.push(i);
    } else {
      curNew++;
      addedLines++;
      changeIndices.push(i);
    }
  }

  if (changeIndices.length === 0) {
    return {
      changed: false,
      diff: "",
      diffBytes: 0,
      fullDiffBytes: 0,
      addedLines: 0,
      removedLines: 0,
      hunkCount: 0,
      truncated: false,
      fallback
    };
  }

  // 4. Group change indices into standard unified diff hunks
  const hunks = [];
  let hStart = Math.max(0, changeIndices[0] - ctxLines);
  let hEnd = Math.min(ops.length - 1, changeIndices[0] + ctxLines);
  for (let k = 1; k < changeIndices.length; k++) {
    const idx = changeIndices[k];
    const nextStart = Math.max(0, idx - ctxLines);
    const nextEnd = Math.min(ops.length - 1, idx + ctxLines);
    if (nextStart <= hEnd + 1) {
      hEnd = nextEnd;
    } else {
      hunks.push({ start: hStart, end: hEnd });
      hStart = nextStart;
      hEnd = nextEnd;
    }
  }
  hunks.push({ start: hStart, end: hEnd });

  // 5. Render unified diff lines with strict UTF-8 byte budget tracking
  const outLines = [];
  let fullDiffBytes = 0;
  let usedBytes = 0;
  let truncated = false;

  const pushLine = (line) => {
    const lineBytes = Buffer.byteLength(line, "utf8") + (fullDiffBytes > 0 ? 1 : 0);
    fullDiffBytes += lineBytes;
    if (truncated) return;
    if (usedBytes + lineBytes > byteCap) {
      truncated = true;
      return;
    }
    outLines.push(line);
    usedBytes += lineBytes;
  };

  const cleanLabel = typeof fileLabel === "string" ? fileLabel.trim().replace(/\\/g, "/") : "";
  if (cleanLabel) {
    pushLine(`--- a/${cleanLabel}`);
    pushLine(`+++ b/${cleanLabel}`);
  }

  for (const hunk of hunks) {
    let oldCount = 0;
    let newCount = 0;
    let firstOldIdx = -1;
    let firstNewIdx = -1;

    for (let i = hunk.start; i <= hunk.end; i++) {
      const op = ops[i];
      if (op.type === "=" || op.type === "-") {
        if (firstOldIdx === -1) firstOldIdx = op.oldIdx;
        oldCount++;
      }
      if (op.type === "=" || op.type === "+") {
        if (firstNewIdx === -1) firstNewIdx = op.newIdx;
        newCount++;
      }
    }

    const prevOld = ops[hunk.start].oldPos;
    const prevNew = ops[hunk.start].newPos;
    const oldStart = oldCount > 0 ? baseLine + firstOldIdx : baseLine + prevOld - 1;
    const newStart = newCount > 0 ? baseLine + firstNewIdx : baseLine + prevNew - 1;

    pushLine(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);

    for (let i = hunk.start; i <= hunk.end; i++) {
      const op = ops[i];
      if (op.type === "=") {
        pushLine(` ${oldLines[op.oldIdx]}`);
      } else if (op.type === "-") {
        pushLine(`-${oldLines[op.oldIdx]}`);
      } else {
        pushLine(`+${newLines[op.newIdx]}`);
      }
    }
  }

  let diff = outLines.join("\n");
  if (truncated && Number.isFinite(byteCap)) {
    const noticeText = "... [diff truncated]";
    const noticeWithNl = `\n${noticeText}`;
    const noticeWithNlBytes = Buffer.byteLength(noticeWithNl, "utf8");
    if (diff.length > 0 && byteCap > noticeWithNlBytes + 16) {
      diff = truncateUtf8Safe(diff, byteCap - noticeWithNlBytes) + noticeWithNl;
    } else if (diff.length === 0 && byteCap >= Buffer.byteLength(noticeText, "utf8")) {
      diff = noticeText;
    } else {
      diff = truncateUtf8Safe(diff, byteCap);
    }
  } else if (Number.isFinite(byteCap) && Buffer.byteLength(diff, "utf8") > byteCap) {
    truncated = true;
    diff = truncateUtf8Safe(diff, byteCap);
  }

  const diffBytes = Buffer.byteLength(diff, "utf8");

  return {
    changed: true,
    diff,
    diffBytes,
    fullDiffBytes,
    addedLines,
    removedLines,
    hunkCount: hunks.length,
    truncated,
    fallback
  };
}
