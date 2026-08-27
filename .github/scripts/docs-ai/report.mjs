#!/usr/bin/env node
import {readFileSync, readdirSync, existsSync, appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {upsertStickyComment} from './lib/github.mjs';

const MARKER = '<!-- docs-ai-review:v1 -->';

const ICON = {REQUEST_CHANGES: '⚠️', COMMENT: '💬', APPROVE: '✅', ERROR: '❗'};
const HEADING = {
  REQUEST_CHANGES: 'changes requested',
  COMMENT: 'comment',
  APPROVE: 'approved',
  ERROR: 'reviewer failed',
};
const ORDER = ['REQUEST_CHANGES', 'ERROR', 'COMMENT', 'APPROVE'];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

function loadResults(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || a.label.localeCompare(b.label));
}

function headline(results) {
  const counts = results.reduce((acc, r) => ({...acc, [r.verdict]: (acc[r.verdict] ?? 0) + 1}), {});
  const phrase = (n, singular, plural) => `${n} reviewer${n === 1 ? '' : 's'} ${n === 1 ? singular : plural}`;

  const parts = [];
  if (counts.REQUEST_CHANGES) parts.push(phrase(counts.REQUEST_CHANGES, 'requested changes', 'requested changes'));
  if (counts.COMMENT) parts.push(phrase(counts.COMMENT, 'commented', 'commented'));
  if (counts.APPROVE) parts.push(phrase(counts.APPROVE, 'approved', 'approved'));
  if (counts.ERROR) parts.push(phrase(counts.ERROR, 'failed to run', 'failed to run'));

  if (parts.length === 0) return 'No reviewers ran.';
  return `${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
}

function personaSection(r) {
  const lines = [`### ${ICON[r.verdict] ?? '💬'} ${r.label} — ${HEADING[r.verdict] ?? 'comment'}`, '', r.summary];
  if (r.feedback.length) {
    lines.push('', ...r.feedback.map((f) => `- ${f}`));
  }
  return lines.join('\n');
}

function buildComment({results, sha}) {
  const blocking = results.filter((r) => r.verdict !== 'APPROVE');
  const approved = results.filter((r) => r.verdict === 'APPROVE' && r.feedback.length === 0);
  const approvedWithNotes = results.filter((r) => r.verdict === 'APPROVE' && r.feedback.length > 0);

  const body = [MARKER, '## Docs review', '', headline(results), ''];

  for (const r of [...blocking, ...approvedWithNotes]) {
    body.push(personaSection(r), '');
  }

  if (approved.length) {
    body.push(
      '<details>',
      `<summary>✅ ${approved.length} reviewer${approved.length === 1 ? '' : 's'} approved with no findings</summary>`,
      '',
      ...approved.map((r) => `- **${r.label}** — ${r.summary}`),
      '',
      '</details>',
      '',
    );
  }

  const model = results[0]?.model ?? 'unknown';
  const meta = [sha ? `Reviewed \`${sha.slice(0, 7)}\`` : null, model].filter(Boolean).join(' · ');

  body.push('---', `<sub>Advisory only — nothing here blocks merge. ${meta}</sub>`);
  return body.join('\n');
}

async function main() {
  const results = loadResults(arg('results-dir') ?? 'out');
  if (results.length === 0) {
    console.error('[report] no persona results found; nothing to post');
    return;
  }

  const comment = buildComment({results, sha: arg('sha') ?? process.env.PR_HEAD_SHA});

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${comment}\n`);
  }

  if (process.argv.includes('--dry-run')) {
    process.stdout.write(`${comment}\n`);
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const pr = process.env.PR_NUMBER;
  if (!repo || !pr) throw new Error('GITHUB_REPOSITORY and PR_NUMBER are required');

  const {action, id} = await upsertStickyComment(repo, pr, {marker: MARKER, body: comment});
  console.error(`[report] ${action} comment ${id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
