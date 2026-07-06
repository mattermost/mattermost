#!/usr/bin/env node
// Generate book spines for each main-docs section from the Documentation
// sidebar config. One JSON per section under pdf/books/, consumable by
// build-book-pdf.mjs.
//
// Sources:
//   docs-site/sidebars/documentation.generated.json  (already authoritative)
//
// Outputs:
//   pdf/books/product-overview.json
//   pdf/books/use-case-guide.json
//   ... etc. (one per top-level section that exists)
//
// Usage: node pdf/scripts/gen-main-docs-books.mjs

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PDF_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(PDF_ROOT, '..');
const SIDEBAR = resolve(REPO_ROOT, 'docs-site/sidebars/documentation.generated.json');
const BOOKS_DIR = resolve(PDF_ROOT, 'books');

// Mapping from sidebar category label → book metadata (eyebrow/version).
// The label must match the top-level category's `label` in the sidebar JSON.
const BOOK_META = {
  'Product Overview': {
    file: 'product-overview',
    eyebrow: 'PRODUCT OVERVIEW',
    subtitle: 'Editions, plans, releases, and the platform at a glance.',
  },
  'Use Case Guide': {
    file: 'use-case-guide',
    eyebrow: 'USE CASES',
    subtitle: 'Mission-critical scenarios served by Mattermost.',
  },
  'Deployment Guide': {
    file: 'deployment-guide',
    eyebrow: 'DEPLOYMENT',
    subtitle: 'Plan, provision, and ship a production Mattermost deployment.',
  },
  'Administration Guide': {
    file: 'administration-guide',
    eyebrow: 'ADMINISTRATION',
    subtitle: 'Configure, manage, scale, secure, and comply.',
  },
  'Security Guide': {
    file: 'security-guide',
    eyebrow: 'SECURITY',
    subtitle: 'Security architecture, threat model, and hardening guidance.',
  },
  'End User Guide': {
    file: 'end-user-guide',
    eyebrow: 'END USER GUIDE',
    subtitle: 'Everything users need to know to collaborate in Mattermost.',
  },
  'Integrations Guide': {
    file: 'integrations-guide',
    eyebrow: 'INTEGRATIONS',
    subtitle: 'Bring your tools into Mattermost — from webhooks to platform plugins.',
  },
  'Get Help': {
    file: 'get-help',
    eyebrow: 'SUPPORT',
    subtitle: 'Channels for help, escalation, and feedback.',
  },
};

function collectDocIds(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) { node.forEach((n) => collectDocIds(n, out)); return out; }
  if (node.type === 'doc') out.push(node.id);
  if (node.type === 'category') {
    // Prepend the category's link if it points at a doc (the IA's landing
    // page for that branch — naturally first in print order).
    if (node.link && node.link.type === 'doc') out.push(node.link.id);
    if (node.items) collectDocIds(node.items, out);
  }
  return out;
}

function spineFromCategory(cat) {
  return collectDocIds(cat).map((id) => '/' + id.replace(/^\/+/, ''));
}

function getVersion() {
  // Try to read from a VERSION file or fall back to today's date.
  try {
    return readFileSync(resolve(REPO_ROOT, 'VERSION'), 'utf8').trim() || 'unreleased';
  } catch {
    return 'unreleased';
  }
}

function main() {
  const sidebar = JSON.parse(readFileSync(SIDEBAR, 'utf8'));
  mkdirSync(BOOKS_DIR, {recursive: true});
  const version = getVersion();

  let written = 0;
  for (const node of sidebar) {
    if (node.type !== 'category') continue;
    const meta = BOOK_META[node.label];
    if (!meta) continue;
    const spine = spineFromCategory(node);
    if (!spine.length) continue;
    const config = {
      title: `Mattermost ${node.label}`,
      subtitle: meta.subtitle,
      eyebrow: meta.eyebrow,
      version,
      spine,
    };
    const out = resolve(BOOKS_DIR, `${meta.file}.json`);
    writeFileSync(out, JSON.stringify(config, null, 2));
    console.log(`[book] ${out}  (${spine.length} pages)`);
    written++;
  }
  console.log(`\n[book] wrote ${written} book configs to ${BOOKS_DIR}`);
}

main();
