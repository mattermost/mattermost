#!/usr/bin/env node
// Stage the mattermost-plugin-agents submodule's docs/ subfolder into
// main/agents/docs/ so the two curated Agents pages (administration-guide/
// configure/agents-admin-guide.mdx and end-user-guide/agents.mdx) and a
// handful of nested reference pages have real content to link to.
//
// Why staging instead of checking out the submodule directly under docs/:
// submodules can't do a sparse "just this subfolder" checkout, and the repo
// also has README/LICENSE/Go source/etc. we don't want as pages. So it's
// vendored out-of-tree at vendor/mattermost-plugin-agents, and this script
// copies+transforms only its docs/** into main/agents/docs/ before the
// sidebar is generated — same effect as Sphinx's conf.py exclude/redirect
// rules on its own full-repo submodule checkout.
//
// Navigation mirrors Sphinx exactly (source/end-user-guide/agents.rst,
// source/administration-guide/configure/agents-admin-guide.rst): no
// top-level Agents nav section. admin_guide.md/user_guide.md are `..
// include::`d into the two curated pages; providers/aws_bedrock_setup/
// sovereign_ai/usage_tips get their own nested pages via a small hidden
// toctree; everything else (load-testing, upgrading_to_2.0, features/*) is
// direct-URL-only, never in any toctree. Reproduced as a three-way split:
//   - INLINE_PARTIALS: staged as an unlisted doc (direct-link parity) AND
//     as a Markdown partial (leading underscore) the curated pages
//     `import` and render inline, reproducing `.. include::`.
//   - NAV_CHILDREN: normal listed docs, nested under the curated pages by
//     gen-documentation-sidebar.mjs via cross-directory {doc: ...} items.
//   - Everything else: unlisted docs — built and linkable, absent from
//     the sidebar.
//
// Re-run safely at any time (e.g. after `git submodule update --remote`) —
// it fully regenerates its output directories.
//
// Usage: node docs/site/scripts/stage-agents-docs.mjs

import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
  existsSync, rmSync, copyFileSync,
} from 'node:fs';
import {join, resolve, relative, dirname, extname, posix} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');

const VENDOR_DOCS = join(REPO_ROOT, 'vendor', 'mattermost-plugin-agents', 'docs');
const DEST_DOCS = join(REPO_ROOT, 'main', 'agents', 'docs');
const DEST_IMAGES = join(SITE_ROOT, 'static', 'images', 'agents');

// Files whose body is inlined into a curated page via a Markdown partial
// import, in addition to being staged as their own unlisted page.
const INLINE_PARTIALS = new Set(['admin_guide', 'user_guide']);

// Files that get their own listed page, nested under a curated page by
// gen-documentation-sidebar.mjs. Everything else staged ends up unlisted.
const NAV_CHILDREN = new Set(['providers', 'aws_bedrock_setup', 'sovereign_ai', 'usage_tips']);

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

// Vendored markdown cross-links sibling docs with relative paths, e.g.
// `[...](../admin_guide.md#license-requirements)` or
// `[...](features/channel_summaries.md)`. Resolve those relative to the
// linking file's own directory under docs/ and rewrite to the site's
// absolute `/agents/docs/<id>` doc convention, so links keep working
// regardless of where the linking content ends up rendered (including
// when inlined into a curated page in a completely different directory).
function rewriteRelativeMdLinks(body, fileRelDir) {
  return body.replace(/(\[[^\]]*]\()(?!https?:\/\/|\/|#)([^)\s#]+)\.md(#[^)\s]+)?(\))/g, (_m, pre, target, anchor, post) => {
    const resolved = posix.normalize(posix.join(fileRelDir, target));
    return `${pre}/agents/docs/${resolved}${anchor || ''}${post}`;
  });
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
  let partialCount = 0;
  for (const src of mdFiles) {
    const rel = relative(VENDOR_DOCS, src); // e.g. "admin_guide.md" or "features/channel_summaries.md"
    const relDir = posix.dirname(rel.replace(/\\/g, '/'));
    const baseName = basenameNoExt(rel);

    const raw = stripLeadingLicenseComment(readFileSync(src, 'utf8'));
    const {title, body} = extractTitle(raw);
    const transformed = rewriteRelativeMdLinks(rewriteImagePaths(body), relDir === '.' ? '' : relDir);

    const dest = join(DEST_DOCS, rel);
    mkdirSync(dirname(dest), {recursive: true});

    const listed = NAV_CHILDREN.has(baseName);
    const inlined = INLINE_PARTIALS.has(baseName);
    const frontmatterLines = [];
    if (title) frontmatterLines.push(`title: "${title.replace(/"/g, '\\"')}"`);
    if (!listed) frontmatterLines.push('unlisted: true');
    const frontmatter = frontmatterLines.length ? `---\n${frontmatterLines.join('\n')}\n---\n\n` : '';
    writeFileSync(dest, frontmatter + transformed);

    if (inlined) {
      // Markdown partials (leading underscore) are auto-excluded from
      // Docusaurus routing/sidebars and can be `import`ed + rendered
      // inline elsewhere — this is what reproduces Sphinx's
      // `.. include:: /agents/docs/*.md` behavior.
      const partialDest = join(dirname(dest), `_${baseName}_partial.mdx`);
      writeFileSync(partialDest, transformed);
      partialCount++;
    }
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

  return {files: mdFiles.length, partials: partialCount, images: imageCount};
}

function basenameNoExt(relPath) {
  const base = posix.basename(relPath.replace(/\\/g, '/'));
  return base.replace(/\.md$/, '');
}

const {files, partials, images} = stageDocs();
console.log(`[stage-agents-docs] staged ${files} doc(s) (${partials} with inline partials), ${images} image(s) into ${relative(REPO_ROOT, DEST_DOCS)}`);
