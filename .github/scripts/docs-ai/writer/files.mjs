import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {resolveAllowed} from './paths.mjs';

const BLOCK_RE = /```(?:\w+)?\s+path=([^\s`]+)\s*\n([\s\S]*?)\n```/g;

export const VERSION_ANCHOR_RE = /From Mattermost v\d+\.\d+/;
export const HUMAN_JUDGMENT_MARKER = '[NOT PRESENT — REQUIRES HUMAN JUDGMENT]';

export function parseFileBlocks(text) {
  const blocks = [];
  let m;
  const re = new RegExp(BLOCK_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    blocks.push({path: m[1].trim(), content: m[2]});
  }
  return blocks;
}

export function versionFromMilestone(title) {
  if (!title) return null;
  const m = String(title).match(/v(\d+\.\d+)/i);
  return m ? `v${m[1]}` : null;
}

export function hasVersionAnchor(content) {
  return VERSION_ANCHOR_RE.test(content) || content.includes(HUMAN_JUDGMENT_MARKER);
}

// Reject pages that document capability without an anchor when a milestone was supplied.
export function assertVersionAnchors(files, {milestoneVersion, required = true} = {}) {
  if (!required || !milestoneVersion) return;
  for (const f of files) {
    if (!hasVersionAnchor(f.content)) {
      throw new Error(
        `${f.path}: missing version anchor (expected "From Mattermost ${milestoneVersion}" or ${HUMAN_JUDGMENT_MARKER})`,
      );
    }
  }
}

export function writeFiles(repoRoot, files) {
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
