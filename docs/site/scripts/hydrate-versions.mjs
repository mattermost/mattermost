#!/usr/bin/env node
/*
 * Branch-per-version hydration script.
 *
 * Reads docs-site/versions.yaml, then for each entry in versions[]:
 *   1. Adds a git worktree at /tmp/mm-docs-versions/<id> on the version's branch.
 *   2. rsyncs ../docs/, ../develop/, ../api/ from the worktree into the
 *      docusaurus versioned_docs folders that the multi-instance plugins expect.
 *   3. Generates versions.json files per Docusaurus instance from the manifest.
 *
 * Run before `docusaurus build` in production CI. Skipped in dev unless
 * MM_HYDRATE=1 is set (dev usually only needs master).
 *
 * Hydrated paths are .gitignored — they are build artifacts.
 *
 * Usage:
 *   node docs-site/scripts/hydrate-versions.mjs
 *
 * See PLAN.md §5.3 for the full pipeline description.
 */

import {execFileSync} from 'node:child_process';
import {readFileSync, mkdirSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse as parseYaml} from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');                       // docs-site/
const REPO_ROOT = resolve(SITE_ROOT, '..');                  // workspace root
const MANIFEST_PATH = join(SITE_ROOT, 'versions.yaml');
const WORKTREE_BASE = '/tmp/mm-docs-versions';

// Each Docusaurus content instance → which content folder it consumes,
// and where the versioned snapshots get hydrated.
const INSTANCES = [
  {id: 'documentation', contentDir: 'docs',    versionedDir: 'versioned_docs'},
  {id: 'developers',    contentDir: 'develop', versionedDir: 'versioned_developers'},
  {id: 'api',           contentDir: 'api',     versionedDir: 'versioned_api'},
];

// execFileSync wrapper — no shell, args passed as array (no injection surface).
function run(file, args, opts = {}) {
  return execFileSync(file, args, {stdio: 'inherit', ...opts});
}

// Validate that a string is a safe git ref name. Manifest is committed code
// reviewed by humans, but defensive validation keeps the surface zero.
function assertSafeRef(name) {
  if (!/^[A-Za-z0-9._/\-]{1,200}$/.test(name)) {
    throw new Error(`unsafe ref name: ${JSON.stringify(name)}`);
  }
}

function assertSafeId(name) {
  if (!/^[A-Za-z0-9._\-]{1,40}$/.test(name)) {
    throw new Error(`unsafe version id: ${JSON.stringify(name)}`);
  }
}

function loadManifest() {
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  const m = parseYaml(raw);
  if (!m.versions || !Array.isArray(m.versions)) {
    throw new Error('versions.yaml: missing or invalid versions[] array');
  }
  return m;
}

function hydrateVersion(entry) {
  assertSafeId(entry.id);
  assertSafeRef(entry.branch);

  if (entry.branch === 'master' || entry.branch === 'HEAD') {
    console.log(`[hydrate] ${entry.id}: master → using working tree directly`);
    return;
  }

  const worktreePath = join(WORKTREE_BASE, entry.id);
  console.log(`[hydrate] ${entry.id}: ${entry.branch} → ${worktreePath}`);

  if (existsSync(worktreePath)) {
    run('git', ['-C', REPO_ROOT, 'fetch', 'origin', entry.branch]);
    run('git', ['-C', worktreePath, 'reset', '--hard', `origin/${entry.branch}`]);
  } else {
    mkdirSync(WORKTREE_BASE, {recursive: true});
    run('git', ['-C', REPO_ROOT, 'fetch', 'origin', entry.branch]);
    run('git', ['-C', REPO_ROOT, 'worktree', 'add', worktreePath, `origin/${entry.branch}`]);
  }

  for (const inst of INSTANCES) {
    const src = join(worktreePath, inst.contentDir) + '/';
    const dst = join(SITE_ROOT, inst.versionedDir, `version-${entry.id}`);
    if (!existsSync(join(worktreePath, inst.contentDir))) {
      console.warn(`[hydrate]   ${inst.id}: source ${src} missing on ${entry.branch}, skipping`);
      continue;
    }
    rmSync(dst, {recursive: true, force: true});
    mkdirSync(dst, {recursive: true});
    run('rsync', ['-a', '--delete', src, `${dst}/`]);
    console.log(`[hydrate]   ${inst.id}: ${dst}`);
  }
}

function writeDocusaurusVersionFiles(manifest) {
  // Each Docusaurus content instance reads its versions.json to know
  // which versions exist. We generate it from the manifest.
  const liveIds = manifest.versions
    .filter((v) => v.branch !== 'master' && v.visibility !== 'hidden')
    .map((v) => v.id);

  for (const inst of INSTANCES) {
    const path = join(SITE_ROOT, `${inst.versionedDir}.json`);
    writeFileSync(path, JSON.stringify(liveIds, null, 2) + '\n');
    console.log(`[hydrate] wrote ${path} → ${JSON.stringify(liveIds)}`);
  }
}

function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`error: manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }
  const manifest = loadManifest();
  console.log(`[hydrate] default=${manifest.default} versions=${manifest.versions.map((v) => v.id).join(',')}`);

  for (const entry of manifest.versions) {
    hydrateVersion(entry);
  }

  writeDocusaurusVersionFiles(manifest);
  console.log('[hydrate] done');
}

main();
