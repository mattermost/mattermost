#!/usr/bin/env node
// Generate the Developers sidebar from the migrated content tree under
// develop/. Output: docs-site/sidebars/developers.generated.json
//
// Usage: node docs-site/scripts/gen-developer-sidebar.mjs

import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, resolve, basename, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const SRC = join(REPO_ROOT, 'develop');
const OUT = join(SITE_ROOT, 'sidebars', 'developers.generated.json');

const TOP_LEVEL = [
  {dir: 'contribute',  label: 'Contribute'},
  {dir: 'integrate',   label: 'Integrate & Extend'},
  {dir: 'internal',    label: 'Internal'},
];

function humanize(name) {
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function readFm(filePath, key) {
  try {
    const text = readFileSync(filePath, 'utf8').slice(0, 2000);
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const r = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm');
    const x = m[1].match(r);
    return x ? x[1].trim().replace(/^"|"$/g, '') : null;
  } catch { return null; }
}

function pathToDocId(relPath) { return relPath.replace(/\.(md|mdx)$/, ''); }

function buildCategory(absDir, devRelDir) {
  const items = [];
  const entries = readdirSync(absDir);
  const indexFile = entries.find((e) => /^index\.(md|mdx)$/.test(e));
  let categoryLink = null;
  if (indexFile) {
    categoryLink = {type: 'doc', id: pathToDocId(join(devRelDir, indexFile))};
  }

  const subDirs = [];
  const leafDocs = [];
  for (const name of entries) {
    if (/^index\.(md|mdx)$/.test(name)) continue;
    const abs = join(absDir, name);
    const st = statSync(abs);
    if (st.isDirectory()) subDirs.push(name);
    else if (st.isFile() && /\.(md|mdx)$/.test(name)) leafDocs.push(name);
  }

  function key(name, abs) {
    const p = readFm(abs, 'sidebar_position');
    return [p ? Number(p) : 9999, name.toLowerCase()];
  }
  leafDocs.sort((a, b) => {
    const ka = key(a, join(absDir, a));
    const kb = key(b, join(absDir, b));
    return ka[0] - kb[0] || ka[1].localeCompare(kb[1]);
  });
  subDirs.sort((a, b) => {
    const ka = key(a, join(absDir, a, 'index.md'));
    const kb = key(b, join(absDir, b, 'index.md'));
    return ka[0] - kb[0] || ka[1].localeCompare(kb[1]);
  });

  for (const name of leafDocs) {
    const id = pathToDocId(join(devRelDir, name));
    const label = readFm(join(absDir, name), 'title') || humanize(basename(name, /\.(md|mdx)$/.exec(name)[0]));
    items.push({type: 'doc', id, label});
  }
  for (const name of subDirs) {
    const sub = buildCategory(join(absDir, name), join(devRelDir, name));
    // Skip empty subcategories — Docusaurus refuses sidebar categories that
    // have neither a link nor any items.
    if (sub) items.push(sub);
  }

  const label =
    readFm(join(absDir, 'index.md'), 'title') ||
    readFm(join(absDir, 'index.mdx'), 'title') ||
    humanize(basename(absDir));

  if (!categoryLink && items.length === 0) return null;

  return {type: 'category', label, collapsed: true, ...(categoryLink ? {link: categoryLink} : {}), items};
}

function main() {
  if (!existsSync(SRC)) { console.error(`develop/ not found at ${SRC}`); process.exit(1); }

  const sidebar = [{type: 'doc', id: 'index', label: 'Welcome'}];
  for (const {dir, label} of TOP_LEVEL) {
    const abs = join(SRC, dir);
    if (!existsSync(abs)) { console.warn(`[sidebar] skip ${dir}: missing`); continue; }
    const cat = buildCategory(abs, dir);
    cat.label = label;
    cat.collapsed = true;
    sidebar.push(cat);
  }
  writeFileSync(OUT, JSON.stringify(sidebar, null, 2));

  let cats = 0, docs = 0;
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'category') cats++;
      if (n.type === 'doc') docs++;
      if (n.items) walk(n.items);
    }
  })(sidebar);
  console.log(`[sidebar] wrote ${OUT}: ${cats} categories, ${docs} docs`);
}

main();
