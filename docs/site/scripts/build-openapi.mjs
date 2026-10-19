#!/usr/bin/env node
/**
 * Builds the merged OpenAPI spec by delegating to the canonical api/Makefile,
 * then sanitizes the output for MDX compatibility.
 *
 * Sanitization (description / summary / title strings):
 *   1) Embedded "..." breaks docusaurus-plugin-openapi-docs frontmatter quoting.
 *      Replace with curly quotes (“ / ”).
 *   2) Markdown autolinks like </api/v4/foo> are parsed as JSX closing tags by MDX.
 *      Escape bare < not followed by a letter or ! to &lt;.
 *
 * Usage:  node scripts/build-openapi.mjs   (from docs/site/)
 * Output: docs/site/openapi/mattermost-openapi-v4.yaml
 */

import {execSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse, stringify} from 'yaml';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url)); // docs/site/scripts
const DOCS_SITE_DIR = resolve(SCRIPT_DIR, '..'); // docs/site
const MONOREPO_ROOT = resolve(SCRIPT_DIR, '../../..'); // mattermost/
const API_ROOT = resolve(MONOREPO_ROOT, 'api'); // mattermost/api
const RAW_SPEC_PATH = resolve(API_ROOT, 'v4/html/static/mattermost-openapi-v4.yaml'); // make's own output
const SANITIZED_SPEC_PATH = resolve(DOCS_SITE_DIR, 'openapi/mattermost-openapi-v4.yaml'); // what Docusaurus reads

function walkStrings(node, fn, key) {
  if (typeof node === 'string') return fn(node, key);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = walkStrings(node[i], fn, key);
    return node;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) node[k] = walkStrings(v, fn, k);
    return node;
  }
  return node;
}

function main() {
  if (!existsSync(API_ROOT)) {
    console.error(`[openapi] api/ directory not found at ${API_ROOT}`);
    console.error('[openapi] Ensure you are running from within the mattermost monorepo.');
    process.exit(1);
  }

  console.log(`[openapi] Building OpenAPI spec via make -C ${API_ROOT} build`);
  execSync(`make -C ${API_ROOT} build`, {stdio: 'inherit'});

  if (!existsSync(RAW_SPEC_PATH)) {
    console.error(`[openapi] Expected make output not found: ${RAW_SPEC_PATH}`);
    process.exit(1);
  }

  console.log('[openapi] Sanitizing for MDX compatibility ...');
  const doc = parse(readFileSync(RAW_SPEC_PATH, 'utf8'));

  let quoteFixes = 0;
  let autolinkFixes = 0;
  walkStrings(doc, (value, key) => {
    if (key !== 'description' && key !== 'summary' && key !== 'title') return value;
    let v = value;
    if (v.includes('"')) {
      const fixed = v.replace(/"([^"]*)"/g, '“$1”');
      if (fixed !== v) { quoteFixes++; v = fixed; }
    }
    if (/<[^a-zA-Z!]/.test(v)) {
      const fixed = v.replace(/<(?=[^a-zA-Z!])/g, '&lt;');
      if (fixed !== v) { autolinkFixes++; v = fixed; }
    }
    return v;
  });

  console.log(`[openapi] Sanitized: quotes=${quoteFixes}, autolinks=${autolinkFixes}`);

  mkdirSync(dirname(SANITIZED_SPEC_PATH), {recursive: true});
  writeFileSync(SANITIZED_SPEC_PATH, stringify(doc, {lineWidth: 0}));

  const sizeMb = (readFileSync(SANITIZED_SPEC_PATH).length / 1024 / 1024).toFixed(2);
  console.log(`[openapi] Wrote ${sizeMb} MB → ${SANITIZED_SPEC_PATH}`);
}

main();
