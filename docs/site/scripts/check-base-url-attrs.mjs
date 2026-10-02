#!/usr/bin/env node
// Fail the build when MDX content hard-codes a site-absolute URL in a raw
// HTML/JSX attribute (`href="/..."`, `src="/..."`).
//
// Docusaurus prepends `baseUrl` to markdown-syntax links (`[text](/path)`) but
// never to attributes written as raw markup, so those values ship verbatim.
// That is correct only while `baseUrl` is `/` (docs.mattermost.com), which
// makes the bug invisible there. Under the offline bundle (`BASE_URL=/documentation/`)
// the same values resolve against the server root instead: links silently
// navigate the reader out of the docs into the Mattermost webapp rather than
// 404ing, so reviewers cannot be relied on to spot a regression.
//
// The fix is always `useBaseUrl()`, which matches how images in this content
// already resolve their paths and keeps full-page-load navigation.
//
// Generated/vendored trees are skipped: a failure there is not actionable from
// a docs PR in this repo.

import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, '..', '..');

// Content roots registered as Docusaurus plugin-content-docs `path` values.
const CONTENT_ROOTS = ['main', 'develop', 'api'];

// Written by scripts/stage-agents-docs.mjs and `docusaurus gen-api-docs`.
const SKIP_DIRS = new Set([
  join(DOCS_ROOT, 'main', 'agents', 'docs'),
  join(DOCS_ROOT, 'api', 'reference'),
]);

const CONTENT_EXT = /\.mdx?$/;
const ATTR = /\b(href|src)="(\/[^"]*)"/g;
const FENCE = /^\s*(?:```|~~~)/;
const INLINE_CODE = /`[^`]*`/g;

function* walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || SKIP_DIRS.has(full)) {
        continue;
      }
      yield* walk(full);
    } else if (entry.isFile() && CONTENT_EXT.test(entry.name)) {
      yield full;
    }
  }
}

const violations = [];
let scanned = 0;

for (const root of CONTENT_ROOTS) {
  for (const file of walk(join(DOCS_ROOT, root))) {
    scanned++;
    let inFence = false;

    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((rawLine, index) => {
        if (FENCE.test(rawLine)) {
          inFence = !inFence;
          return;
        }
        if (inFence) {
          return;
        }

        // Prose may legitimately show the bad form as an example.
        const line = rawLine.replace(INLINE_CODE, '');

        for (const [, attr, url] of line.matchAll(ATTR)) {
          // `//host/path` is protocol-relative, i.e. not site-local.
          if (url.startsWith('//')) {
            continue;
          }
          violations.push({
            file: relative(DOCS_ROOT, file),
            line: index + 1,
            attr,
            url,
          });
        }
      });
  }
}

if (violations.length > 0) {
  console.error(
    `[check-base-url-attrs] ${violations.length} site-absolute URL attribute(s) ` +
      `in raw markup across ${scanned} content files.\n\n` +
      'Docusaurus does not apply baseUrl to raw HTML/JSX attributes, so these break ' +
      'the offline /documentation/ build (silently, by navigating out of the docs).\n' +
      'Wrap each value in useBaseUrl():\n',
  );

  for (const {file, line, attr, url} of violations) {
    console.error(`  ${file}:${line}`);
    console.error(`    found:    ${attr}="${url}"`);
    console.error(`    expected: ${attr}={useBaseUrl('${url}')}`);
  }

  console.error(
    "\nAdd `import useBaseUrl from '@docusaurus/useBaseUrl';` directly below the " +
      'frontmatter in any file that does not already import it.',
  );
  process.exit(1);
}

console.log(`[check-base-url-attrs] ok: ${scanned} content files, 0 violations`);
