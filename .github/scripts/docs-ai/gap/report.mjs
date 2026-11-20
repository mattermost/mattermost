#!/usr/bin/env node
/*
 * Only writer of Docs/Needed. Comment before label: a bare label reads as
 * human-applied forever; state without a label re-applies on the next run.
 *
 *   node gap/report.mjs [--result-file <f>]
 *   node gap/report.mjs --dry-run [--result-file <f>] [--labels a,b] [--prior-state <json>]
 */

import {readFileSync, appendFileSync} from 'node:fs';
import {
  addLabel,
  createComment,
  findStickyComment,
  issueLabels,
  removeLabel,
  updateComment,
} from '../lib/github.mjs';
import {LABEL, MARKER, buildComment, buildFailureComment, clampResult, decide, parseState} from './gap.mjs';

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
    // Soft-fail: warn, leave the label, refresh an existing sticky only.
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

  try {
    if (decision.label === 'add') await addLabel(repo, pr, LABEL);
    if (decision.label === 'remove') await removeLabel(repo, pr, LABEL);
  } catch (e) {
    // Comment already wrote applied_by: null; leave the prior body so the next
    // run still sees a bot label and can retry the remove.
    if (decision.label === 'remove' && existing) {
      try {
        await updateComment(repo, existing.id, existing.body);
      } catch (restoreError) {
        console.error('[gap-report] failed to restore sticky state', restoreError);
      }
    }
    throw e;
  }

  return undefined;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
