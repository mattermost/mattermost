import {test} from 'node:test';
import assert from 'node:assert/strict';
import {additionsDiff} from './diff.mjs';

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
