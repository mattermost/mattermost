#!/usr/bin/env node
// Fail the build when rendered <video> markup is missing baseUrl, autoplays,
// lacks an accessible name, or points at a file that is not in `build/`.
//
// Component props are opaque to `onBrokenMarkdownImages` and to
// `check-base-url-attrs.mjs` (which only walks content roots). This scanner
// inspects the HTML Docusaurus actually shipped.

import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const BUILD_DIR = join(SITE_ROOT, 'build');
const BUILD_DIR_PREFIX = BUILD_DIR + sep;
const BASE_URL = process.env.BASE_URL ?? '/';

if (!existsSync(BUILD_DIR)) {
  console.error(`[check-video-markup] ${BUILD_DIR} not found; run \`docusaurus build\` first.`);
  process.exit(1);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        continue;
      }
      yield* walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield full;
    }
  }
}

function attr(openTag, name) {
  const match = openTag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

function hasFlag(openTag, name) {
  return new RegExp(`\\s${name}(?:\\s|>|=)`, 'i').test(` ${openTag}`);
}

function labelledByText(html, id) {
  if (!id) {
    return '';
  }
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*\\sid=["']${escaped}["'][^>]*>([\\s\\S]*?)</\\1>`, 'i'),
  );
  return match ? match[2].replace(/<[^>]+>/g, '').trim() : '';
}

function fileForSrc(src) {
  const pathOnly = src.split(/[?#]/, 1)[0];
  if (!pathOnly.startsWith(BASE_URL)) {
    return null;
  }
  const rel = pathOnly.slice(BASE_URL.length).replace(/^\/+/, '');
  const candidate = resolve(BUILD_DIR, rel);
  if (!candidate.startsWith(BUILD_DIR_PREFIX) && candidate !== BUILD_DIR) {
    return null;
  }
  return candidate;
}

const VIDEO_OPEN = /<video\b[^>]*>/gi;
const violations = [];
const pagesWithVideo = new Set();
let videoCount = 0;

for (const file of walk(BUILD_DIR)) {
  const html = readFileSync(file, 'utf8');
  const loc = relative(SITE_ROOT, file);
  const opens = html.match(VIDEO_OPEN);
  if (!opens) {
    continue;
  }

  pagesWithVideo.add(loc);
  for (const openTag of opens) {
    videoCount++;

    if (hasFlag(openTag, 'autoplay')) {
      violations.push(`${loc}: <video> carries autoplay`);
    }

    const src = attr(openTag, 'src');
    if (!src) {
      violations.push(`${loc}: <video> has no src`);
    } else if (!src.startsWith(BASE_URL)) {
      violations.push(`${loc}: src="${src}" does not start with baseUrl "${BASE_URL}"`);
    } else {
      const onDisk = fileForSrc(src);
      if (!onDisk || !existsSync(onDisk) || !statSync(onDisk).isFile()) {
        violations.push(`${loc}: src="${src}" does not resolve to a file under build/`);
      }
    }

    const labelledBy = attr(openTag, 'aria-labelledby');
    const ariaLabel = (attr(openTag, 'aria-label') ?? '').trim();
    const fromId = labelledByText(html, labelledBy);
    if (!fromId && !ariaLabel) {
      violations.push(
        `${loc}: <video> has no accessible name (empty/missing aria-labelledby target and no aria-label)`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(
    `[check-video-markup] ${violations.length} violation(s) across ${pagesWithVideo.size} page(s).\n`,
  );
  violations.forEach((line, i) => {
    console.error(`  ${i + 1}. ${line}`);
  });
  process.exit(1);
}

console.log(
  `[check-video-markup] ok: ${videoCount} videos across ${pagesWithVideo.size} pages, 0 violations`,
);
