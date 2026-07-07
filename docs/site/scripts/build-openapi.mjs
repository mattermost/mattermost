#!/usr/bin/env node
/*
 * Bundles the Mattermost OpenAPI fragments into a single YAML document.
 *
 * Canonical source: mattermost/mattermost/api/v4/source/. The upstream
 * Makefile uses naive `cat` concatenation which produces *invalid* YAML
 * when fragments declare the same path key (currently
 * /api/v4/sharedchannels/{channel_id}/remotes lives in both
 * channels.yaml and sharedchannels.yaml). This script does a real
 * YAML parse + merge with last-wins semantics so the bundle validates.
 *
 * Skips:
 *   - The Go-based x-codeSamples extractor (we use the plugin's
 *     auto-generated curl/Go/Node/Python samples for now).
 *   - The Playbooks merge (separate spec; integrate later if needed).
 *
 * Usage:  node docs-site/scripts/build-openapi.mjs
 * Output: docs-site/openapi/mattermost-openapi-v4.yaml
 */

import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse, stringify} from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
// docs/site/ → docs/ → mattermost/ (monorepo root where api/v4/source lives)
const REPO_ROOT = resolve(SITE_ROOT, '../..');

const PRE_MERGE_PATH  = join(REPO_ROOT, 'sources/mattermost-api-source/api/v4/source');
const POST_MERGE_PATH = join(REPO_ROOT, 'api/v4/source');
const SOURCE_DIR = (existsSync(POST_MERGE_PATH) && readdirSync(POST_MERGE_PATH).some((f) => f.endsWith('.yaml')))
  ? POST_MERGE_PATH
  : PRE_MERGE_PATH;

const OUT = join(SITE_ROOT, 'openapi/mattermost-openapi-v4.yaml');

// Order matches the upstream Makefile build-v4 target. Order is significant
// because the openapi-docs plugin renders sidebar groups in tag order, and
// tags are first-seen in the file order.
const PATH_FRAGMENTS = [
  'users', 'status', 'teams', 'channels', 'posts', 'preferences', 'files',
  'recaps', 'ai', 'uploads', 'jobs', 'system', 'emoji', 'webhooks', 'saml',
  'compliance', 'ldap', 'groups', 'cluster', 'brand', 'commands', 'oauth',
  'elasticsearch', 'bleve', 'dataretention', 'plugins', 'roles', 'schemes',
  'service_terms', 'remoteclusters', 'sharedchannels', 'reactions', 'actions',
  'bots', 'cloud', 'usage', 'permissions', 'imports', 'exports', 'ip_filters',
  'bookmarks', 'views', 'reports', 'limits', 'logs',
  'outgoing_oauth_connections', 'metrics', 'scheduled_post',
  'custom_profile_attributes', 'audit_logging', 'access_control',
  'content_flagging', 'agents', 'properties',
];

function loadYaml(name) {
  const file = join(SOURCE_DIR, `${name}.yaml`);
  if (!existsSync(file)) {
    console.warn(`[openapi]   skip (missing): ${name}.yaml`);
    return null;
  }
  return parse(readFileSync(file, 'utf8'));
}

function mergePaths(base, fragment, fragmentName) {
  if (!fragment || typeof fragment !== 'object') return;
  for (const [pathKey, pathItem] of Object.entries(fragment)) {
    if (base[pathKey]) {
      console.warn(`[openapi]   duplicate path "${pathKey}" — overwritten by ${fragmentName}.yaml`);
    }
    base[pathKey] = pathItem;
  }
}

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

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`OpenAPI source not found at ${SOURCE_DIR}`);
    process.exit(1);
  }

  console.log(`[openapi] source: ${SOURCE_DIR}`);

  const intro = loadYaml('introduction');
  if (!intro) {
    console.error('introduction.yaml is required as the bundle base');
    process.exit(1);
  }
  // introduction.yaml ends with `paths:` (open). After parsing it yields
  // a doc whose paths key is null — initialize as empty object so we can
  // merge fragments into it.
  intro.paths = intro.paths ?? {};
  console.log(`[openapi] base: introduction.yaml (info, tags=${(intro.tags ?? []).length}, servers=${(intro.servers ?? []).length})`);

  let endpointCount = 0;
  for (const name of PATH_FRAGMENTS) {
    const frag = loadYaml(name);
    if (!frag) continue;
    const before = Object.keys(intro.paths).length;
    mergePaths(intro.paths, frag, name);
    const added = Object.keys(intro.paths).length - before;
    endpointCount += Object.keys(frag).length;
    console.log(`[openapi]   ${name.padEnd(28)} +${added.toString().padStart(3)} paths  (${Object.keys(frag).length} declared, ${Object.keys(frag).length - added} duplicates)`);
  }

  const defs = loadYaml('definitions');
  if (defs) {
    deepMerge(intro, defs);
    console.log(`[openapi] merged definitions.yaml (components.schemas: ${Object.keys(intro.components?.schemas ?? {}).length})`);
  }

  // Sanitize description text so docusaurus-plugin-openapi-docs writes
  // valid MDX/YAML.
  //   1) Embedded double-quotes break the plugin's `description: "..."`
  //      frontmatter (it discards the closing quote of `("")`).
  //      → replace inner `"..."` with curly quotes.
  //   2) Markdown autolinks like `</api/v4/foo>` break MDX (`</` is read
  //      as a JSX closing tag).
  //      → escape `<` not followed by a letter or `!` (so real HTML
  //         tags survive) to `&lt;`. Markdown decodes `&lt;` back to `<`
  //         in the rendered output.
  let quoteFixes = 0, autolinkFixes = 0;
  walkStrings(intro, (value, key) => {
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
  console.log(`[openapi] sanitized: quotes=${quoteFixes}, autolinks=${autolinkFixes}`);

  const totalPaths = Object.keys(intro.paths).length;
  const totalOperations = Object.values(intro.paths)
    .flatMap((p) => Object.keys(p ?? {}))
    .filter((k) => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(k))
    .length;

  const out = stringify(intro, {lineWidth: 0});
  mkdirSync(dirname(OUT), {recursive: true});
  writeFileSync(OUT, out);

  const sizeMb = (out.length / 1024 / 1024).toFixed(2);
  console.log(`[openapi] wrote ${OUT}`);
  console.log(`[openapi]   ${sizeMb} MB · ${totalPaths} unique paths · ${totalOperations} operations`);
}

main();
