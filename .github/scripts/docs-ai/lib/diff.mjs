import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';

/*
 * Diffs for persona review.
 *
 * additionsDiff marks every line as new. unifiedDiff compares an authored page
 * with the on-disk original so pre-open review sees only the introduced change.
 * A missing original is a new file and uses additionsDiff.
 */

/** Trailing newline is not an extra empty line. */
function toLines(content) {
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

function gitDiff(path, before, after) {
  const dir = mkdtempSync(join(tmpdir(), 'docs-ai-diff-'));
  try {
    for (const [side, content] of [['a', before], ['b', after]]) {
      const file = join(dir, side, path);
      mkdirSync(dirname(file), {recursive: true});
      writeFileSync(file, content);
    }
    const res = spawnSync(
      'git',
      ['diff', '--no-index', '--no-prefix', '--no-color', '--no-ext-diff', '--no-textconv', `a/${path}`, `b/${path}`],
      {cwd: dir, encoding: 'utf8'},
    );
    // --no-index exits 1 when the files differ.
    if (res.error || (res.status !== 0 && res.status !== 1)) {
      throw res.error ?? new Error(`git diff failed for ${path}: ${res.stderr}`);
    }
    return res.stdout;
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

/**
 * Unified diff of authored pages against on-disk originals.
 * Unchanged files are omitted. Missing originals are new files.
 */
export function unifiedDiff(files, originals = []) {
  const byPath = new Map(originals.map((o) => [o.path, o.content ?? '']));
  return files
    .map((f) => (byPath.has(f.path) ? gitDiff(f.path, byPath.get(f.path), f.content) : additionsDiff([f])))
    .join('');
}
