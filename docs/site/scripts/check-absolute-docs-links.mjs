#!/usr/bin/env node
// Fail when content links to an absolute https://docs.mattermost.com/... URL
// that the built site cannot serve.
//
// `onBrokenLinks` only validates site-relative links, so absolute links to this
// site ship unchecked and 404 once their target moves. This resolves each one
// against `build/` the way the docs CloudFront function does (strip `.html`,
// then try `<uri>`, `<uri>.html`, `<uri>/index.html`), so legacy URLs covered by
// a redirect stub pass. Prefer relative file links (`./page.md`), which
// Docusaurus validates and rewrites itself.
//
// Run after `docusaurus build && npm run postbuild` with BASE_URL=/.

import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const DOCS_ROOT = resolve(SITE_ROOT, '..');
const BUILD_DIR = join(SITE_ROOT, 'build');
const BUILD_DIR_PREFIX = BUILD_DIR + sep;

const CONTENT_ROOTS = ['main', 'develop', 'api'];

// Written by scripts/stage-agents-docs.mjs and `docusaurus gen-api-docs`.
const SKIP_DIRS = new Set([
  join(DOCS_ROOT, 'main', 'agents', 'docs'),
  join(DOCS_ROOT, 'api', 'reference'),
]);

const CONTENT_EXT = /\.mdx?$/;
const ABSOLUTE_LINK = /https?:\/\/docs\.mattermost\.com(\/[^\s)"'<>`\]]*)?/g;
const OPEN_FENCE = /^(\s*)(`{3,}|~{3,})/;
const INLINE_CODE = /`[^`]*`/g;

if (!existsSync(BUILD_DIR)) {
  console.error(`[check-absolute-docs-links] ${BUILD_DIR} not found; run \`docusaurus build\` first.`);
  process.exit(1);
}

function closingFence(line, char, length) {
  const match = line.match(/^(\s*)([`~]+)\s*$/);
  if (!match) {
    return false;
  }
  const marker = match[2];
  return marker[0] === char && marker.length >= length;
}

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

function isFile(path) {
  return path.startsWith(BUILD_DIR_PREFIX) && existsSync(path) && statSync(path).isFile();
}

function resolves(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  rel = rel.replace(/^\/+/, '').replace(/\.html$/, '').replace(/\/+$/, '');
  if (rel === '') {
    return true;
  }
  const base = resolve(BUILD_DIR, rel);
  return isFile(base) || isFile(`${base}.html`) || isFile(join(base, 'index.html'));
}

const violations = [];
let scanned = 0;
let absoluteLinks = 0;

for (const root of CONTENT_ROOTS) {
  for (const file of walk(join(DOCS_ROOT, root))) {
    scanned++;
    let fence = null;

    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((rawLine, index) => {
        if (fence) {
          if (closingFence(rawLine, fence.char, fence.length)) {
            fence = null;
          }
          return;
        }

        const open = rawLine.match(OPEN_FENCE);
        if (open) {
          const marker = open[2];
          fence = {char: marker[0], length: marker.length};
          return;
        }

        const line = rawLine.replace(INLINE_CODE, '');
        for (const match of line.matchAll(ABSOLUTE_LINK)) {
          absoluteLinks++;
          const url = match[0].replace(/[.,;:!?*_]+$/, '');
          const pathname = (match[1] ?? '/').split(/[?#]/, 1)[0].replace(/[.,;:!?*_]+$/, '');
          if (!resolves(pathname)) {
            violations.push({file: relative(DOCS_ROOT, file), line: index + 1, url});
          }
        }
      });
  }
}

if (violations.length > 0) {
  console.error(
    `[check-absolute-docs-links] ${violations.length} absolute docs.mattermost.com link(s) ` +
      `do not resolve against build/ (${scanned} content files scanned).\n\n` +
      'Docusaurus does not validate absolute URLs to this site. Replace each with a relative ' +
      'file link (e.g. `./page.md`, `../section/page.mdx`) so the build checks it:\n',
  );
  for (const {file, line, url} of violations) {
    console.error(`  ${file}:${line}`);
    console.error(`    ${url}`);
  }
  process.exit(1);
}

console.log(
  `[check-absolute-docs-links] ok: ${absoluteLinks} absolute link(s) across ${scanned} content files, ` +
    '0 unresolved. Prefer relative file links for new content.',
);
