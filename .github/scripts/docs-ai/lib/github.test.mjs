import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addLabel, issueLabels, removeLabel, upsertStickyComment} from './github.mjs';

const MARKER = '<!-- docs-ai-review:v1 -->';
const REPO = 'mattermost/mattermost';
const PR = '42';

const human = (id) => ({id, body: 'looks good to me', user: {type: 'User', login: 'reviewer'}});
const bot = (id) => ({id, body: `${MARKER}\n## Docs review`, user: {type: 'Bot', login: 'github-actions[bot]'}});

// A full page, so pagination continues past it.
const fullPage = (start) => Array.from({length: 100}, (_, i) => human(start + i));

function stub(pages) {
  const reads = [];
  const writes = [];
  const request = async (path, {method, body} = {}) => {
    if (method) {
      writes.push({path, method, body});
      return {id: 9001};
    }
    reads.push(path);
    const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
    return pages[page - 1] ?? [];
  };
  return {request, reads, writes};
}

test('updates the sticky comment when it sits beyond the first page', async () => {
  // The bug this guards: one page of comments was fetched and the search gave
  // up there, so a long review thread got a new comment on every push.
  const s = stub([fullPage(1), fullPage(101), [...fullPage(201).slice(0, 40), bot(500)]]);

  const result = await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.deepEqual(result, {action: 'updated', id: 500});
  assert.deepEqual(s.writes, [
    {path: `/repos/${REPO}/issues/comments/500`, method: 'PATCH', body: {body: 'fresh'}},
  ]);
  assert.equal(s.reads.length, 3);
});

test('stops reading pages once the sticky comment is found', async () => {
  const s = stub([[...fullPage(1).slice(0, 99), bot(7)], fullPage(101), fullPage(201)]);

  await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.equal(s.reads.length, 1, 'later pages cannot contain an earlier comment');
});

test('walks every page before concluding there is no comment to update', async () => {
  const s = stub([fullPage(1), fullPage(101), [human(201)]]);

  const result = await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.equal(result.action, 'created');
  assert.deepEqual(s.writes, [
    {path: `/repos/${REPO}/issues/${PR}/comments`, method: 'POST', body: {body: 'fresh'}},
  ]);
  assert.equal(s.reads.length, 3);
});

test('a short page ends the walk', async () => {
  const s = stub([[human(1), human(2)]]);

  await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.equal(s.reads.length, 1);
});

test('a comment count that is an exact multiple of the page size terminates', async () => {
  // GitHub answers the page past the end with [], and nothing in the response
  // says it was the last one — so the empty page is what stops the loop.
  const s = stub([fullPage(1)]);

  const result = await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.equal(result.action, 'created');
  assert.equal(s.reads.length, 2);
});

test('paginates from the first page in the documented page size', async () => {
  const s = stub([[human(1)]]);

  await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.equal(s.reads[0], `/repos/${REPO}/issues/${PR}/comments?per_page=100&page=1`);
});

test('a marker planted by a human is skipped on every page', async () => {
  // Pagination widens the search, so it also widens the reach of a planted
  // marker. The bot check has to hold on the later pages too.
  const planted = {id: 3, body: `${MARKER} overwrite me`, user: {type: 'User', login: 'attacker'}};
  const s = stub([[...fullPage(1).slice(0, 99), planted], [human(101), bot(500)]]);

  const result = await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.deepEqual(result, {action: 'updated', id: 500});
});

test('a human marker alone yields a new comment rather than an edit', async () => {
  const planted = {id: 3, body: `${MARKER} overwrite me`, user: {type: 'User', login: 'attacker'}};
  const s = stub([[human(1), planted]]);

  const result = await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.equal(result.action, 'created');
});

test('comments without a body do not throw', async () => {
  // The API omits body when the caller lacks permission to read it.
  const s = stub([[{id: 1, user: {type: 'User'}}, {id: 2, user: null}, bot(3)]]);

  const result = await upsertStickyComment(REPO, PR, {marker: MARKER, body: 'fresh', request: s.request});

  assert.deepEqual(result, {action: 'updated', id: 3});
});

test('labels come back as bare names', async () => {
  const request = async () => [{name: 'Docs/Needed', color: 'ededed'}, {name: 'release-note-none'}];

  assert.deepEqual(await issueLabels(REPO, PR, {request}), ['Docs/Needed', 'release-note-none']);
});

test('adding a label posts one name', async () => {
  const calls = [];
  const request = async (path, opts) => calls.push({path, ...opts});

  await addLabel(REPO, PR, 'Docs/Needed', {request});

  assert.deepEqual(calls, [
    {path: `/repos/${REPO}/issues/${PR}/labels`, method: 'POST', body: {labels: ['Docs/Needed']}},
  ]);
});

test('a label name with a slash is encoded into the delete path', async () => {
  // Unencoded, the slash reads as another path segment and the delete misses.
  const calls = [];
  const request = async (path, opts) => calls.push({path, ...opts});

  await removeLabel(REPO, PR, 'Docs/Needed', {request});

  assert.deepEqual(calls, [{path: `/repos/${REPO}/issues/${PR}/labels/Docs%2FNeeded`, method: 'DELETE'}]);
});

test('removing a label a human already removed is not an error', async () => {
  const request = async () => {
    throw new Error(`GitHub DELETE /x -> 404: {"message":"Label does not exist"}`);
  };

  await removeLabel(REPO, PR, 'Docs/Needed', {request});
});

test('any other failure to remove a label still throws', async () => {
  const request = async () => {
    throw new Error(`GitHub DELETE /x -> 403: {"message":"Resource not accessible"}`);
  };

  await assert.rejects(() => removeLabel(REPO, PR, 'Docs/Needed', {request}), /403/);
});
