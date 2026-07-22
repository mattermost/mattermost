#!/usr/bin/env node
// Stage the mattermost-plugin-agents submodule's docs/ subfolder into
// main/agents/docs/ so gen-documentation-sidebar.mjs's `agents` TOP_LEVEL
// entry has real content to build a category from.
//
// Why a staging script instead of pointing the submodule directly at the
// path docs pages live under: git submodules can't do a sparse "just this
// subfolder" checkout at the submodule mount point itself — the submodule
// always mounts the whole mattermost-plugin-agents repo (README, LICENSE,
// CLAUDE.md, .github/, Go source, etc.), and only docs/ (+ its img/) is
// meant to become real pages. So the submodule is vendored at
// vendor/mattermost-plugin-agents (out of the doc tree), and this script
// copies+lightly-transforms only vendor/mattermost-plugin-agents/docs/**
// into main/agents/docs/ before the sidebar is generated. This mirrors the
// production Sphinx repo, which achieves the same "only docs/ becomes
// pages" effect via conf.py exclude_patterns/redirect lists on the same
// full-repo submodule checkout.
//
// Re-run safely at any time (e.g. after `git submodule update --remote`) to
// re-sync with upstream — it fully regenerates its output directories.
//
// Usage: node docs/site/scripts/stage-agents-docs.mjs

import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
  existsSync, rmSync, copyFileSync,
} from 'node:fs';
import {join, resolve, relative, dirname, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');

const VENDOR_DOCS = join(REPO_ROOT, 'vendor', 'mattermost-plugin-agents', 'docs');
const DEST_DOCS = join(REPO_ROOT, 'main', 'agents', 'docs');
const DEST_IMAGES = join(SITE_ROOT, 'static', 'images', 'agents');

function rmrf(p) {
  if (existsSync(p)) rmSync(p, {recursive: true, force: true});
}

function walk(dir, exclude = []) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (exclude.includes(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...walk(abs, exclude));
    else out.push(abs);
  }
  return out;
}

// Several vendored files lead with a raw `<!-- Copyright ... -->` HTML
// comment. Plain Markdown tolerates that, but MDX doesn't parse bare HTML
// comments the same way (it wants `{/* ... */}`), so strip it before any
// further processing rather than trying to convert it — license headers
// aren't meaningful on rendered docs pages anyway.
function stripLeadingLicenseComment(body) {
  return body.replace(/^<!--[\s\S]*?-->\r?\n\r?\n?/, '');
}

// Extract a leading `# Title` line as Docusaurus frontmatter `title`, since
// migrated pages elsewhere in main/ carry the title in frontmatter rather
// than as an in-body H1 (Docusaurus renders the frontmatter title as the
// page's H1 automatically).
function extractTitle(body) {
  const m = body.match(/^# (.+)\r?\n\r?\n?/);
  if (!m) return {title: null, body};
  return {title: m[1].trim(), body: body.slice(m[0].length)};
}

// Vendored markdown references sibling images as `img/foo.png` or
// `../img/foo.png` (relative to its own location under docs/). Those PNGs
// are copied to static/images/agents/, so rewrite refs to the site's
// standard absolute `/images/<dir>/<file>` convention.
function rewriteImagePaths(body) {
  return body.replace(/(!\[[^\]]*]\()(?:\.\.\/)?img\/([^)\s]+)(\))/g, '$1/images/agents/$2$3');
}

function stageDocs() {
  // Clear previous output unconditionally, even on failure below, so a
  // reused workspace (stale checkout, missing submodule init) never ships
  // docs left over from a prior run instead of failing loudly.
  rmrf(DEST_DOCS);
  rmrf(DEST_IMAGES);

  if (!existsSync(VENDOR_DOCS)) {
    throw new Error(
      `[stage-agents-docs] submodule content not found at ${VENDOR_DOCS}. ` +
      'Run `git submodule update --init --remote docs/vendor/mattermost-plugin-agents` first.',
    );
  }

  const mdFiles = walk(VENDOR_DOCS, ['img']).filter((f) => extname(f) === '.md');
  for (const src of mdFiles) {
    const rel = relative(VENDOR_DOCS, src);
    const dest = join(DEST_DOCS, rel);
    mkdirSync(dirname(dest), {recursive: true});

    const raw = stripLeadingLicenseComment(readFileSync(src, 'utf8'));
    const {title, body} = extractTitle(raw);
    const transformed = rewriteImagePaths(body);
    const frontmatter = title ? `---\ntitle: "${title.replace(/"/g, '\\"')}"\n---\n\n` : '';
    writeFileSync(dest, frontmatter + transformed);
  }

  const imgDir = join(VENDOR_DOCS, 'img');
  let imageCount = 0;
  if (existsSync(imgDir)) {
    mkdirSync(DEST_IMAGES, {recursive: true});
    for (const name of readdirSync(imgDir)) {
      copyFileSync(join(imgDir, name), join(DEST_IMAGES, name));
      imageCount++;
    }
  }

  return {files: mdFiles.length, images: imageCount};
}

const {files, images} = stageDocs();
console.log(`[stage-agents-docs] staged ${files} doc(s), ${images} image(s) into ${relative(REPO_ROOT, DEST_DOCS)}`);
