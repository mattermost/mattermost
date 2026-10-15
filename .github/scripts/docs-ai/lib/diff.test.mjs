import {test} from 'node:test';
import assert from 'node:assert/strict';
import {additionsDiff, unifiedDiff} from './diff.mjs';

function hunkHeader(diff) {
  const m = diff.match(/@@ -0,0 \+(\d+)(?:,(\d+))? @@/);
  if (!m) return null;
  // +0,0 → count 0; +1,N → count N; +N alone is not used here.
  if (m[2] !== undefined) return Number(m[2]);
  return Number(m[1]);
}

test('additionsDiff normalises a file with no trailing newline', () => {
  const diff = additionsDiff([{path: 'docs/main/a.mdx', content: 'line1\nline2'}]);
  assert.ok(diff.endsWith('\n'));
  assert.equal(hunkHeader(diff), 2);
  assert.match(diff, /\+line1\n\+line2\n/);
  assert.doesNotMatch(diff, /\+line2\n\+\n/);
});

test('additionsDiff drops the phantom empty line after a trailing newline', () => {
  const diff = additionsDiff([{path: 'docs/main/a.mdx', content: 'line1\nline2\n'}]);
  assert.equal(hunkHeader(diff), 2);
  assert.match(diff, /\+line1\n\+line2\n$/);
});

test('additionsDiff handles empty content without crashing', () => {
  const diff = additionsDiff([{path: 'docs/main/empty.mdx', content: ''}]);
  assert.match(diff, /diff --git a\/docs\/main\/empty\.mdx/);
  assert.match(diff, /new file mode 100644/);
  assert.match(diff, /@@ -0,0 \+0,0 @@/);
  assert.equal(hunkHeader(diff), 0);
  // No content lines after the hunk header (+++ file header still uses +).
  assert.equal((diff.split(/@@[^\n]*\n/)[1] ?? '').trim(), '');
  assert.ok(diff.endsWith('\n'));
});

test('additionsDiff joins multiple files as separate chunks', () => {
  const diff = additionsDiff([
    {path: 'docs/main/a.mdx', content: 'A\n'},
    {path: 'docs/main/b.mdx', content: 'B\n'},
  ]);
  const a = diff.indexOf('+++ b/docs/main/a.mdx');
  const b = diff.indexOf('+++ b/docs/main/b.mdx');
  assert.ok(a !== -1 && b !== -1 && a < b);
  assert.match(diff, /\+A\n/);
  assert.match(diff, /\+B\n/);
});

test('additionsDiff returns empty string for no files', () => {
  assert.equal(additionsDiff([]), '');
});

test('unifiedDiff shows an insertion and leaves distant lines out of the hunk', () => {
  const path = 'docs/main/administration-guide/manage/command-line-tools.mdx';
  const before = ['## Compliance export', '', 'Existing export text.', '', '## Server operations', ''].join('\n');
  const after = [
    '## Compliance export',
    '',
    'Existing export text.',
    '',
    '## Read the bundled documentation',
    '',
    'Open /_documentation/ on a running server.',
    '',
    '## Server operations',
    '',
  ].join('\n');
  const diff = unifiedDiff([{path, content: after}], [{path, content: before}]);
  assert.match(diff, /^\+\+\+ b\/docs\/main/m);
  assert.doesNotMatch(diff, /\/dev\/null/);
  assert.match(diff, /\+## Read the bundled documentation/);
  assert.match(diff, /\+Open \/_documentation\/ on a running server\./);
  assert.doesNotMatch(diff, /\+## Compliance export/);
  assert.doesNotMatch(diff, /-## Compliance export/);
});

test('unifiedDiff still reports a real edit away from the insertion', () => {
  const path = 'docs/main/a.mdx';
  const before = ['## Compliance Export', '', 'Body.', '', '## Tail', ''].join('\n');
  const after = ['## Compliance export', '', 'Body.', '', '## Tail', '', 'Added.', ''].join('\n');
  const diff = unifiedDiff([{path, content: after}], [{path, content: before}]);
  assert.match(diff, /-## Compliance Export/);
  assert.match(diff, /\+## Compliance export/);
  assert.match(diff, /\+Added\./);
});

test('unifiedDiff treats a missing original as a new file', () => {
  const file = {path: 'docs/main/new.mdx', content: 'Hello\n'};
  const diff = unifiedDiff([file], []);
  assert.equal(diff, additionsDiff([file]));
});

test('unifiedDiff omits a file that did not change', () => {
  const path = 'docs/main/a.mdx';
  const content = 'Same\n';
  assert.equal(unifiedDiff([{path, content}], [{path, content}]), '');
});

test('unifiedDiff on a long page reports the insertion and not the unchanged head', () => {
  const path = 'docs/main/a.mdx';
  const head = Array.from({length: 5000}, (_, i) => `line ${i}`);
  const before = [...head, 'tail'].join('\n');
  const after = [...head.slice(0, 2500), '## New', ...head.slice(2500), 'tail'].join('\n');
  const diff = unifiedDiff([{path, content: `${after}\n`}], [{path, content: before}]);
  assert.match(diff, /\+## New/);
  assert.doesNotMatch(diff, /\+line 0\b/);
  assert.doesNotMatch(diff, /\+line 4999\b/);
  assert.doesNotMatch(diff, /-line 0\b/);
});
