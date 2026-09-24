#!/usr/bin/env node
/*
 * When a docs/pr-<n> draft closes, flip Docs/Needed → Docs/Done on the source PR.
 *
 *   node writer/sync.mjs
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY, SOURCE_PR (or HEAD_REF / PR_BODY_FILE)
 */

import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {addLabel, removeLabel} from '../lib/github.mjs';

const NEEDED = 'Docs/Needed';
const DONE = 'Docs/Done';
const BRANCH_RE = /^docs\/pr-(\d+)$/;
const BODY_RE = /<!--\s*docs-ai-source-pr:(\d+)\s*-->/;

export function sourcePrFrom({headRef, body, explicit}) {
  if (explicit) return String(explicit);
  const fromBody = body?.match(BODY_RE);
  if (fromBody) return fromBody[1];
  const fromBranch = headRef?.match(BRANCH_RE);
  if (fromBranch) return fromBranch[1];
  return null;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is required');

  const bodyFile = process.env.PR_BODY_FILE;
  const body = bodyFile && existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : process.env.PR_BODY || '';
  const source = sourcePrFrom({
    headRef: process.env.HEAD_REF,
    body,
    explicit: process.env.SOURCE_PR,
  });

  if (!source) {
    throw new Error('could not resolve source PR from HEAD_REF, body marker, or SOURCE_PR');
  }

  console.error(`[sync] #${source}: ${NEEDED} → ${DONE}`);
  await removeLabel(repo, source, NEEDED);
  await addLabel(repo, source, DONE);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
