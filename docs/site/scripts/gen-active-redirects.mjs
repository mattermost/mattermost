#!/usr/bin/env node
// Filter the raw redirects.json (extracted from the legacy Sphinx
// redirects.py) to the subset whose target MDX page actually exists in
// the migrated `docs/` tree. Output:
//   docs-site/sidebars/active-redirects.json
// (kept in the sidebars/ folder since that's already gitignore-aware and
// regenerated). Consumed by docusaurus.config.ts via
// @docusaurus/plugin-client-redirects.
//
// Internal redirects whose destination is still missing (target page not
// yet migrated, or marked draft) are dropped silently — they'll start
// working as soon as the destination lands. External redirects (to
// github.com, other-host) need server-side rules and aren't emitted here.
//
// Usage: node docs-site/scripts/gen-active-redirects.mjs

import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, resolve, basename, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const DOCS = join(REPO_ROOT, 'main');
const SRC = join(SITE_ROOT, 'scripts', 'migrate-main-docs', 'redirects.json');
const OUT = join(SITE_ROOT, 'sidebars', 'active-redirects.json');

function isDraft(filePath) {
  try {
    const head = readFileSync(filePath, 'utf8').slice(0, 800);
    return /^draft:\s*true/m.test(head);
  } catch { return false; }
}

function urlFromMdx(absPath) {
  // docs/foo/bar.mdx → /foo/bar  (index.mdx → /foo)
  let rel = absPath.slice(DOCS.length).replace(/\\/g, '/');
  rel = rel.replace(/\.mdx$/, '');
  if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length);
  return rel || '/';
}

function collectExistingUrls() {
  const urls = new Set();
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (p.endsWith('.mdx') && !isDraft(p)) urls.add(urlFromMdx(p));
    }
  })(DOCS);
  return urls;
}

function main() {
  const raw = JSON.parse(readFileSync(SRC, 'utf8'));
  const existing = collectExistingUrls();
  const active = [];
  const missing = [];
  const droppedAnchoredFrom = [];
  for (const r of raw.internal) {
    // @docusaurus/plugin-client-redirects requires `from` paths without
    // anchors. Sphinx allowed anchored sources for mid-page redirects —
    // those need server-side rules, not client-side. Drop them.
    if (r.from.includes('#')) { droppedAnchoredFrom.push(r); continue; }
    // Strip anchor when checking existence; preserve it in the emitted to.
    const target = r.to.split('#')[0];
    if (existing.has(target)) active.push({from: r.from, to: r.to});
    else missing.push(r);
  }
  // De-duplicate: the plugin refuses duplicate FROM values.
  const seenFrom = new Map();
  const final = [];
  for (const r of active) {
    if (seenFrom.has(r.from)) continue;
    seenFrom.set(r.from, true);
    final.push(r);
  }
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        _meta: {
          source: 'docs-site/scripts/migrate-main-docs/redirects.json',
          active: final.length,
          missing_target: missing.length,
          dropped_anchored_from: droppedAnchoredFrom.length,
          total_internal: raw.internal.length,
        },
        redirects: final,
      },
      null,
      2,
    ),
  );
  console.log(`[redirects] wrote ${OUT}`);
  console.log(`  active:              ${final.length}`);
  console.log(`  missing target:      ${missing.length}`);
  console.log(`  dropped (anchored):  ${droppedAnchoredFrom.length}`);
  console.log(`  total internal:      ${raw.internal.length}`);
}

main();
