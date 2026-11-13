#!/usr/bin/env node
/*
 * Remind authors of merged PRs that still carry Docs/Needed to finish their docs.
 *
 *   node reminder/remind.mjs [--dry-run]
 *
 * Env:
 *   GITHUB_TOKEN, GITHUB_REPOSITORY
 *   LOOKBACK_DAYS (default 45) — only PRs merged this recently
 *   REMINDER_DATE (default today, UTC) — names the reminder round
 *   DRY_RUN=1 — print what would be posted
 */

import {fileURLToPath} from 'node:url';
import {gh, issueComments, createComment} from '../lib/github.mjs';

const NEEDED = 'Docs/Needed';
const DONE = 'Docs/Done';
const PER_PAGE = 100;
// Comments post as github-actions[bot]; only trust our own markers.
const REMINDER_AUTHOR = 'github-actions[bot]';
export const DEFAULT_LOOKBACK_DAYS = 45;
// GitHub asks for at least a second between content-creating requests, and a
// minute's wait after a secondary rate limit response.
export const POST_INTERVAL_MS = 1000;
export const RATE_LIMIT_BACKOFF_MS = 60_000;
export const POST_RETRIES = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One marker per reminder round, so a re-run of the same day never double-posts. */
export function reminderMarker(date) {
  return `<!-- docs-needed-reminder:${date} -->`;
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function mergedSince(today, lookbackDays) {
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - lookbackDays);
  return isoDate(since);
}

export function parseLookbackDays(raw, fallback = DEFAULT_LOOKBACK_DAYS) {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function searchQuery(repo, since) {
  return [`repo:${repo}`, 'is:pr', 'is:merged', `label:"${NEEDED}"`, `-label:"${DONE}"`, `merged:>=${since}`].join(
    ' ',
  );
}

const isBot = (user) => user?.type === 'Bot' || String(user?.login ?? '').endsWith('[bot]');

/** Merged PRs still carrying Docs/Needed, minus the writer's own docs/pr-* PRs. */
export async function pendingPrs(repo, since, {request = gh} = {}) {
  const q = encodeURIComponent(searchQuery(repo, since));
  const prs = [];
  for (let page = 1; ; page++) {
    const res = await request(`/search/issues?q=${q}&per_page=${PER_PAGE}&page=${page}`);
    const items = res.items ?? [];
    prs.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return prs
    .filter((pr) => !/^docs: AI draft for /.test(pr.title ?? ''))
    .map((pr) => ({number: pr.number, title: pr.title, mentions: mentionsFor(pr)}));
}

/**
 * Who to ping: the author, or for a bot-authored PR (Cursor, Claude) the human
 * assignees who drove it. Empty when there is no human to ask.
 */
export function mentionsFor(pr) {
  if (pr.user && !isBot(pr.user)) return [pr.user.login];
  return [...new Set((pr.assignees ?? []).filter((u) => !isBot(u)).map((u) => u.login))];
}

/** Docs PR the merged-PR writer opened for this source PR, if any. */
export async function writerDocsPr(repo, number, {request = gh} = {}) {
  const owner = repo.split('/')[0];
  const head = encodeURIComponent(`${owner}:docs/pr-${number}`);
  const pulls = await request(`/repos/${repo}/pulls?head=${head}&state=all&per_page=1`);
  const pr = pulls?.[0];
  return pr ? {number: pr.number, merged: Boolean(pr.merged_at), state: pr.state} : null;
}

/** Last resort for a bot PR with no human assignee: whoever merged it. */
export async function mergerMention(repo, number, {request = gh} = {}) {
  const pull = await request(`/repos/${repo}/pulls/${number}`);
  return pull?.merged_by && !isBot(pull.merged_by) ? [pull.merged_by.login] : [];
}

export async function alreadyReminded(repo, number, marker, {request = gh} = {}) {
  for await (const c of issueComments(repo, number, {request})) {
    if (c.user?.login === REMINDER_AUTHOR && c.body?.includes(marker)) return true;
  }
  return false;
}

export function reminderBody({marker, mentions = [], docsPr}) {
  const greeting = mentions.length ? `${mentions.map((m) => `@${m}`).join(' ')} ` : '';
  const lines = [
    marker,
    `${greeting}Reminder: this PR still has the \`${NEEDED}\` label, so its documentation is not marked as done yet.`,
    '',
  ];
  if (docsPr && !docsPr.merged && docsPr.state === 'open') {
    lines.push(`A documentation PR is open for it: #${docsPr.number}. Please review, complete and merge it.`);
  } else {
    lines.push('Please submit and merge the documentation for this change.');
  }
  lines.push(
    '',
    `If the documentation is already merged, remove the \`${NEEDED}\` label and add \`${DONE}\` to this PR.`,
  );
  return `${lines.join('\n')}\n`;
}

export const isRateLimited = (e) => /-> (403|429):/.test(e?.message ?? '') && /rate limit/i.test(e.message);

/** Post one comment, backing off and retrying while GitHub answers with a rate limit. */
export async function postReminder(repo, number, body, {request = gh, sleep = wait, retries = POST_RETRIES, log = console.error} = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await createComment(repo, number, body, {request});
    } catch (e) {
      if (!isRateLimited(e) || attempt >= retries) throw e;
      const delay = RATE_LIMIT_BACKOFF_MS * 2 ** attempt;
      log(`[reminder] #${number}: rate limited, retrying in ${delay / 1000}s`);
      await sleep(delay);
    }
  }
}

export async function remind({
  repo,
  today,
  lookbackDays,
  dryRun = false,
  request = gh,
  sleep = wait,
  log = console.error,
}) {
  const marker = reminderMarker(today);
  const since = mergedSince(today, lookbackDays);
  const prs = await pendingPrs(repo, since, {request});
  log(`[reminder] ${prs.length} merged PR(s) since ${since} still carry ${NEEDED}`);

  const posted = [];
  const failed = [];
  let postedBefore = false;
  for (const pr of prs) {
    if (await alreadyReminded(repo, pr.number, marker, {request})) {
      log(`[reminder] #${pr.number}: already reminded for ${today}`);
      continue;
    }
    const docsPr = await writerDocsPr(repo, pr.number, {request});
    if (!pr.mentions.length) pr.mentions = await mergerMention(repo, pr.number, {request});
    const body = reminderBody({marker, mentions: pr.mentions, docsPr});
    const who = pr.mentions.map((m) => `@${m}`).join(' ') || '(no human to mention)';
    if (dryRun) {
      log(`[reminder] dry-run #${pr.number} ${who}:\n${body}`);
    } else {
      if (postedBefore) await sleep(POST_INTERVAL_MS);
      postedBefore = true;
      try {
        await postReminder(repo, pr.number, body, {request, sleep, log});
      } catch (e) {
        log(`[reminder] #${pr.number}: could not post reminder: ${e.message}`);
        failed.push(pr.number);
        continue;
      }
      log(`[reminder] #${pr.number}: reminded ${who}`);
    }
    posted.push(pr.number);
  }
  return {posted, failed};
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is required');
  const today = process.env.REMINDER_DATE || isoDate(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`REMINDER_DATE must be YYYY-MM-DD (got "${today}")`);
  const {posted, failed} = await remind({
    repo,
    today,
    lookbackDays: parseLookbackDays(process.env.LOOKBACK_DAYS),
    dryRun: process.env.DRY_RUN === '1' || process.argv.includes('--dry-run'),
  });
  console.error(`[reminder] ${posted.length} reminder(s) ${process.env.DRY_RUN === '1' ? 'would be ' : ''}posted`);
  if (failed.length) {
    console.error(`[reminder] ${failed.length} reminder(s) not posted: ${failed.map((n) => `#${n}`).join(' ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
