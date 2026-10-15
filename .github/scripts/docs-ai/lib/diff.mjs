/*
 * Diffs for persona review.
 *
 * additionsDiff marks every line as new. unifiedDiff compares an authored page
 * with the on-disk original so pre-open review sees only the introduced change.
 * A missing original is a new file and uses additionsDiff.
 */

/** Trailing newline is not an extra empty line. */
export function toLines(content) {
  const text = String(content ?? '');
  if (text === '') return [];
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  return body.split('\n');
}

export function additionsDiff(files) {
  const chunks = [];
  for (const {path, content} of files) {
    const lines = toLines(content);
    const n = lines.length;
    chunks.push(
      `diff --git a/${path} b/${path}`,
      `new file mode 100644`,
      `--- /dev/null`,
      `+++ b/${path}`,
      n === 0 ? `@@ -0,0 +0,0 @@` : `@@ -0,0 +1,${n} @@`,
      ...lines.map((l) => `+${l}`),
    );
  }
  return chunks.join('\n') + (chunks.length ? '\n' : '');
}

const MAX_LCS_CELLS = 16_000_000;

/** LCS edit script for two line arrays. `type` is ' ', '-', or '+'. */
function lcsDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({length: n + 1}, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i];
    const next = dp[i + 1];
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({type: ' ', line: a[i]});
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({type: '-', line: a[i]});
      i += 1;
    } else {
      ops.push({type: '+', line: b[j]});
      j += 1;
    }
  }
  while (i < n) ops.push({type: '-', line: a[i++]});
  while (j < m) ops.push({type: '+', line: b[j++]});
  return ops;
}

/**
 * Edit script against the existing page. Shared prefix and suffix stay as
 * context so a long page is not compared in full. A changed middle that is
 * still too large to align is emitted as a straight replace.
 */
export function lineDiff(before, after) {
  const a = toLines(before);
  const b = toLines(after);
  let start = 0;
  const maxStart = Math.min(a.length, b.length);
  while (start < maxStart && a[start] === b[start]) start += 1;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const prefix = a.slice(0, start).map((line) => ({type: ' ', line}));
  const suffix = a.slice(endA).map((line) => ({type: ' ', line}));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const mid = midA.length * midB.length > MAX_LCS_CELLS
    ? [
        ...midA.map((line) => ({type: '-', line})),
        ...midB.map((line) => ({type: '+', line})),
      ]
    : lcsDiff(midA, midB);
  return [...prefix, ...mid, ...suffix];
}

function formatHunks(ops, context = 3) {
  const changeIdx = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].type !== ' ') changeIdx.push(i);
  }
  if (changeIdx.length === 0) return '';

  const ranges = [];
  let start = changeIdx[0];
  let end = changeIdx[0];
  for (const idx of changeIdx.slice(1)) {
    if (idx <= end + context * 2 + 1) {
      end = idx;
    } else {
      ranges.push([start, end]);
      start = idx;
      end = idx;
    }
  }
  ranges.push([start, end]);

  const oldAt = [];
  const newAt = [];
  let oldLine = 1;
  let newLine = 1;
  for (let i = 0; i < ops.length; i++) {
    oldAt[i] = oldLine;
    newAt[i] = newLine;
    if (ops[i].type !== '+') oldLine += 1;
    if (ops[i].type !== '-') newLine += 1;
  }

  const parts = [];
  for (const [changeStart, changeEnd] of ranges) {
    const from = Math.max(0, changeStart - context);
    const to = Math.min(ops.length - 1, changeEnd + context);
    const slice = ops.slice(from, to + 1);
    let oldCount = 0;
    let newCount = 0;
    for (const op of slice) {
      if (op.type !== '+') oldCount += 1;
      if (op.type !== '-') newCount += 1;
    }
    let oldStart = oldAt[from];
    let newStart = newAt[from];
    if (oldCount === 0) oldStart = Math.max(0, oldStart - 1);
    if (newCount === 0) newStart = Math.max(0, newStart - 1);
    const body = slice.map((op) => `${op.type}${op.line}`).join('\n');
    parts.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${body}`);
  }
  return parts.join('\n');
}

/**
 * Unified diff of authored pages against on-disk originals.
 * Unchanged files are omitted. Missing originals are new files.
 */
export function unifiedDiff(files, originals = []) {
  const byPath = new Map((originals || []).map((o) => [o.path, o.content ?? '']));
  const chunks = [];
  for (const file of files || []) {
    if (!byPath.has(file.path)) {
      const added = additionsDiff([file]);
      chunks.push(added.endsWith('\n') ? added.slice(0, -1) : added);
      continue;
    }
    const hunks = formatHunks(lineDiff(byPath.get(file.path), file.content));
    if (!hunks) continue;
    chunks.push(
      [
        `diff --git a/${file.path} b/${file.path}`,
        `--- a/${file.path}`,
        `+++ b/${file.path}`,
        hunks,
      ].join('\n'),
    );
  }
  if (chunks.length === 0) return '';
  return `${chunks.join('\n')}\n`;
}
