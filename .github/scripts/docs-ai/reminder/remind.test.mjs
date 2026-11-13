import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  mentionsFor,
  mergedSince,
  parseLookbackDays,
  reminderBody,
  reminderMarker,
  remind,
  searchQuery,
} from './remind.mjs';

const REPO = 'mattermost/mattermost';
const TODAY = '2026-12-08';
const MARKER = reminderMarker(TODAY);

/** Fake GitHub: search results, per-PR comments, and writer docs PRs. */
function fakeGitHub({items, comments = {}, docsPrs = {}, mergedBy = {}}) {
  const posted = [];
  const request = async (path, {method = 'GET', body} = {}) => {
    if (path.startsWith('/search/issues')) return {items};
    const comment = path.match(/\/issues\/(\d+)\/comments/);
    if (comment && method === 'POST') {
      posted.push({pr: Number(comment[1]), body: body.body});
      return {id: posted.length};
    }
    if (comment) return comments[comment[1]] ?? [];
    const head = decodeURIComponent(path).match(/head=mattermost:docs\/pr-(\d+)/);
    if (head) return docsPrs[head[1]] ? [docsPrs[head[1]]] : [];
    const pull = path.match(/\/pulls\/(\d+)$/);
    if (pull) return {merged_by: mergedBy[pull[1]] ?? null};
    throw new Error(`unexpected request ${method} ${path}`);
  };
  return {request, posted};
}

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
  assert.equal(parseLookbackDays(''), 180);
  assert.equal(parseLookbackDays('30'), 30);
  assert.equal(parseLookbackDays('0'), 180);
  assert.equal(parseLookbackDays('abc'), 180);
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

  const done = await remind({repo: REPO, today: TODAY, lookbackDays: 180, request, log: () => {}});

  assert.deepEqual(done, [1, 3]);
  assert.deepEqual(posted.map((p) => p.pr), [1, 3]);
  assert.match(posted[0].body, /#99/);
});

test('an earlier round does not suppress this round', async () => {
  const {request, posted} = fakeGitHub({
    items: [pr(1)],
    comments: {1: [{user: {login: 'github-actions[bot]'}, body: reminderMarker('2026-11-08')}]},
  });
  await remind({repo: REPO, today: TODAY, lookbackDays: 180, request, log: () => {}});
  assert.equal(posted.length, 1);
});

test('remind skips the writer docs PRs themselves', async () => {
  const {request, posted} = fakeGitHub({items: [pr(5, 'app[bot]', {title: 'docs: AI draft for Foo'})]});
  await remind({repo: REPO, today: TODAY, lookbackDays: 180, request, log: () => {}});
  assert.equal(posted.length, 0);
});

test('dry run posts nothing', async () => {
  const {request, posted} = fakeGitHub({items: [pr(1)]});
  const done = await remind({repo: REPO, today: TODAY, lookbackDays: 180, dryRun: true, request, log: () => {}});
  assert.deepEqual(done, [1]);
  assert.equal(posted.length, 0);
});

test('a bot PR with no human assignee pings whoever merged it', async () => {
  const {request, posted} = fakeGitHub({
    items: [pr(7, 'cursor[bot]', {user: {login: 'cursor[bot]', type: 'Bot'}, assignees: []})],
    mergedBy: {7: {login: 'lead', type: 'User'}},
  });
  await remind({repo: REPO, today: TODAY, lookbackDays: 180, request, log: () => {}});
  assert.match(posted[0].body, /^@lead Reminder:/m);
});
