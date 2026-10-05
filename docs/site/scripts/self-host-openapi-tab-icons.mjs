#!/usr/bin/env node
// docusaurus-theme-openapi-docs CodeTabs load language icons from
// raw.githubusercontent.com (devicons/devicon, ISC). Rewrite those url()s
// to self-hosted copies in static/img/devicons so the offline bundle does
// not fetch GitHub.

import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const BUILD = join(SITE, 'build');
const ICONS = join(SITE, 'static', 'img', 'devicons');
const REMOTE =
  /url\(\s*['"]?https:\/\/raw\.githubusercontent\.com\/devicons\/devicon\/master\/icons\/[^/]+\/([^'")\s]+)['"]?\s*\)/g;

const icons = new Set(readdirSync(ICONS).filter((n) => n.endsWith('.svg')));
const cssDir = join(BUILD, 'assets', 'css');
if (!existsSync(cssDir)) {
  console.error(`[self-host-openapi-tab-icons] ${cssDir} not found; run \`docusaurus build\` first.`);
  process.exit(1);
}
let rewritten = 0;
let missing = [];

for (const name of readdirSync(cssDir)) {
  if (!name.endsWith('.css')) {
    continue;
  }
  const file = join(cssDir, name);
  const original = readFileSync(file, 'utf8');
  const next = original.replace(REMOTE, (match, basename) => {
    if (!icons.has(basename)) {
      missing.push(basename);
      return match;
    }
    rewritten++;
    return `url(../../img/devicons/${basename})`;
  });
  if (next !== original) {
    writeFileSync(file, next);
  }
}

if (missing.length > 0) {
  console.error(
    `[self-host-openapi-tab-icons] missing local icon(s): ${[...new Set(missing)].join(', ')}`,
  );
  process.exit(1);
}

console.log(`[self-host-openapi-tab-icons] rewrote ${rewritten} url() in assets/css`);
