/*
 * Path allow/deny for AI-authored content. Deny wins.
 * docs/api/reference/ is OpenAPI-generated and must never be hand-authored.
 */

import {isAbsolute, relative, resolve} from 'node:path';

export const ALLOW_PREFIXES = ['docs/main/', 'docs/develop/'];
export const ALLOW_EXACT = ['docs/api/examples.mdx', 'docs/api/index.mdx'];
export const DENY_PREFIXES = [
  'docs/site/',
  'docs/styles/',
  'docs/pdf/',
  'docs/vendor/',
  'docs/api/reference/',
  'docs/main/agents/docs/',
];

// Paths the gap prompt and sticky comment are allowed to name.
export const DOCS_PATH_RE =
  /docs\/(?:main|develop)\/[A-Za-z0-9_./-]+\.(?:mdx|md)|docs\/api\/(?:examples|index)\.mdx/g;

export function extractDocsPaths(text) {
  if (!text) return [];
  const found = String(text).match(DOCS_PATH_RE) ?? [];
  return [...new Set(found)];
}

export function isAllowedPath(relPath) {
  const rel = relPath.replace(/^\.\//, '');
  if (rel.startsWith('/') || rel.includes('\0') || rel.includes('..')) return false;
  if (DENY_PREFIXES.some((p) => rel.startsWith(p))) return false;
  if (ALLOW_EXACT.includes(rel)) return true;
  return ALLOW_PREFIXES.some((p) => rel.startsWith(p));
}

export function resolveAllowed(repoRoot, relPath) {
  const abs = resolve(repoRoot, relPath);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`refusing to write outside repo root: ${relPath}`);
  }
  if (!isAllowedPath(rel)) {
    throw new Error(`refusing to write outside content allowlist: ${rel}`);
  }
  return {abs, rel};
}
