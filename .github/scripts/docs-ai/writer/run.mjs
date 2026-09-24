#!/usr/bin/env node
/*
 * Merged-PR writer entry point.
 *
 *   node writer/run.mjs
 *
 * Env:
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER
 *   REPO_ROOT (default cwd)
 *   Optional: PR_TITLE, PR_BODY_FILE, CODE_DIFF_FILE, MILESTONE_TITLE,
 *             GAP_COMMENT_FILE (skip GitHub sticky fetch), DRY_RUN=1
 *
 * Writes docs files into REPO_ROOT and emits:
 *   .docs-ai/writer/trail.json
 *   .docs-ai/writer/pr-body.md
 *   .docs-ai/writer/written.json
 */

import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {findStickyComment} from '../lib/github.mjs';
import {MARKER} from '../gap/gap.mjs';
import {REPO_ROOT as DEFAULT_ROOT} from '../lib/personas.mjs';
import {authorLoop, renderPrBody} from './author-loop.mjs';
import {versionFromMilestone, writeFiles} from './files.mjs';
import {briefFromGapResult, briefFromPrEvidence, parseGapBrief} from './gap-brief.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

function readPrEvidence() {
  const prBodyFile = process.env.PR_BODY_FILE;
  return {
    prTitle: process.env.PR_TITLE || '',
    prBody: prBodyFile && existsSync(prBodyFile) ? readFileSync(prBodyFile, 'utf8') : '',
  };
}

async function loadBrief({repo, pr}) {
  const file = arg('brief-file') || process.env.GAP_COMMENT_FILE;
  if (file) {
    const raw = readFileSync(file, 'utf8');
    // Accept either a sticky comment body or a clampResult JSON object.
    if (raw.trimStart().startsWith('{')) {
      return briefFromGapResult(JSON.parse(raw));
    }
    const brief = parseGapBrief(raw);
    if (!brief) throw new Error(`no gap sticky marker in ${file}`);
    return brief;
  }

  const sticky = await findStickyComment(repo, pr, {marker: MARKER});
  if (!sticky?.body) {
    console.error(
      `[writer] no docs-gap sticky on #${pr}; falling back to PR title/body/diff as the brief`,
    );
    return briefFromPrEvidence(readPrEvidence());
  }
  const brief = parseGapBrief(sticky.body);
  if (!brief) {
    console.error(`[writer] gap sticky on #${pr} unparseable; falling back to PR evidence`);
    return briefFromPrEvidence(readPrEvidence());
  }
  if (!brief.actions.length && !brief.targetPaths.length) {
    console.error(`[writer] gap sticky on #${pr} has no actions/paths; falling back to PR evidence`);
    return briefFromPrEvidence(readPrEvidence());
  }
  return brief;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const pr = process.env.PR_NUMBER || arg('pr');
  const repoRoot = process.env.REPO_ROOT || DEFAULT_ROOT;
  const outDir = join(repoRoot, '.docs-ai', 'writer');
  mkdirSync(outDir, {recursive: true});

  if (!repo || !pr) throw new Error('GITHUB_REPOSITORY and PR_NUMBER are required');

  const milestoneTitle = process.env.MILESTONE_TITLE || '';
  const milestoneVersion = versionFromMilestone(milestoneTitle);
  if (!milestoneVersion) {
    throw new Error('milestone title must contain vMAJOR.MINOR (version anchor source)');
  }

  const brief = await loadBrief({repo, pr});
  console.error(
    `[writer] assessment=${brief.assessment} actions=${brief.actions.length} paths=${brief.targetPaths.join(', ') || '(none)'}`,
  );

  const prBodyFile = process.env.PR_BODY_FILE;
  const codeDiffFile = process.env.CODE_DIFF_FILE;
  const input = {
    prTitle: process.env.PR_TITLE || '',
    prBody: prBodyFile && existsSync(prBodyFile) ? readFileSync(prBodyFile, 'utf8') : '',
    codeDiff: codeDiffFile && existsSync(codeDiffFile) ? readFileSync(codeDiffFile, 'utf8') : '',
    milestoneTitle,
    milestoneVersion,
    prUrl: `https://github.com/${repo}/pull/${pr}`,
  };

  const {files, trail} = await authorLoop({brief, input});

  writeFileSync(join(outDir, 'trail.json'), `${JSON.stringify(trail, null, 2)}\n`);
  const body = renderPrBody({sourcePr: pr, trail, brief});
  writeFileSync(join(outDir, 'pr-body.md'), body);

  if (process.env.DRY_RUN === '1') {
    writeFileSync(join(outDir, 'files.json'), `${JSON.stringify(files, null, 2)}\n`);
    console.error(`[writer] dry-run: ${files.length} file(s) not written`);
    return;
  }

  const written = writeFiles(repoRoot, files);
  writeFileSync(join(outDir, 'written.json'), `${JSON.stringify(written, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
