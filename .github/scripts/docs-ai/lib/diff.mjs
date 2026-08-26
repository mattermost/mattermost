/*
 * Diff helpers.
 *
 * Reviews always take a unified diff, so there is one prompt shape. When the
 * input is whole files rather than a change (a local dry run over specific
 * pages, or pre-open review of generated pages), synthesise an all-additions
 * diff instead of branching the prompt.
 */

import {readFileSync} from 'node:fs';
import {relative} from 'node:path';

/** Content roots the pipeline reviews. Everything else under docs/ is tooling. */
export const CONTENT_ROOTS = ['docs/main', 'docs/develop', 'docs/api'];

export function isContentPath(path) {
  return CONTENT_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
}

/** Build a unified diff presenting each file as newly added. */
export function additionsDiff(paths, {repoRoot = process.cwd()} = {}) {
  return paths
    .map((path) => {
      const rel = relative(repoRoot, path) || path;
      const lines = readFileSync(path, 'utf8').split('\n');
      const body = lines.map((l) => `+${l}`).join('\n');
      return [
        `diff --git a/${rel} b/${rel}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/${rel}`,
        `@@ -0,0 +1,${lines.length} @@`,
        body,
      ].join('\n');
    })
    .join('\n');
}

/** Files touched by a unified diff, as repo-relative paths. */
export function changedPaths(diff) {
  const paths = new Set();
  for (const m of diff.matchAll(/^\+\+\+ b\/(.+)$/gm)) {
    if (m[1] !== '/dev/null') paths.add(m[1].trim());
  }
  return [...paths];
}
