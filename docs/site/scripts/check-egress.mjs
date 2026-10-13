#!/usr/bin/env node
// Fail the build when HTML/CSS/JS would fetch an off-origin resource.
// Closed allowlist: security-updates feed + docs.mattermost.com meta/canonical.

import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '..', 'build');

export const FEED_URL =
  'https://securityupdates.mattermost.com/security_updates.json';
export const DOCS_HOST = 'docs.mattermost.com';
export const EMPTY_BUILD_MESSAGE =
  'docs/site/build is missing or empty; run npm run build first';

// Hosted docs keep YouTube/Wistia players; build-offline-bundle.py strips them
// from the airgap tarball. Allowlisted so check-egress matches the public site.
const HOSTED_EMBED_BASES = [
  'youtube.com',
  'youtu.be',
  'wistia.com',
  'wistia.net',
];

const TEXT_EXT = new Set(['.html', '.css', '.js']);
// Attribute-name boundary: \b matches after - and :, so data-src / xlink:href
// must not count as src / href. Require whitespace, quote, or / before the name.
const ATTR =
  /(?<=[\s"'\/])(src|href|poster|data|srcset|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const CSS_URL =
  /(?:@import\s+(?:url\s*\()?['"]?(?:https?:)?\/\/[^'")\s]+)|(?:url\(\s*['"]?(?:https?:)?\/\/[^'")\s]+)/gi;
// Quoted URL, complete template literal, or template with a remote prefix
// before ${ (e.g. fetch(`https://api.example/${path}`)).
const JS_FETCH =
  /\b(?:fetch|import)\s*\(\s*(?:['"]((?:https?:)?\/\/[^'"]+)['"]|`((?:https?:)?\/\/(?:(?!\$\{)[^`])+)`|`((?:https?:)?\/\/[^`$]*)\$\{)/g;
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

const LOAD_RELS = new Set([
  'stylesheet',
  'preload',
  'modulepreload',
  'preconnect',
  'dns-prefetch',
  'prefetch',
  'prerender',
  'icon',
  'apple-touch-icon',
  'mask-icon',
  'manifest',
]);

const JSON_SCRIPT_TYPES = new Set([
  'application/json',
  'application/ld+json',
]);

export function isRemoteUrl(raw) {
  const t = String(raw ?? '').trim();
  if (!t) {
    return false;
  }
  if (
    t.startsWith('#') ||
    t.startsWith('data:') ||
    t.startsWith('blob:') ||
    t.startsWith('mailto:') ||
    t.startsWith('tel:')
  ) {
    return false;
  }
  return t.startsWith('https://') || t.startsWith('http://') || t.startsWith('//');
}

export function reportUrl(raw) {
  const t = String(raw).trim();
  return t.startsWith('//') ? `https:${t}` : t;
}

function isAllowedFeed(url) {
  return reportUrl(url) === FEED_URL;
}

function isAllowedDocsMeta(url) {
  const reported = reportUrl(url);
  if (!reported.startsWith('https://')) {
    return false;
  }
  try {
    return new URL(reported).hostname === DOCS_HOST;
  } catch {
    return false;
  }
}

function isHostedEmbedHost(host) {
  return HOSTED_EMBED_BASES.some(
    (base) => host === base || host.endsWith('.' + base),
  );
}

function isYoutubeHost(host) {
  return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be');
}

function isWistiaHost(host) {
  return (
    host === 'wistia.com' ||
    host.endsWith('.wistia.com') ||
    host === 'wistia.net' ||
    host.endsWith('.wistia.net')
  );
}

/** Allow only player tags/paths used by hosted docs embeds — not arbitrary host traffic. */
export function isAllowedHostedEmbed(url, kind) {
  let parsed;
  try {
    parsed = new URL(reportUrl(url));
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (!isHostedEmbedHost(host)) {
    return false;
  }
  const path = parsed.pathname;

  if (kind === 'iframe[src]') {
    if (isYoutubeHost(host) && path.startsWith('/embed/')) {
      return true;
    }
    if (isWistiaHost(host) && (path.startsWith('/embed/') || path.startsWith('/medias/'))) {
      return true;
    }
    return false;
  }
  if (kind === 'script[src]') {
    if (!isWistiaHost(host)) {
      return false;
    }
    return (
      path.startsWith('/assets/external/') ||
      (path.startsWith('/embed/medias/') && path.endsWith('.jsonp'))
    );
  }
  // Wistia MDX embed also emits <link rel=preload> for the swatch image.
  if (kind === 'img[src]' || kind === 'link[rel=preload]') {
    return isWistiaHost(host) && path.startsWith('/embed/medias/');
  }
  return false;
}

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function attrValue(match) {
  return match[2] ?? match[3] ?? match[4] ?? '';
}

function getAttr(tagOpen, name) {
  const re = new RegExp(
    `(?<=[\\s"'\\/])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );
  const m = tagOpen.match(re);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

function enclosingTag(html, attrIndex) {
  const start = html.lastIndexOf('<', attrIndex);
  if (start < 0) {
    return null;
  }
  const gt = html.indexOf('>', attrIndex);
  const raw = gt >= 0 ? html.slice(start, gt + 1) : html.slice(start);
  const tagMatch = raw.match(/^<\s*([a-zA-Z][\w:-]*)/);
  if (!tagMatch) {
    return null;
  }
  return {
    tag: tagMatch[1].toLowerCase(),
    rel: getAttr(raw, 'rel'),
    property: getAttr(raw, 'property'),
    name: getAttr(raw, 'name'),
    type: getAttr(raw, 'type'),
  };
}

function srcsetUrls(value) {
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function relKind(relRaw) {
  const rels = (relRaw || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (rels.includes('canonical')) {
    return 'canonical';
  }
  if (rels.includes('alternate')) {
    return 'skip';
  }
  if (rels.includes('shortcut') && rels.includes('icon')) {
    return 'link[rel=shortcut icon]';
  }
  const hit = rels.find((r) => LOAD_RELS.has(r));
  return hit ? `link[rel=${hit}]` : 'skip';
}

function htmlKind(tag, attr, ctx) {
  const t = tag;
  const a = attr.toLowerCase();

  if (t === 'a' || t === 'area') {
    return 'skip';
  }
  if (t === 'script' && a === 'src') {
    return 'script[src]';
  }
  if (t === 'link' && a === 'href') {
    return relKind(ctx.rel);
  }
  if (t === 'meta' && a === 'content') {
    const prop = (ctx.property || '').toLowerCase();
    const name = (ctx.name || '').toLowerCase();
    if (prop.startsWith('og:')) {
      return `meta[property=${prop}]`;
    }
    if (name.startsWith('twitter:')) {
      return `meta[name=${name}]`;
    }
    return 'skip';
  }
  if (t === 'img' && (a === 'src' || a === 'srcset')) {
    return `img[${a}]`;
  }
  if (t === 'source' && (a === 'src' || a === 'srcset')) {
    return `source[${a}]`;
  }
  if (t === 'video' && (a === 'src' || a === 'poster')) {
    return `video[${a}]`;
  }
  if (t === 'audio' && a === 'src') {
    return 'audio[src]';
  }
  if (t === 'track' && a === 'src') {
    return 'track[src]';
  }
  if (t === 'iframe' && a === 'src') {
    return 'iframe[src]';
  }
  if (t === 'embed' && a === 'src') {
    return 'embed[src]';
  }
  if (t === 'object' && a === 'data') {
    return 'object[data]';
  }
  return 'skip';
}

function pushViolation(violations, file, line, kind, found) {
  const url = reportUrl(found);
  if (isAllowedFeed(url) || isAllowedHostedEmbed(url, kind)) {
    return;
  }
  violations.push({file, line, kind, found: url});
}

function considerUrl(violations, file, line, kind, raw) {
  if (kind === 'skip' || !isRemoteUrl(raw)) {
    return;
  }
  if (kind === 'canonical' || kind.startsWith('meta[property=og') || kind.startsWith('meta[name=twitter')) {
    if (isAllowedDocsMeta(raw)) {
      return;
    }
    const reportedKind = kind === 'canonical' ? 'link[rel=canonical]' : kind;
    pushViolation(violations, file, line, reportedKind, raw);
    return;
  }
  pushViolation(violations, file, line, kind, raw);
}

function scanHtmlAttrs(html, file, violations) {
  ATTR.lastIndex = 0;
  let match;
  while ((match = ATTR.exec(html))) {
    const ctx = enclosingTag(html, match.index);
    if (!ctx) {
      continue;
    }
    const attr = match[1];
    const kind = htmlKind(ctx.tag, attr, ctx);
    const value = attrValue(match);
    const line = lineAt(html, match.index);
    if (attr.toLowerCase() === 'srcset') {
      for (const candidate of srcsetUrls(value)) {
        considerUrl(violations, file, line, kind, candidate);
      }
    } else {
      considerUrl(violations, file, line, kind, value);
    }
  }
}

function cssKind(matchText) {
  return /@import/i.test(matchText) ? 'css @import' : 'css url()';
}

function urlFromCssMatch(text) {
  const found = text.match(/((?:https?:)?\/\/[^'")\s]+)/);
  return found ? found[1] : text;
}

function scanCssIn(text, file, violations, fullFile, bodyStart) {
  CSS_URL.lastIndex = 0;
  let match;
  while ((match = CSS_URL.exec(text))) {
    const raw = urlFromCssMatch(match[0]);
    if (!isRemoteUrl(raw)) {
      continue;
    }
    const index = (bodyStart ?? 0) + match.index;
    const source = fullFile ?? text;
    pushViolation(violations, file, lineAt(source, index), cssKind(match[0]), raw);
  }
}

function scanJs(text, file, violations, fullFile, bodyStart) {
  JS_FETCH.lastIndex = 0;
  let match;
  while ((match = JS_FETCH.exec(text))) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (!isRemoteUrl(raw)) {
      continue;
    }
    const index = (bodyStart ?? 0) + match.index;
    const source = fullFile ?? text;
    const kind = match[0].trimStart().startsWith('import')
      ? 'import()'
      : 'fetch()';
    considerUrl(violations, file, lineAt(source, index), kind, raw);
  }
}

function isJsonScript(attrText) {
  const type = (getAttr(`<script ${attrText}>`, 'type') || '').toLowerCase();
  return JSON_SCRIPT_TYPES.has(type);
}

function hasSrc(attrText) {
  // Same attribute boundary as getAttr/ATTR — \b matches inside data-src.
  return getAttr(`<script ${attrText}>`, 'src') != null;
}

function scanHtml(html, file, violations) {
  scanHtmlAttrs(html, file, violations);

  STYLE_BLOCK.lastIndex = 0;
  let style;
  while ((style = STYLE_BLOCK.exec(html))) {
    const bodyStart = style.index + style[0].indexOf(style[1]);
    scanCssIn(style[1], file, violations, html, bodyStart);
  }

  SCRIPT_BLOCK.lastIndex = 0;
  let script;
  while ((script = SCRIPT_BLOCK.exec(html))) {
    if (hasSrc(script[1]) || isJsonScript(script[1])) {
      continue;
    }
    const bodyStart = script.index + script[0].indexOf(script[2]);
    scanJs(script[2], file, violations, html, bodyStart);
  }
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, {withFileTypes: true});
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(EMPTY_BUILD_MESSAGE);
    }
    throw err;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function extOf(file) {
  const base = file.toLowerCase();
  if (base.endsWith('.html')) {
    return '.html';
  }
  if (base.endsWith('.css')) {
    return '.css';
  }
  if (base.endsWith('.js')) {
    return '.js';
  }
  return '';
}

/** Scan in-memory sources. Keys are relative paths; values are file text. */
export function scanSources({html = {}, css = {}, js = {}} = {}) {
  const violations = [];
  const stats = {html: 0, css: 0, js: 0};

  for (const [file, text] of Object.entries(html)) {
    stats.html++;
    scanHtml(text, file, violations);
  }
  for (const [file, text] of Object.entries(css)) {
    stats.css++;
    if (text.includes('://') || text.includes('url(//')) {
      scanCssIn(text, file, violations, text, 0);
    }
  }
  for (const [file, text] of Object.entries(js)) {
    stats.js++;
    if (text.includes('fetch(') || text.includes('import(')) {
      scanJs(text, file, violations, text, 0);
    }
  }

  if (stats.html === 0) {
    throw new Error(EMPTY_BUILD_MESSAGE);
  }

  violations.stats = stats;
  return violations;
}

export function scanBuild(root) {
  const abs = resolve(root);
  try {
    if (!statSync(abs).isDirectory()) {
      throw new Error(EMPTY_BUILD_MESSAGE);
    }
  } catch (err) {
    if (err && err.message === EMPTY_BUILD_MESSAGE) {
      throw err;
    }
    if (err && err.code === 'ENOENT') {
      throw new Error(EMPTY_BUILD_MESSAGE);
    }
    throw err;
  }

  const html = {};
  const css = {};
  const js = {};

  for (const file of walk(abs)) {
    if (file.endsWith('.map')) {
      continue;
    }
    const ext = extOf(file);
    if (!TEXT_EXT.has(ext)) {
      continue;
    }
    const rel = relative(abs, file).split('\\').join('/');
    const text = readFileSync(file, 'utf8');
    if (ext === '.html') {
      html[rel] = text;
    } else if (ext === '.css') {
      css[rel] = text;
    } else {
      js[rel] = text;
    }
  }

  return scanSources({html, css, js});
}

function fixHint(kind, found) {
  if (
    kind.includes('preconnect') ||
    found.includes('fonts.googleapis.com') ||
    found.includes('fonts.gstatic.com')
  ) {
    return (
      'Fonts are already self-hosted in src/css/fonts.css; drop the tag\n' +
      '           from docusaurus.config.ts stylesheets/headTags.'
    );
  }
  if (kind === 'fetch()' || kind === 'import()') {
    return (
      'Remove the runtime fetch or, if it is the security bulletin, use\n' +
      `           exactly ${FEED_URL}`
    );
  }
  return 'Self-host the asset or remove the tag.';
}

export function formatReport(rootLabel, violations) {
  const {html, css, js} = violations.stats;
  if (violations.length === 0) {
    return `[check-egress] ok: ${html} html, ${css} css, ${js} js, 0 external loads\n`;
  }

  const lines = [
    `[check-egress] ${violations.length} external resource(s) in ${rootLabel} ` +
      `(scanned ${html} html, ${css} css, ${js} js).`,
    '',
    'A browser would fetch these. Self-host the asset or remove the tag.',
    'Do not add allowlist entries without a design review.',
    '',
  ];

  for (const v of violations) {
    lines.push(`  ${v.file}:${v.line}`);
    lines.push(`    kind:  ${v.kind}`);
    lines.push(`    found: ${v.found}`);
    lines.push(`    fix:   ${fixHint(v.kind, v.found)}`);
    lines.push('');
  }

  lines.push('Allowlisted (closed):');
  lines.push(`  - fetch ${FEED_URL}`);
  lines.push(
    `  - <link rel=canonical> and og:*/twitter:* meta on https://${DOCS_HOST}`,
  );
  lines.push('  - <a href> / <area href> (never fetched; includes editUrl)');
  lines.push(
    '  - YouTube/Wistia embeds (hosted site only; stripped in offline packaging)',
  );
  lines.push('');
  return lines.join('\n');
}

export function main(argv) {
  const root = argv[0] ? resolve(argv[0]) : DEFAULT_ROOT;
  const label = argv[0] ? relative(process.cwd(), root) || root : 'docs/site/build';
  let violations;
  try {
    violations = scanBuild(root);
  } catch (err) {
    console.error(`[check-egress] ${err.message}`);
    return 1;
  }
  const report = formatReport(label, violations);
  if (violations.length > 0) {
    console.error(report.replace(/\n$/, ''));
    return 1;
  }
  process.stdout.write(report);
  return 0;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  process.exit(main(process.argv.slice(2)));
}
