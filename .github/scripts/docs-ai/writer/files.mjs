import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {resolveAllowed} from './paths.mjs';

// Outer fence length must match so nested ``` code samples do not truncate the page.
const BLOCK_RE = /^(`{3,})(?:\w+)?[ \t]+path=([^\s`]+)[ \t]*\n([\s\S]*?)\n\1[ \t]*$/gm;

export const VERSION_ANCHOR_RE = /From Mattermost v\d+\.\d+/;
export const HUMAN_JUDGMENT_MARKER = '[NOT PRESENT — REQUIRES HUMAN JUDGMENT]';
/** Escape hatch when the release is unknown — keeps the "From Mattermost …" frame. */
export const HUMAN_JUDGMENT_VERSION_ANCHOR = `From Mattermost ${HUMAN_JUDGMENT_MARKER}`;

// Line-start import; capture module. Optional "X from" covers `import X from 'm'` and `import 'm'`.
const MDX_IMPORT_RE = /^import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]\s*;?\s*$/;
// Word boundary so `export{…}` / `export*` match, not only `export `.
const MDX_EXPORT_RE = /^export\b/;

/** Import sources AI-authored MDX may use. Everything else is rejected before write. */
const SAFE_IMPORT_RE =
  /^(?:@theme\/|@docusaurus\/|\.\.?\/).+$/;

/** Drop a trailing // comment so `import X from 'y'; // note` is still checked. */
function stripLineComment(line) {
  // Require whitespace before // so https:// inside a string is left alone.
  return line.replace(/\s+\/\/.*$/, '');
}

export function parseFileBlocks(text) {
  const blocks = [];
  let m;
  const re = new RegExp(BLOCK_RE);
  while ((m = re.exec(text)) !== null) {
    blocks.push({path: m[2].trim(), content: m[3]});
  }
  return blocks;
}

export function versionFromMilestone(title) {
  if (!title) return null;
  const m = String(title).match(/v(\d+\.\d+)/i);
  return m ? `v${m[1]}` : null;
}

export function hasVersionAnchor(content, version) {
  if (content.includes(HUMAN_JUDGMENT_VERSION_ANCHOR)) return true;
  if (version) return content.includes(`From Mattermost ${version}`);
  return VERSION_ANCHOR_RE.test(content);
}

// Reject pages that document capability without an anchor when a milestone was supplied.
export function assertVersionAnchors(files, {milestoneVersion, required = true} = {}) {
  if (!required || !milestoneVersion) return;
  for (const f of files) {
    if (!hasVersionAnchor(f.content, milestoneVersion)) {
      throw new Error(
        `${f.path}: missing version anchor (expected "From Mattermost ${milestoneVersion}" or "${HUMAN_JUDGMENT_VERSION_ANCHOR}")`,
      );
    }
  }
}

/** Drop fenced code samples so prose gates do not false-positive on examples. */
function withoutFencedCode(content) {
  return String(content).replace(/^(`{3,}).*?\n[\s\S]*?\n\1[ \t]*$/gm, '');
}

/**
 * Structural MDX gate before write: known import sources only, no export.
 * Line-based on fenced-stripped content (no MDX parser dependency). House-style
 * JSX is allowed; model protections + docs CI + human review cover the rest.
 */
export function assertSafeMdx(files) {
  for (const f of files) {
    const content = withoutFencedCode(f.content ?? '');
    for (const rawLine of content.split('\n')) {
      const line = stripLineComment(rawLine).trimEnd();
      if (!line) continue;
      if (MDX_EXPORT_RE.test(line)) {
        throw new Error(`${f.path}: MDX export statements are not allowed in AI drafts`);
      }
      const m = line.match(MDX_IMPORT_RE);
      if (m && !SAFE_IMPORT_RE.test(m[1])) {
        throw new Error(`${f.path}: disallowed MDX import source "${m[1]}"`);
      }
    }
  }
}

export function writeFiles(repoRoot, files) {
  assertSafeMdx(files);
  const written = [];
  for (const f of files) {
    const {abs, rel} = resolveAllowed(repoRoot, f.path);
    mkdirSync(dirname(abs), {recursive: true});
    const body = f.content.endsWith('\n') ? f.content : `${f.content}\n`;
    writeFileSync(abs, body);
    written.push({path: rel, bytes: body.length});
    console.error(`[writer] wrote ${rel} (${body.length} chars)`);
  }
  return written;
}

export function mergeFiles(existing, incoming) {
  const byPath = new Map(existing.map((f) => [f.path, f]));
  for (const f of incoming) byPath.set(f.path, f);
  return [...byPath.values()];
}
