#!/usr/bin/env node
// Copy every plugin-client-redirects stub from `build/<from>/index.html` to
// `build/<from>.html` so the docs CloudFront function's `<uri>.html` fallback
// branch finds it (see mattermost-iac-docs-prod → 05-cdn →
// clean-url-rewrite.js).

import {readFileSync, writeFileSync, existsSync, statSync} from 'node:fs';
import {join, resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const BUILD_DIR = join(SITE_ROOT, 'build');
const REDIRECTS_JSON = join(SITE_ROOT, 'sidebars', 'active-redirects.json');

if (!existsSync(BUILD_DIR)) {
  console.error(`[duplicate-redirect-stubs] ${BUILD_DIR} not found; run \`docusaurus build\` first.`);
  process.exit(1);
}

const {redirects} = JSON.parse(readFileSync(REDIRECTS_JSON, 'utf8'));
const BUILD_DIR_PREFIX = BUILD_DIR + sep;

let duplicated = 0;
let skippedExisting = 0;
let skippedMissingStub = 0;
let skippedHtmlSuffix = 0;
let skippedOutsideBuild = 0;

for (const {from} of redirects) {
  // CFF Phase A already 301s `.html` to the extensionless form.
  if (from.endsWith('.html')) {
    skippedHtmlSuffix++;
    continue;
  }

  const rel = from.replace(/^\/+/, '');
  const stubPath = resolve(BUILD_DIR, rel, 'index.html');
  const flatPath = resolve(BUILD_DIR, `${rel}.html`);
  if (!stubPath.startsWith(BUILD_DIR_PREFIX) || !flatPath.startsWith(BUILD_DIR_PREFIX)) {
    skippedOutsideBuild++;
    continue;
  }

  if (!existsSync(stubPath) || !statSync(stubPath).isFile()) {
    skippedMissingStub++;
    continue;
  }

  // Never shadow a real content page at the flat key.
  if (existsSync(flatPath)) {
    skippedExisting++;
    continue;
  }

  writeFileSync(flatPath, readFileSync(stubPath));
  duplicated++;
}

console.log(
  `[duplicate-redirect-stubs] duplicated=${duplicated} ` +
    `skipped-existing=${skippedExisting} ` +
    `skipped-missing-stub=${skippedMissingStub} ` +
    `skipped-html-suffix=${skippedHtmlSuffix} ` +
    `skipped-outside-build=${skippedOutsideBuild} ` +
    `total=${redirects.length}`,
);
