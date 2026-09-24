#!/usr/bin/env node
/*
 * When a docs/pr-<n> draft closes, flip Docs/Needed → Docs/Done on the source PR.
 *
 *   node writer/sync.mjs
 *
 * Env:
 *   GITHUB_TOKEN, GITHUB_REPOSITORY
 *   HEAD_REPO, PR_USER — trusted pull_request event fields (provenance)
 *   DOCS_AI_BOT_LOGIN — exact App bot login that opened the draft
 *   SOURCE_PR or HEAD_REF / PR_BODY_FILE — resolve which source PR to update
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

/** Provenance from trusted event metadata only — not branch name, body, or labels. */
export function assertWriterProvenance({repo, headRepo, prUser, botLogin}) {
  if (!repo) throw new Error('GITHUB_REPOSITORY is required');
  if (!headRepo || headRepo !== repo) {
    throw new Error(`refusing sync: head repo "${headRepo || '(missing)'}" is not ${repo}`);
  }
  if (!botLogin) {
    throw new Error('DOCS_AI_BOT_LOGIN is required to verify writer provenance');
  }
  if (!prUser || prUser !== botLogin) {
    throw new Error(`refusing sync: PR author "${prUser || '(missing)'}" is not ${botLogin}`);
  }
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  assertWriterProvenance({
    repo,
    headRepo: process.env.HEAD_REPO,
    prUser: process.env.PR_USER,
    botLogin: process.env.DOCS_AI_BOT_LOGIN,
  });

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
