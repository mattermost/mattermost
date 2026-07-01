#!/usr/bin/env node
/*
 * Phase 5 — Main docs migration (Sphinx RST/MyST → MDX).
 *
 * Pipeline (per .rst file):
 *   1. rstPreprocess  — strip Sphinx blocks pandoc can't grok; rewrite
 *                       Sphinx inline roles (`:doc:`, `:ref:`, `:kbd:`,
 *                       `:download:`, `:sup:`, substitutions `|name|`) to
 *                       RST hyperlinks with a sentinel URL scheme
 *                       (`mm-doc:`, `mm-ref:`, `mm-kbd:`, `mm-dl:`,
 *                       `mm-sup:`, `mm-sub:`). Pandoc emits these as
 *                       markdown links which the post-process step rewrites
 *                       to MDX components or proper paths.
 *   2. pandoc         — RST → commonmark+raw_html, --wrap=none.
 *   3. postProcessMd  — replace sentinel-scheme markdown links and HTML
 *                       comment placeholders with their MDX equivalents.
 *                       Convert pandoc's <div class="note"> admonitions to
 *                       <Note>...</Note>. Apply MDX hygiene.
 *   4. emit MDX
 *
 * MyST .md files take a lighter path (no pandoc).
 *
 * Run:
 *   node docs-site/scripts/migrate-main-docs.mjs [--section product-overview]
 */

import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, cpSync} from 'node:fs';
import {dirname, join, relative, resolve, basename, extname} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SRC = join(REPO_ROOT, 'sources/mattermost-docs/source');
const DST = join(REPO_ROOT, 'docs');
const SUBS_PATH = join(REPO_ROOT, 'docs-site/scripts/migrate-main-docs/substitutions.json');
const LOG_PATH = '/tmp/migrate-main-docs.log';

const SECTIONS = [
  'product-overview',
  'use-case-guide',
  'get-help',
  'recipes',
  'samples',
  'integrations-guide',
  'security-guide',
  'end-user-guide',
  'administration-guide',
  'deployment-guide',
];

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const ONLY = argValue('--section');

const subs = JSON.parse(readFileSync(SUBS_PATH, 'utf8'));

const stats = {
  files: 0,
  rstFiles: 0,
  mdFiles: 0,
  directives: new Map(),
  substitutions: 0,
  planAvailability: 0,
  docRefs: 0,
  refRefs: 0,
  kbdRoles: 0,
  unknownRoles: new Map(),
  pandocFailures: [],
};
const logLines = [];
function logTodo(file, msg) { logLines.push(`${file}: ${msg}`); }
function tick(map, key) { map.set(key, (map.get(key) || 0) + 1); }

/* ──────────────────────────────────────────────────────────────────
 * Content image porting
 * ──────────────────────────────────────────────────────────────── */

const STATIC_IMAGES_DIR = join(REPO_ROOT, 'docs-site', 'static', 'images');
const portedImages = new Set();
function portContentImage(name) {
  if (portedImages.has(name)) return;
  portedImages.add(name);
  const srcImg = join(SRC, 'images', name);
  const dstImg = join(STATIC_IMAGES_DIR, name);
  if (!existsSync(srcImg)) { logTodo('images', `missing source image: ${name}`); return; }
  mkdirSync(dirname(dstImg), {recursive: true});
  cpSync(srcImg, dstImg);
}

/* ──────────────────────────────────────────────────────────────────
 * Frontmatter
 * ──────────────────────────────────────────────────────────────── */

function emitFrontmatter(fm) {
  const lines = ['---'];
  if (fm.title) lines.push(`title: ${JSON.stringify(fm.title)}`);
  if (fm.description) lines.push(`description: ${JSON.stringify(fm.description)}`);
  if (fm.sidebar_label) lines.push(`sidebar_label: ${JSON.stringify(fm.sidebar_label)}`);
  if (fm.sidebar_position != null) lines.push(`sidebar_position: ${fm.sidebar_position}`);
  if (fm.tags && fm.tags.length) lines.push(`tags: [${fm.tags.map((t) => JSON.stringify(t)).join(', ')}]`);
  if (fm.draft) lines.push('draft: true');
  lines.push('---', '');
  return lines.join('\n');
}

/* ──────────────────────────────────────────────────────────────────
 * Sentinel URL helpers
 *
 * RST hyperlink form: `display text <url>`__
 * Pandoc emits these as commonmark links: [display text](url).
 * We encode role data in the URL path so post-process can recover it.
 *
 * Schemes:
 *   mm-doc:/abs/path        — Sphinx :doc:
 *   mm-ref:label            — Sphinx :ref:
 *   mm-kbd:                 — Sphinx :kbd: (text in display)
 *   mm-sup:                 — Sphinx :sup:
 *   mm-sub:                 — Sphinx :sub:
 *   mm-dl:/abs/path         — Sphinx :download:
 *   mm-subst:name           — RST substitution |name|
 *
 * URLs may not contain spaces; we encode payload via encodeURIComponent.
 * Display text passes through verbatim (RST allows angle brackets only in
 * URL portion).
 * ──────────────────────────────────────────────────────────────── */

function sentinelLink(display, scheme, payload = '') {
  const encoded = encodeURIComponent(payload);
  // Escape backticks in display text so RST doesn't break the inline target.
  const safeDisplay = display.replace(/`/g, "'");
  return '`' + safeDisplay + ' <' + scheme + ':' + encoded + '>`__';
}

/* ──────────────────────────────────────────────────────────────────
 * RST PRE-PROCESS
 * ──────────────────────────────────────────────────────────────── */

// Pages with malformed raw-html tables in the source (unbalanced closing
// tags, deep nesting MDX 3 can't parse). Identified by trial — mark them
// as drafts pending a manual port.
const FORCE_DRAFT = new Set([
  'administration-guide/manage/bulk-export-tool.rst',
  'administration-guide/onboard/bulk-loading-data.rst',
  // Raw HTML blocks with multi-line nested `<li>` containing block-level
  // children — MDX 3's strict block/inline rules reject these.
  'deployment-guide/server/linux/deploy-rhel.rst',
  'deployment-guide/server/linux/deploy-tar.rst',
  'deployment-guide/server/linux/deploy-ubuntu.rst',
]);

function rstPreprocess(rstText, relPath) {
  const fm = {};
  let text = rstText;

  // Heuristic: RST grid tables (lines starting with `+--` or `+==`) frequently
  // produce pandoc HTML that MDX 3 can't parse without manual fixup. Mark
  // these pages as drafts so the build doesn't fail — they need a manual
  // port pass.
  if (/^\+[=-]{3,}/m.test(rstText)) {
    fm.draft = true;
    logTodo(relPath, `RST grid table detected — marked draft for manual port`);
  }

  // Explicit force-draft list (malformed raw HTML in source).
  const relFromSrc = relPath.replace(/^sources\/mattermost-docs\/source\//, '');
  if (FORCE_DRAFT.has(relFromSrc)) {
    fm.draft = true;
    logTodo(relPath, `force-draft (known malformed raw HTML)`);
  }

  // Drop file-top field-list flags: :orphan:, :nosearch:, :page_title:
  text = text.replace(/^:([\w-]+):\s*(.*)$/gm, (m, k, v) => {
    if (k === 'orphan' || k === 'nosearch') return '';
    if (k === 'page_title') { fm.title = (v || '').trim(); return ''; }
    return m;
  });

  // .. meta:: → frontmatter
  text = text.replace(/^\.\. meta::\s*\n((?:[ \t]+:[\w-]+:[^\n]*\n)+)/gm, (_m, opts) => {
    for (const line of opts.split('\n')) {
      const mm = line.match(/^\s+:([\w-]+):\s*(.*)$/);
      if (!mm) continue;
      const [, k, v] = mm;
      if (k === 'description') fm.description = v.trim();
      if (k === 'page_title') fm.title = v.trim();
      if (k === 'keywords') fm.tags = v.split(',').map((s) => s.trim()).filter(Boolean);
    }
    tick(stats.directives, 'meta');
    return '';
  });

  // .. toctree:: — drop entirely (sidebar handles nav)
  text = text.replace(/^\.\. toctree::\s*\n(?:[ \t]+.*\n|\s*\n)*/gm, () => {
    tick(stats.directives, 'toctree');
    return '\n';
  });

  // .. include:: <path-ending-in>/_static/badges/<slug>.(rst|md) → PlanAvailability
  // Consume any indented option lines (:start-after:, :end-before:, etc.)
  // that follow the directive.
  text = text.replace(
    /^\.\. include::\s*(?:[./]*)?_static\/badges\/([\w-]+)\.(rst|md)\s*\n((?:[ \t]+:[\w-]+:[^\n]*\n)*)/gm,
    (_m, slug) => {
      stats.planAvailability++;
      tick(stats.directives, 'include:badge');
      return `\n.. raw:: html\n\n   <PlanAvailability slug="${slug}" />\n`;
    },
  );

  // .. include:: <other> → JSX-comment marker resolved later to an MDX import.
  // Same option-line eating as above.
  text = text.replace(
    /^\.\. include::\s*(\S+)\s*\n((?:[ \t]+:[\w-]+:[^\n]*\n)*)/gm,
    (_m, p) => {
      tick(stats.directives, 'include:other');
      return `\n.. raw:: html\n\n   <!-- MM_INCLUDE_FILE:${p} -->\n`;
    },
  );

  // .. compass-icon:: name (with :description: option) → raw HTML directive
  text = text.replace(/^\.\. compass-icon::\s*(\S+)\s*\n(?:[ \t]+:description:\s*([^\n]+)\n)?/gm, (_m, name, desc) => {
    tick(stats.directives, 'compass-icon');
    const d = (desc || '').trim();
    return `\n.. raw:: html\n\n   <CompassIcon name="${name.trim()}"${d ? ` description="${d.replace(/"/g, '&quot;')}"` : ''} />\n`;
  });

  // Inline Sphinx roles → sentinel-URL hyperlinks

  // :doc:`Custom Text <path>`
  text = text.replace(/:doc:`([^`<]+?)\s*<([^>`]+)>`/g, (_m, txt, path) => {
    stats.docRefs++;
    return sentinelLink(txt.trim(), 'mm-doc', path.trim());
  });
  // :doc:`/path` (no display text — use path basename)
  text = text.replace(/:doc:`([^`]+)`/g, (_m, path) => {
    stats.docRefs++;
    const p = path.trim();
    const display = p.split('/').filter(Boolean).pop().replace(/[-_]/g, ' ');
    return sentinelLink(display, 'mm-doc', p);
  });

  // :ref:`Custom Text <label>`
  text = text.replace(/:ref:`([^`<]+?)\s*<([^>`]+)>`/g, (_m, txt, label) => {
    stats.refRefs++;
    return sentinelLink(txt.trim(), 'mm-ref', label.trim());
  });
  // :ref:`label`
  text = text.replace(/:ref:`([^`]+)`/g, (_m, label) => {
    stats.refRefs++;
    // autosectionlabel form: "path:heading title" — display = heading title
    const m = label.match(/^([^:]+):(.+)$/);
    const display = m ? m[2].trim() : label.trim();
    return sentinelLink(display, 'mm-ref', label.trim());
  });

  // :kbd:`Ctrl+C` → sentinel mm-kbd link
  text = text.replace(/:kbd:`([^`]+)`/g, (_m, k) => {
    stats.kbdRoles++;
    return sentinelLink(k, 'mm-kbd', '');
  });

  // :sup:`x`  :sub:`y`
  text = text.replace(/:sup:`([^`]+)`/g, (_m, t) => sentinelLink(t, 'mm-sup', ''));
  text = text.replace(/:sub:`([^`]+)`/g, (_m, t) => sentinelLink(t, 'mm-sub', ''));

  // :download:`Text <path>` / :download:`path`
  text = text.replace(/:download:`([^`<]+?)\s*<([^>`]+)>`/g, (_m, txt, path) => sentinelLink(txt.trim(), 'mm-dl', path.trim()));
  text = text.replace(/:download:`([^`]+)`/g, (_m, path) => {
    const p = path.trim();
    return sentinelLink(basename(p), 'mm-dl', p);
  });

  // :samp:`text` → inline literal (pandoc passes as code)
  text = text.replace(/:samp:`([^`]+)`/g, (_m, t) => '``' + t + '``');

  // :compass-icon:`name,description` (inline role form — rare in main docs)
  text = text.replace(/:compass-icon:`([^,`]+)(?:,([^`]+))?`/g, (_m, name, desc) => {
    return sentinelLink((desc || name).trim(), 'mm-ci', name.trim());
  });

  // Substitutions: |name|  →  sentinel mm-sub link  (display = name; resolved
  // in post-process to an <img> from substitutions.json).
  text = text.replace(/\|([a-zA-Z][a-zA-Z0-9_-]*)\|/g, (_m, name) => {
    if (subs[name]) {
      stats.substitutions++;
      return sentinelLink(name, 'mm-subst', name);
    }
    return _m;
  });

  // Unknown :role:`text` — log and keep the text plain (pandoc emits as code).
  text = text.replace(/:([a-z][a-z0-9_-]+):`([^`]+)`/g, (m, role, val) => {
    if (['doc', 'ref', 'kbd', 'sup', 'sub', 'download', 'samp', 'compass-icon'].includes(role)) return m;
    tick(stats.unknownRoles, role);
    return val;
  });

  return {body: text, fm};
}

/* ──────────────────────────────────────────────────────────────────
 * Pandoc
 * ──────────────────────────────────────────────────────────────── */

function pandocRstToMd(rst) {
  return execFileSync(
    'pandoc',
    ['--from', 'rst', '--to', 'commonmark+raw_html', '--wrap=none', '--columns=120'],
    {input: rst, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']},
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Markdown POST-PROCESS
 * ──────────────────────────────────────────────────────────────── */

const ADMONITION_KINDS = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  attention: 'Important',
  caution: 'Warning',
  hint: 'Tip',
};

function postProcessMd(md, relPath, srcDir) {
  let text = md;
  const imports = [];

  // 0) Pandoc emits `&#10;` (HTML entity for LF) inside raw-HTML blocks
  //    where the RST source had a blank line. The encoded form keeps the
  //    block from breaking, but it also prevents MDX from recognizing
  //    the subsequent tag (`<table>`, `<div>`, …) as block-level. Replace
  //    with an actual blank line.
  text = text.replace(/&#10;/g, '\n');

  // 1) Pandoc commonmark output renders RST admonitions as nested divs:
  //      <div class="note">
  //      <div class="title">
  //      Note
  //      </div>
  //      body
  //      </div>
  text = convertPandocAdmonitions(text);

  // 2) Resolve sentinel-URL markdown links.
  //    Markdown link form: [display](scheme:encoded-payload)
  text = text.replace(/\[([^\]]*)\]\(mm-doc:([^)]*)\)/g, (_m, display, payload) => {
    const path = decodeURIComponent(payload);
    return mmDocLink(display, path);
  });
  text = text.replace(/\[([^\]]*)\]\(mm-ref:([^)]*)\)/g, (_m, display, payload) => {
    const label = decodeURIComponent(payload);
    return mmRefLink(display, label);
  });
  text = text.replace(/\[([^\]]*)\]\(mm-kbd:[^)]*\)/g, (_m, display) => `<kbd>${escapeJsxText(display)}</kbd>`);
  text = text.replace(/\[([^\]]*)\]\(mm-sup:[^)]*\)/g, (_m, display) => `<sup>${escapeJsxText(display)}</sup>`);
  text = text.replace(/\[([^\]]*)\]\(mm-sub:[^)]*\)/g, (_m, display) => `<sub>${escapeJsxText(display)}</sub>`);
  text = text.replace(/\[([^\]]*)\]\(mm-dl:([^)]*)\)/g, (_m, display, payload) => {
    const path = decodeURIComponent(payload);
    return `[${display}](${path.startsWith('/') ? path : '/' + path})`;
  });
  text = text.replace(/\[([^\]]*)\]\(mm-subst:([^)]*)\)/g, (_m, _display, payload) => {
    const name = decodeURIComponent(payload);
    const data = subs[name];
    if (!data) return _m;
    const cls = data.class ? ` className="${data.class}"` : '';
    const alt = (data.alt || name).replace(/"/g, '&quot;');
    return `<img src="${data.src}" alt="${alt}"${cls} />`;
  });
  text = text.replace(/\[([^\]]*)\]\(mm-ci:([^)]*)\)/g, (_m, display, payload) => {
    const name = decodeURIComponent(payload);
    return `<CompassIcon name="${name}"${display && display !== name ? ` description="${display.replace(/"/g, '&quot;')}"` : ''} />`;
  });

  // 3) Resolve `<!-- MM_INCLUDE_FILE:path -->` placeholders by emitting an
  //    MDX import + component use. Path resolved relative to source file dir.
  let importIdx = 0;
  text = text.replace(/<!-- MM_INCLUDE_FILE:([^\s>]+) -->/g, (m, p) => {
    const resolved = resolveIncludePath(p, srcDir);
    if (!resolved) {
      logTodo(relPath, `include of ${p} could not be resolved — left as TODO`);
      return `\n{/* TODO: include ${p} could not be resolved */}\n`;
    }
    const componentName = `Inc${importIdx++}_${resolved.componentName}`;
    imports.push(`import ${componentName} from '${resolved.relImport}';`);
    return `<${componentName} />`;
  });

  // 4) Pandoc may emit `<span class="title-ref">…</span>` for unresolved
  //    single-backticked text. Map to inline code.
  text = text.replace(/<span class="title-ref">([\s\S]*?)<\/span>/g, (_m, t) => `<code>${t}</code>`);

  // 4) Markdown autolinks `<https://...>` and bare-email `<x@y.z>` choke MDX
  //    (parsed as JSX). Rewrite to explicit `[url](url)` / `[email](mailto:email)`.
  text = text.replace(/<((?:https?|mailto|ftp):[^\s>]+)>/g, (_m, url) => `[${url}](${url})`);
  text = text.replace(/<([\w.+-]+@[\w-]+(?:\.[\w-]+)+)>/g, (_m, email) => `[${email}](mailto:${email})`);

  // 4b) Normalize image paths. Sphinx sources use `../images/X.png` (relative
  //    to the section dir) and `/images/X.png` (absolute). Docusaurus serves
  //    static assets from `docs-site/static/`. Rewrite both forms to
  //    `/images/X.png` and copy the asset on demand.
  text = text.replace(/!\[([^\]]*)\]\(((?:\.\.\/)+images\/[^)]+)\)/g, (_m, alt, p) => {
    const name = p.replace(/^(?:\.\.\/)+images\//, '');
    portContentImage(name);
    return `![${alt}](/images/${name})`;
  });
  text = text.replace(/!\[([^\]]*)\]\(\/images\/([^)]+)\)/g, (_m, alt, name) => {
    portContentImage(name);
    return `![${alt}](/images/${name})`;
  });

  // 5) HTML comments `<!-- ... -->` are NOT valid in MDX 3. Rewrite to JSX
  //    comments. Skip our own MM_INCLUDE_FILE markers which were already
  //    handled above.
  text = text.replace(/<!--([\s\S]*?)-->/g, (m, body) => {
    if (body.includes('MM_INCLUDE_FILE')) return m; // already processed above
    return `{/*${body}*/}`;
  });

  // 6) Escape `<` that doesn't begin a real tag. MDX otherwise tries to
  //    parse text like `<2.34`, `<@user>`, `<!channel>` as JSX.
  //    Allow: `<letter` (tags/components), `</` (closing tag), `<!--` (comment).
  text = escapeBareLT(text);

  // 7) Unmatched single-tag references in prose (e.g. literal text
  //    referring to `<time>` element). If a tag like `<time>` appears
  //    without a closing `</time>` in the same paragraph, escape it.
  text = escapeOrphanInlineTags(text);

  // 5) MDX hygiene — order matters: escape braces in *prose* first, then
  //    convertHtmlStyleAttr injects JSX-style `style={{…}}` which must not
  //    get re-escaped.
  text = escapeProseBraces(text);
  text = convertHtmlStyleAttr(text);
  text = selfCloseVoidTags(text);
  // Strip explicit heading anchors {#id} — Docusaurus auto-generates.
  text = text.replace(/^(#{1,6}.*?)\s+\{#[^}]+\}\s*$/gm, '$1');
  // Collapse 3+ blank lines.
  text = text.replace(/\n{3,}/g, '\n\n');

  return {body: text.trim() + '\n', imports};
}

function resolveIncludePath(relInclude, srcDir) {
  // relInclude is the path as written in the .rst (e.g. './common-esr-support-rst.rst').
  // We assume the included file will have been migrated to MDX in the same
  // relative location with `.rst` / `.md` → `.mdx`.
  const isAbsolute = relInclude.startsWith('/');
  const sourcePath = isAbsolute
    ? join(SRC, relInclude.replace(/^\//, ''))
    : join(srcDir, relInclude);
  // Source must exist — otherwise the destination MDX will never exist
  // either (e.g. uninitialized git submodule like agents/).
  if (!existsSync(sourcePath)) return null;
  const mdxName = basename(sourcePath).replace(/\.(rst|md)$/, '.mdx');
  const mdxDir = dirname(sourcePath);
  // Compute final dst path of the included file.
  const dstPath = mapSrcToDst(join(mdxDir, mdxName));
  if (!dstPath) return null;
  // Compute import path relative to the CURRENT file's dst dir.
  const currentDstDir = mapSrcToDst(srcDir);
  let rel = relative(currentDstDir, dstPath);
  if (!rel.startsWith('.')) rel = './' + rel;
  const componentName = basename(dstPath, '.mdx').replace(/[^A-Za-z0-9]/g, '_');
  return {relImport: rel, componentName};
}

function mapSrcToDst(srcPath) {
  // src lives under SRC; dst mirrors structure under DST.
  if (!srcPath.startsWith(SRC)) return null;
  return join(DST, relative(SRC, srcPath));
}

function convertPandocAdmonitions(md) {
  // Pandoc commonmark output emits admonitions as nested divs:
  //
  //   <div class="kind">
  //
  //   <div class="title">
  //
  //   Kind
  //
  //   </div>
  //
  //   body...
  //
  //   </div>
  //
  // We can't balance-match nested divs with a single regex, so:
  //   (a) first strip the inner `<div class="title">…</div>` blocks
  //   (b) then the admonition div has no inner divs and we can match
  //       outer `<div class="kind">…</div>` greedily-non-greedy.
  let text = md.replace(
    /^<div class="title">\s*\n[\s\S]*?\n<\/div>\s*$/gm,
    '',
  );
  const kinds = Object.keys(ADMONITION_KINDS).join('|');
  const re = new RegExp(`^<div class="(${kinds})">\\s*\\n([\\s\\S]*?)\\n</div>\\s*$`, 'gm');
  return text.replace(re, (_m, kind, body) => {
    const Tag = ADMONITION_KINDS[kind] || 'Note';
    return `\n<${Tag}>\n\n${body.trim()}\n\n</${Tag}>\n`;
  });
}

function mmDocLink(display, path) {
  // Sphinx :doc: paths beginning with `/` are absolute from source root.
  let p = path.replace(/^\//, '').replace(/\.(rst|md)$/, '');
  const [base, anchor] = p.split('#');
  let dst = '/' + base;
  if (anchor) dst += '#' + anchor.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const text = display && display.trim() ? display.trim() : base.split('/').pop().replace(/[-_]/g, ' ');
  return `[${text}](${dst})`;
}

function mmRefLink(display, label) {
  // autosectionlabel form: "path/to/doc:heading title" → path link with anchor.
  const m = label.match(/^([^:]+):(.+)$/);
  if (m) {
    const [, docPath, heading] = m;
    const slug = heading.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const text = display && display.trim() ? display.trim() : heading.trim();
    return `[${text}](/${docPath}#${slug})`;
  }
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const text = display && display.trim() ? display.trim() : label;
  return `[${text}](#${slug})`;
}

/* ──────────────────────────────────────────────────────────────────
 * MDX hygiene
 * ──────────────────────────────────────────────────────────────── */

function escapeJsxText(s) {
  return s.replace(/[{}<>]/g, (c) => ({'{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;'}[c]));
}

/** Escape `<` followed by characters that can't begin a valid HTML/JSX tag.
 *  Catches `<@user>`, `<!channel>`, `<2.34`, `< foo` etc. as plain text.
 *  Skips fenced code blocks. */
function escapeBareLT(text) {
  // Walk lines; track fenced code blocks. A fence opens with three or more
  // backticks/tildes followed by an optional info-string. A fence closes
  // with a bare run of the same fence character (whitespace allowed). This
  // matches CommonMark's rule and avoids the trap where `\`\`\`{kind}`
  // (MyST directive opener) gets mistaken for a closer.
  const lines = text.split('\n');
  let fenceMarker = null;
  const out = [];
  for (const ln of lines) {
    const trimmed = ln.trim();
    if (fenceMarker === null) {
      const open = trimmed.match(/^(`{3,}|~{3,})/);
      if (open) {
        fenceMarker = open[1];
        out.push(ln); continue;
      }
    } else {
      // Inside fence — only a BARE run of the same char (length >=
      // opening) closes it.
      const ch = fenceMarker[0];
      const re = new RegExp(`^${'\\' + ch}{${fenceMarker.length},}\\s*$`);
      if (re.test(trimmed)) {
        fenceMarker = null;
        out.push(ln); continue;
      }
    }
    if (fenceMarker !== null) { out.push(ln); continue; }
    // Walk the line, leaving inline code spans (`...`) untouched.
    let result = '';
    let i = 0;
    while (i < ln.length) {
      const c = ln[i];
      if (c === '`') {
        const end = ln.indexOf('`', i + 1);
        if (end > i) { result += ln.slice(i, end + 1); i = end + 1; continue; }
      }
      if (c === '<') {
        const next = ln[i + 1];
        // Allow real tag starts: <letter, </ , <!-- , <> (fragment).
        if (next === '/' || /[a-zA-Z]/.test(next) || ln.slice(i, i + 4) === '<!--' || ln.slice(i, i + 2) === '<>') {
          result += c; i++; continue;
        }
        result += '&lt;'; i++; continue;
      }
      result += c; i++;
    }
    out.push(result);
  }
  return out.join('\n');
}

/** Escape `<word>` references in prose that have no matching `</word>`
 *  within a reasonable window. Catches author-written element references
 *  like "Until <time>" and "Add <user> to a channel". Conservative — only
 *  matches bare `<tag>` with no attributes (so real HTML5 elements with
 *  attributes are untouched), and only escapes if no closing tag appears
 *  within 100 lines downstream. */
const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function escapeOrphanInlineTags(text) {
  const lines = text.split('\n');
  // Pre-compute the set of closing tags that appear anywhere in the file.
  const closingTags = new Set();
  const closeRe = /<\/([a-z][a-z0-9-]*)>/g;
  for (const ln of lines) {
    let m;
    while ((m = closeRe.exec(ln)) !== null) closingTags.add(m[1]);
  }
  let fenceMarker = null;
  const out = [];
  // Match `<tag>` or `<tag attr ...>` opening forms (NOT self-closing
  // `<tag />` — those terminate inside the tag and are safe). Allow
  // hyphens in tag names so placeholders like `<your-app-id-here>` are
  // caught even though they're not real HTML elements.
  const openRe = /<([a-z][a-z0-9-]*)(\s+[^<>]*?)?>/g;
  for (const ln of lines) {
    const trimmed = ln.trim();
    if (fenceMarker === null) {
      const open = trimmed.match(/^(`{3,}|~{3,})/);
      if (open) { fenceMarker = open[1]; out.push(ln); continue; }
    } else {
      const ch = fenceMarker[0];
      const re = new RegExp(`^${'\\' + ch}{${fenceMarker.length},}\\s*$`);
      if (re.test(trimmed)) { fenceMarker = null; out.push(ln); continue; }
    }
    if (fenceMarker !== null) { out.push(ln); continue; }
    out.push(ln.replace(openRe, (m, tag, attrs) => {
      // Self-closing form `<tag … />` ends with `/>`, never matches openRe.
      if (VOID_HTML_TAGS.has(tag)) return m;
      if (closingTags.has(tag)) return m;
      const safeAttrs = (attrs || '').replace(/[<>&]/g, (c) => ({'<': '&lt;', '>': '&gt;', '&': '&amp;'}[c]));
      return `&lt;${tag}${safeAttrs}&gt;`;
    }));
  }
  return out.join('\n');
}

function escapeProseBraces(text) {
  // Line-by-line: skip fenced code blocks, JSX tags with expression
  // attributes, and JSX comments. Escape literal `{` / `}` everywhere
  // else. Uses the same robust fence tracking as escapeBareLT so that
  // MyST directive openers (```{Note} etc.) don't desync the state.
  const lines = text.split('\n');
  let fenceMarker = null;
  const out = [];
  for (const ln of lines) {
    const trimmed = ln.trim();
    if (fenceMarker === null) {
      const open = trimmed.match(/^(`{3,}|~{3,})/);
      if (open) { fenceMarker = open[1]; out.push(ln); continue; }
    } else {
      const ch = fenceMarker[0];
      const re = new RegExp(`^${'\\' + ch}{${fenceMarker.length},}\\s*$`);
      if (re.test(trimmed)) { fenceMarker = null; out.push(ln); continue; }
    }
    if (fenceMarker !== null) { out.push(ln); continue; }
    if (/<[A-Z][\w]*[^>]*\{/.test(ln)) { out.push(ln); continue; }
    if (/\{\s*\/\*/.test(ln)) { out.push(ln); continue; }
    out.push(ln.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;'));
  }
  return out.join('\n');
}

function convertHtmlStyleAttr(text) {
  // HTML `style="prop:val; prop:val"` → JSX `style={{prop: 'val', ...}}`.
  return text.replace(/style="([^"]+)"/g, (_, css) => {
    const props = css
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((decl) => {
        const idx = decl.indexOf(':');
        if (idx === -1) return null;
        const prop = decl.slice(0, idx).trim();
        const val = decl.slice(idx + 1).trim();
        const jsProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return `${jsProp}: '${val.replace(/'/g, "\\'")}'`;
      })
      .filter(Boolean)
      .join(', ');
    return `style={{${props}}}`;
  });
}

function selfCloseVoidTags(text) {
  const voids = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ];
  for (const tag of voids) {
    const re = new RegExp(`<${tag}(\\s+[^>]*?)?>(?!\\s*</${tag}>)`, 'g');
    text = text.replace(re, (m, attrs) => {
      // Already self-closed (`<img … />`) — leave alone.
      if (attrs && attrs.trimEnd().endsWith('/')) return m;
      return `<${tag}${attrs || ''} />`;
    });
  }
  return text;
}

/* ──────────────────────────────────────────────────────────────────
 * Per-file pipelines
 * ──────────────────────────────────────────────────────────────── */

function processRst(srcPath, dstPath) {
  process.stderr.write(`[migrate] ${relative(REPO_ROOT, srcPath)}\n`);
  const raw = readFileSync(srcPath, 'utf8');
  const relPath = relative(REPO_ROOT, srcPath);

  const {body: pre, fm} = rstPreprocess(raw, relPath);

  let md;
  try {
    md = pandocRstToMd(pre);
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    process.stderr.write(`  pandoc failed: ${stderr.split('\n')[0]}\n`);
    logTodo(relPath, `pandoc failed: ${stderr.split('\n')[0]}`);
    stats.pandocFailures.push(relPath);
    return;
  }

  // Hoist H1 → frontmatter.title (if not already set).
  const titleMatch = md.match(/^#\s+(.+?)\s*$/m);
  if (titleMatch) {
    if (!fm.title) fm.title = titleMatch[1].trim();
    md = md.replace(titleMatch[0], '').replace(/^\n+/, '');
  }

  const {body, imports} = postProcessMd(md, relPath, dirname(srcPath));

  mkdirSync(dirname(dstPath), {recursive: true});
  const importBlock = imports.length ? imports.join('\n') + '\n\n' : '';
  writeFileSync(dstPath, emitFrontmatter(fm) + importBlock + body);
  stats.files++;
  stats.rstFiles++;
}

function processMyst(srcPath, dstPath) {
  process.stderr.write(`[migrate] ${relative(REPO_ROOT, srcPath)}\n`);
  let text = readFileSync(srcPath, 'utf8');
  const relPath = relative(REPO_ROOT, srcPath);
  const srcDir = dirname(srcPath);
  const fm = {};
  const imports = [];
  let importIdx = 0;

  // Heuristic: complex raw-HTML tables (custom <table class="…"> with
  // significant inline CSS or `<style>` blocks) need a manual port pass.
  if (/<table[^>]*\bclass=/.test(text) || /^<style>/m.test(text)) {
    fm.draft = true;
    logTodo(relPath, `complex raw HTML table or <style> block — marked draft for manual port`);
  }

  // :orphan: / :nosearch: / :page_title: field lines
  text = text.replace(/^:([\w-]+):\s*(.*)$/gm, (m, k, v) => {
    if (k === 'orphan' || k === 'nosearch') return '';
    if (k === 'page_title') { fm.title = (v || '').trim(); return ''; }
    return m;
  });

  // ```{kind}\n...\n``` admonitions
  const kindRe = /^```\{(note|tip|important|warning|attention|caution|hint)\}\s*\n([\s\S]*?)\n```\s*$/gm;
  text = text.replace(kindRe, (_m, kind, body) => {
    tick(stats.directives, kind);
    const Tag = ADMONITION_KINDS[kind] || 'Note';
    return `\n<${Tag}>\n\n${body.trim()}\n\n</${Tag}>\n`;
  });

  // ```{include} path``` — badge or general
  text = text.replace(/^```\{include\}\s*(\S+)\s*\n?```\s*$/gm, (_m, p) => {
    if (p.includes('_static/badges/')) {
      const slug = basename(p).replace(/\.(rst|md)$/, '');
      stats.planAvailability++;
      return `\n<PlanAvailability slug="${slug}" />\n`;
    }
    const resolved = resolveIncludePath(p, srcDir);
    if (!resolved) {
      logTodo(relPath, `myst include of ${p} could not be resolved`);
      return `\n{/* TODO: include ${p} not yet ported */}\n`;
    }
    const componentName = `Inc${importIdx++}_${resolved.componentName}`;
    imports.push(`import ${componentName} from '${resolved.relImport}';`);
    return `<${componentName} />`;
  });

  // ```{raw} html\n...\n``` → keep inner HTML
  text = text.replace(/^```\{raw\}\s+html\s*\n([\s\S]*?)\n```\s*$/gm, (_m, body) => body);

  // ```{eval-rst} → leave verbatim with TODO
  text = text.replace(/^```\{eval-rst\}\s*\n([\s\S]*?)\n```\s*$/gm, (_m, body) => {
    logTodo(relPath, `eval-rst block left as TODO`);
    return `\n{/* TODO: eval-rst block left verbatim, port manually */}\n\`\`\`\n${body}\n\`\`\`\n`;
  });

  // ```{toctree} ... ``` → drop
  text = text.replace(/^```\{toctree\}[\s\S]*?\n```\s*$/gm, () => {
    tick(stats.directives, 'toctree');
    return '';
  });

  // ```{image} src\n :alt: ...\n``` → <img>
  text = text.replace(/^```\{image\}\s+(\S+)\s*\n([\s\S]*?)\n```\s*$/gm, (_m, src, opts) => {
    let alt = '';
    const altMatch = opts.match(/^:alt:\s*(.+)$/m);
    if (altMatch) alt = altMatch[1].trim();
    return `<img src="${src}" alt="${alt.replace(/"/g, '&quot;')}" />`;
  });

  // {ref}, {doc}
  text = text.replace(/\{ref\}`([^`<]+?)\s*<([^>]+)>`/g, (_m, t, l) => { stats.refRefs++; return mmRefLink(t.trim(), l.trim()); });
  text = text.replace(/\{ref\}`([^`]+)`/g, (_m, l) => { stats.refRefs++; return mmRefLink('', l.trim()); });
  text = text.replace(/\{doc\}`([^`<]+?)\s*<([^>]+)>`/g, (_m, t, p) => { stats.docRefs++; return mmDocLink(t.trim(), p.trim()); });
  text = text.replace(/\{doc\}`([^`]+)`/g, (_m, p) => { stats.docRefs++; return mmDocLink('', p.trim()); });

  // {kbd}
  text = text.replace(/\{kbd\}`([^`]+)`/g, (_m, k) => { stats.kbdRoles++; return `<kbd>${escapeJsxText(k)}</kbd>`; });
  // Other {role}`val` is NOT converted — there's no safe generic mapping
  // and many false positives sit inside existing backtick code-spans
  // (e.g. `/teams/{team_id}` API paths). Just log unknowns for follow-up.
  const knownMystRoles = new Set(['ref', 'doc', 'kbd']);
  text = text.replace(/\{([a-z][a-z_]*)\}`([^`]+)`/g, (m, role, _val) => {
    if (!knownMystRoles.has(role)) tick(stats.unknownRoles, role);
    return m;
  });

  // Hoist first H1 to frontmatter.title (if not already set).
  const tm = text.match(/^#\s+(.+?)\s*$/m);
  if (tm) {
    if (!fm.title) fm.title = tm[1].trim();
    text = text.replace(tm[0], '').replace(/^\n+/, '');
  }

  // Autolinks and HTML comments (same hygiene as the RST pipeline).
  text = text.replace(/<((?:https?|mailto|ftp):[^\s>]+)>/g, (_m, url) => `[${url}](${url})`);
  text = text.replace(/<([\w.+-]+@[\w-]+(?:\.[\w-]+)+)>/g, (_m, email) => `[${email}](mailto:${email})`);
  text = text.replace(/<!--([\s\S]*?)-->/g, (_m, body) => `{/*${body}*/}`);

  // Image-path normalization (same as RST pipeline).
  text = text.replace(/!\[([^\]]*)\]\(((?:\.\.\/)+images\/[^)]+)\)/g, (_m, alt, p) => {
    const name = p.replace(/^(?:\.\.\/)+images\//, '');
    portContentImage(name);
    return `![${alt}](/images/${name})`;
  });
  text = text.replace(/!\[([^\]]*)\]\(\/images\/([^)]+)\)/g, (_m, alt, name) => {
    portContentImage(name);
    return `![${alt}](/images/${name})`;
  });

  text = escapeBareLT(text);
  text = escapeOrphanInlineTags(text);

  // Order matters: prose-brace escape runs BEFORE style attribute
  // conversion so injected JSX `style={{…}}` survives.
  text = escapeProseBraces(text);
  text = convertHtmlStyleAttr(text);
  text = selfCloseVoidTags(text);
  text = text.replace(/\n{3,}/g, '\n\n');

  mkdirSync(dirname(dstPath), {recursive: true});
  const importBlock = imports.length ? imports.join('\n') + '\n\n' : '';
  writeFileSync(dstPath, emitFrontmatter(fm) + importBlock + text.trim() + '\n');
  stats.files++;
  stats.mdFiles++;
}

/* ──────────────────────────────────────────────────────────────────
 * Walker
 * ──────────────────────────────────────────────────────────────── */

function migrateSection(section) {
  const srcDir = join(SRC, section);
  const dstDir = join(DST, section);
  if (!existsSync(srcDir)) {
    console.warn(`[migrate] skip ${section}: missing in source`);
    return;
  }
  rmSync(dstDir, {recursive: true, force: true});
  mkdirSync(dstDir, {recursive: true});
  walk(srcDir, dstDir);
}

function walk(srcDir, dstDir) {
  for (const name of readdirSync(srcDir)) {
    const srcPath = join(srcDir, name);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      walk(srcPath, join(dstDir, name));
      continue;
    }
    const ext = extname(name).toLowerCase();
    if (ext === '.rst') {
      processRst(srcPath, join(dstDir, name.replace(/\.rst$/, '.mdx')));
    } else if (ext === '.md') {
      processMyst(srcPath, join(dstDir, name.replace(/\.md$/, '.mdx')));
    } else if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.pdf'].includes(ext)) {
      mkdirSync(dstDir, {recursive: true});
      cpSync(srcPath, join(dstDir, name));
    }
  }
}

/* ──────────────────────────────────────────────────────────────────
 * Main
 * ──────────────────────────────────────────────────────────────── */

function main() {
  if (!existsSync(SRC)) { console.error(`source not found: ${SRC}`); process.exit(1); }
  const sections = ONLY ? [ONLY] : SECTIONS;
  console.log(`[migrate] source: ${SRC}`);
  console.log(`[migrate] target: ${DST}`);
  console.log(`[migrate] sections: ${sections.join(', ')}`);

  for (const s of sections) migrateSection(s);

  console.log('\n[migrate] stats:');
  console.log(`  files:               ${stats.files}  (${stats.rstFiles} rst, ${stats.mdFiles} md)`);
  console.log(`  :doc: refs:          ${stats.docRefs}`);
  console.log(`  :ref: refs:          ${stats.refRefs}`);
  console.log(`  :kbd: roles:         ${stats.kbdRoles}`);
  console.log(`  substitutions:       ${stats.substitutions}`);
  console.log(`  plan-availability:   ${stats.planAvailability}`);
  console.log('  directives:');
  for (const [k, v] of [...stats.directives.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(20)} ${v}`);
  }
  if (stats.unknownRoles.size) {
    console.log('  unknown roles (left as <code> or plain text):');
    for (const [k, v] of [...stats.unknownRoles.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    :${k}:`.padEnd(22) + ' ' + v);
    }
  }
  if (stats.pandocFailures.length) {
    console.log(`  pandoc failures: ${stats.pandocFailures.length}`);
    for (const f of stats.pandocFailures) console.log(`    ${f}`);
  }
  if (logLines.length) {
    writeFileSync(LOG_PATH, logLines.join('\n') + '\n');
    console.log(`\n  TODO log: ${LOG_PATH} (${logLines.length} entries)`);
  }
}

main();
