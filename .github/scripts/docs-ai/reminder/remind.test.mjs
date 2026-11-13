import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  mentionsFor,
  mergedSince,
  parseLookbackDays,
  postReminder,
  rateLimitDelay,
  reminderBody,
  reminderMarker,
  remind,
  searchQuery,
} from './remind.mjs';

const REPO = 'mattermost/mattermost';
const TODAY = '2026-12-08';
const MARKER = reminderMarker(TODAY);

/** Fake GitHub: search results, per-PR comments, and writer docs PRs. */
function fakeGitHub({items, comments = {}, docsPrs = {}, mergedBy = {}, heads = {}, postErrors = {}}) {
  const posted = [];
  const request = async (path, {method = 'GET', body} = {}) => {
    if (path.startsWith('/search/issues')) return {items};
    const comment = path.match(/\/issues\/(\d+)\/comments/);
    if (comment && method === 'POST') {
      const queued = postErrors[comment[1]];
      if (queued?.length) {
        const next = queued.shift();
        throw typeof next === 'string' ? new Error(next) : Object.assign(new Error(next.message), next);
      }
      posted.push({pr: Number(comment[1]), body: body.body});
      return {id: posted.length};
    }
    if (comment) return comments[comment[1]] ?? [];
    const head = decodeURIComponent(path).match(/head=mattermost:docs\/pr-(\d+)/);
    if (head) return docsPrs[head[1]] ? [docsPrs[head[1]]] : [];
    const pull = path.match(/\/pulls\/(\d+)$/);
    if (pull) return {head: {ref: heads[pull[1]] ?? `feature-${pull[1]}`}, merged_by: mergedBy[pull[1]] ?? null};
    throw new Error(`unexpected request ${method} ${path}`);
  };
  return {request, posted};
}

const noSleep = async () => {};
const RATE_LIMITED = 'GitHub POST /repos/x/issues/1/comments -> 403: {"message":"You have exceeded a secondary rate limit"}';

const pr = (number, login = 'dev', extra = {}) => ({number, title: `Change ${number}`, user: {login, type: 'User'}, ...extra});

test('searchQuery targets merged PRs that still carry Docs/Needed without Docs/Done', () => {
  assert.equal(
    searchQuery(REPO, '2026-06-11'),
    'repo:mattermost/mattermost is:pr is:merged label:"Docs/Needed" -label:"Docs/Done" merged:>=2026-06-11',
  );
});

test('mergedSince counts back whole days in UTC', () => {
  assert.equal(mergedSince('2026-12-08', 180), '2026-06-11');
  assert.equal(mergedSince('2026-03-01', 1), '2026-02-28');
});

test('parseLookbackDays accepts positive integers only', () => {
  assert.equal(parseLookbackDays(''), 45);
  assert.equal(parseLookbackDays('30'), 30);
  assert.equal(parseLookbackDays('0'), 45);
  assert.equal(parseLookbackDays('abc'), 45);
});

test('reminderBody asks the author to submit and merge docs, or swap the label when done', () => {
  const body = reminderBody({marker: MARKER, mentions: ['dev'], docsPr: null});
  assert.ok(body.startsWith(MARKER));
  assert.match(body, /@dev /);
  assert.match(body, /submit and merge the documentation/);
  assert.match(body, /remove the `Docs\/Needed` label and add `Docs\/Done`/);
});

test('reminderBody points at an open writer docs PR', () => {
  const body = reminderBody({marker: MARKER, mentions: ['dev'], docsPr: {number: 42, merged: false, state: 'open'}});
  assert.match(body, /documentation PR is open for it: #42/);
});

test('mentionsFor pings a human author, or the human assignees of a bot-authored PR', () => {
  assert.deepEqual(mentionsFor({user: {login: 'dev', type: 'User'}, assignees: [{login: 'x', type: 'User'}]}), ['dev']);
  assert.deepEqual(
    mentionsFor({
      user: {login: 'cursor[bot]', type: 'Bot'},
      assignees: [{login: 'lead', type: 'User'}, {login: 'helper[bot]', type: 'Bot'}],
    }),
    ['lead'],
  );
  assert.deepEqual(mentionsFor({user: {login: 'cursor', type: 'Bot'}, assignees: []}), []);
});

test('reminderBody mentions nobody when there is no human to ask', () => {
  const body = reminderBody({marker: MARKER, mentions: [], docsPr: null});
  assert.doesNotMatch(body, /@/);
  assert.match(body, /^Reminder:/m);
});

test('remind comments once per PR per round and skips PRs already reminded', async () => {
  const {request, posted} = fakeGitHub({
    items: [pr(1), pr(2, 'other'), pr(3)],
    comments: {
      2: [{user: {login: 'github-actions[bot]'}, body: `${MARKER}\nold`}],
      3: [{user: {login: 'someone'}, body: `${MARKER}\nforged`}],
    },
    docsPrs: {1: {number: 99, merged_at: null, state: 'open'}},
  });

  const {posted: done} = await remind({repo: REPO, today: TODAY, lookbackDays: 45, request, sleep: noSleep, log: () => {}});

  assert.deepEqual(done, [1, 3]);
  assert.deepEqual(posted.map((p) => p.pr), [1, 3]);
  assert.match(posted[0].body, /#99/);
});

test('an earlier round does not suppress this round', async () => {
  const {request, posted} = fakeGitHub({
    items: [pr(1)],
    comments: {1: [{user: {login: 'github-actions[bot]'}, body: reminderMarker('2026-11-08')}]},
  });
  await remind({repo: REPO, today: TODAY, lookbackDays: 45, request, sleep: noSleep, log: () => {}});
  assert.equal(posted.length, 1);
});

test('remind skips the writer docs PRs themselves, whatever their title', async () => {
  const {request, posted} = fakeGitHub({
    items: [pr(5, 'app[bot]', {title: 'Renamed by a human'}), pr(6, 'dev', {title: 'docs: AI draft for a human PR'})],
    heads: {5: 'docs/pr-4'},
  });
  await remind({repo: REPO, today: TODAY, lookbackDays: 45, request, sleep: noSleep, log: () => {}});
  assert.deepEqual(posted.map((p) => p.pr), [6]);
});

test('dry run posts nothing', async () => {
  const {request, posted} = fakeGitHub({items: [pr(1)]});
  const {posted: done} = await remind({repo: REPO, today: TODAY, lookbackDays: 45, dryRun: true, request, log: () => {}});
  assert.deepEqual(done, [1]);
  assert.equal(posted.length, 0);
});

test('a bot PR with no human assignee pings whoever merged it', async () => {
  const {request, posted} = fakeGitHub({
    items: [pr(7, 'cursor[bot]', {user: {login: 'cursor[bot]', type: 'Bot'}, assignees: []})],
    mergedBy: {7: {login: 'lead', type: 'User'}},
  });
  await remind({repo: REPO, today: TODAY, lookbackDays: 45, request, sleep: noSleep, log: () => {}});
  assert.match(posted[0].body, /^@lead Reminder:/m);
});

test('remind paces comment posts and leaves dry runs unpaced', async () => {
  const sleeps = [];
  const sleep = async (ms) => sleeps.push(ms);
  const {request} = fakeGitHub({items: [pr(1), pr(2), pr(3)]});
  await remind({repo: REPO, today: TODAY, lookbackDays: 45, request, sleep, log: () => {}});
  assert.deepEqual(sleeps, [1000, 1000]);

  sleeps.length = 0;
  await remind({repo: REPO, today: TODAY, lookbackDays: 45, dryRun: true, request, sleep, log: () => {}});
  assert.deepEqual(sleeps, []);
});

test('postReminder backs off and retries while rate limited', async () => {
  const sleeps = [];
  const {request, posted} = fakeGitHub({items: [], postErrors: {1: [RATE_LIMITED, RATE_LIMITED]}});
  await postReminder(REPO, 1, 'hi', {request, sleep: async (ms) => sleeps.push(ms), log: () => {}});
  assert.deepEqual(sleeps, [60_000, 120_000]);
  assert.equal(posted.length, 1);
});

test('postReminder does not retry other errors', async () => {
  const sleeps = [];
  const {request} = fakeGitHub({items: [], postErrors: {1: ['GitHub POST x -> 404: Not Found']}});
  await assert.rejects(
    postReminder(REPO, 1, 'hi', {request, sleep: async (ms) => sleeps.push(ms), log: () => {}}),
    /404/,
  );
  assert.deepEqual(sleeps, []);
});

test('remind keeps going past a PR whose comment cannot be posted and reports it', async () => {
  const {request, posted} = fakeGitHub({
    items: [pr(1), pr(2), pr(3)],
    postErrors: {2: [RATE_LIMITED, RATE_LIMITED, RATE_LIMITED, RATE_LIMITED]},
  });
  const sleeps = [];
  const sleep = async (ms) => sleeps.push(ms);
  const result = await remind({repo: REPO, today: TODAY, lookbackDays: 45, request, sleep, log: () => {}});
  assert.deepEqual(result, {posted: [1, 3], failed: [2]});
  // pacing, three retries, a final wait before moving on, pacing
  assert.deepEqual(sleeps, [1000, 60_000, 120_000, 240_000, 480_000, 1000]);
  assert.deepEqual(posted.map((p) => p.pr), [1, 3]);
});

test('rateLimitDelay honours Retry-After, then x-ratelimit-reset, then the one-minute fallback', () => {
  const now = 1_700_000_000_000;
  assert.equal(rateLimitDelay({headers: {'retry-after': '30'}}, 0, now), 30_000);
  assert.equal(
    rateLimitDelay({headers: {'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 120)}}, 0, now),
    121_000,
  );
  assert.equal(rateLimitDelay({headers: {}}, 0, now), 60_000);
  assert.equal(rateLimitDelay({headers: {}}, 2, now), 240_000);
});

test('postReminder waits for the Retry-After a rate-limited response names', async () => {
  const sleeps = [];
  const {request, posted} = fakeGitHub({
    items: [],
    postErrors: {1: [{message: 'GitHub POST x -> 429: slow down', status: 429, headers: {'retry-after': '7'}}]},
  });
  await postReminder(REPO, 1, 'hi', {request, sleep: async (ms) => sleeps.push(ms), log: () => {}});
  assert.deepEqual(sleeps, [7000]);
  assert.equal(posted.length, 1);
});
