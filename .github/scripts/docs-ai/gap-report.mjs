#!/usr/bin/env node
/*
 * The only writer of the Docs/Needed label.
 *
 * Reads the assessment, reads back the state this script recorded on its own
 * sticky comment last time, then decides. Comment first, label second: if the
 * label write fails the next run sees state without a label and re-applies it,
 * whereas a label written without state would read as human-applied forever.
 *
 *   node gap-report.mjs [--result-file <f>]
 *   node gap-report.mjs --dry-run [--result-file <f>] [--labels a,b] [--prior-state <json>]
 *
 * --dry-run renders the comment to stdout and touches nothing. It takes the
 * labels and the prior state as arguments because there is no pull request to
 * read them from, which is how each branch of the lifecycle is checked locally.
 */

import {readFileSync, appendFileSync} from 'node:fs';
import {
  addLabel,
  createComment,
  findStickyComment,
  issueLabels,
  removeLabel,
  updateComment,
} from './lib/github.mjs';
import {LABEL, MARKER, buildComment, buildFailureComment, clampResult, decide, parseState} from './lib/gap.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const DRY_RUN = process.argv.includes('--dry-run');

function readResult() {
  const file = arg('result-file');
  const raw = file ? readFileSync(file, 'utf8') : process.env.GAP_RESULT;

  if (process.env.GAP_OUTCOME && process.env.GAP_OUTCOME !== 'success') {
    throw new Error(`analysis step reported "${process.env.GAP_OUTCOME}"`);
  }
  if (!raw?.trim()) {
    throw new Error('analysis produced no structured output');
  }
  return clampResult(raw);
}

function emit(comment) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${comment}\n`);
  }
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const pr = process.env.PR_NUMBER;
  const sha = process.env.PR_HEAD_SHA;
  const runUrl = process.env.RUN_URL;

  if (!DRY_RUN && (!repo || !pr)) {
    throw new Error('GITHUB_REPOSITORY and PR_NUMBER are required');
  }

  const labels = DRY_RUN
    ? (arg('labels') ?? '').split(',').map((l) => l.trim()).filter(Boolean)
    : await issueLabels(repo, pr);
  const existing = DRY_RUN ? null : await findStickyComment(repo, pr, {marker: MARKER});
  const priorState = DRY_RUN ? JSON.parse(arg('prior-state') ?? 'null') : parseState(existing?.body);

  let result;
  try {
    result = readResult();
  } catch (e) {
    // Advisory automation: a model or API outage should not turn every check in
    // the repository red, and it must not open a comment on a pull request that
    // never had one. It warns, leaves the label alone, and refreshes an
    // existing comment so a stale verdict is not read as current.
    console.error(`::warning title=Docs gap analysis::${e.message}`);
    const comment = buildFailureComment({priorState, runUrl});
    emit(comment);
    if (DRY_RUN) return process.stdout.write(`${comment}\n`);
    if (existing) await updateComment(repo, existing.id, comment);
    return undefined;
  }

  const decision = decide({assessment: result.assessment, labels, priorState});
  if (decision.skip) {
    console.error(`[gap-report] ${decision.skip} is applied; leaving the label and comment alone`);
    return undefined;
  }

  const comment = buildComment({result, decision, sha, runUrl});
  emit(comment);
  console.error(`[gap-report] ${result.assessment} -> label ${decision.label}`);

  if (DRY_RUN) return process.stdout.write(`${comment}\n`);

  if (existing) {
    await updateComment(repo, existing.id, comment);
  } else if (decision.create) {
    await createComment(repo, pr, comment);
  }

  if (decision.label === 'add') await addLabel(repo, pr, LABEL);
  if (decision.label === 'remove') await removeLabel(repo, pr, LABEL);

  return undefined;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
