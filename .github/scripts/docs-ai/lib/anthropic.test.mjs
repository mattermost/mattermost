/*
 * Guards the two branchy parts of the Anthropic wrapper.
 *
 * parseJson stands between model output and a posted comment: models wrap JSON
 * in fences and prose whatever the prompt says, so the salvage paths run in
 * production and their behaviour needs pinning. withRetry decides whether a
 * failure costs one API call or three.
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseJson, withRetry} from './anthropic.mjs';

const VERDICT = {verdict: 'APPROVE', summary: 'Fine.', feedback: []};

const PARSEABLE = [
  ['bare JSON', JSON.stringify(VERDICT)],
  ['JSON with surrounding whitespace', `\n\n  ${JSON.stringify(VERDICT)}\n`],
  ['a json-tagged fence', `\`\`\`json\n${JSON.stringify(VERDICT)}\n\`\`\``],
  ['an untagged fence', `\`\`\`\n${JSON.stringify(VERDICT)}\n\`\`\``],
  ['a fence introduced by prose', `Here is my review:\n\`\`\`json\n${JSON.stringify(VERDICT)}\n\`\`\``],
  ['prose around unfenced JSON', `Verdict: ${JSON.stringify(VERDICT)} — hope that helps`],
];

for (const [name, text] of PARSEABLE) {
  test(`parses ${name}`, () => {
    assert.deepEqual(parseJson(text), VERDICT);
  });
}

test('parses a top-level array, as the router returns', () => {
  assert.deepEqual(parseJson('```json\n["end-user", "system-admin"]\n```'), [
    'end-user',
    'system-admin',
  ]);
});

test('the first fence wins when the model emits several', () => {
  const text = '```json\n{"verdict":"APPROVE"}\n```\nand an afterthought:\n```json\n{"verdict":"REQUEST_CHANGES"}\n```';
  assert.equal(parseJson(text).verdict, 'APPROVE');
});

test('unparseable output throws with a prefix of what came back', () => {
  assert.throws(() => parseJson('I would rather not produce JSON today.'), {
    message: /Could not parse JSON from model output: I would rather not/,
  });
});

test('an empty response throws rather than yielding undefined', () => {
  // A silent undefined here would surface much later, as a verdict with no
  // fields, and be reported as though the model had approved.
  assert.throws(() => parseJson(''), /Could not parse JSON/);
});

function counter(outcomes) {
  const calls = [];
  const waits = [];
  const fn = () => {
    calls.push(1);
    const outcome = outcomes[calls.length - 1];
    if (outcome instanceof Error) return Promise.reject(outcome);
    return Promise.resolve(outcome);
  };
  return {fn, calls, waits, wait: (ms) => (waits.push(ms), Promise.resolve())};
}

function apiError(status) {
  return Object.assign(new Error(`HTTP ${status}`), {status});
}

test('a call that succeeds is made once and never waits', async () => {
  const c = counter(['ok']);
  assert.equal(await withRetry(c.fn, {wait: c.wait}), 'ok');
  assert.equal(c.calls.length, 1);
  assert.deepEqual(c.waits, []);
});

test('a transient failure is retried and the result returned', async () => {
  for (const status of [429, 529, 500, 503]) {
    const c = counter([apiError(status), 'ok']);
    assert.equal(await withRetry(c.fn, {wait: c.wait}), 'ok', `status ${status}`);
    assert.equal(c.calls.length, 2, `status ${status}`);
    assert.equal(c.waits.length, 1, `status ${status}`);
  }
});

test('a client error is not retried', async () => {
  // Retrying a 400 or a 401 cannot help: it burns three calls and ~3.5s of
  // backoff per reviewer to arrive at the same failure.
  for (const status of [400, 401, 403, 404, 422]) {
    const c = counter([apiError(status), 'ok']);
    await assert.rejects(withRetry(c.fn, {wait: c.wait}), {status}, `status ${status}`);
    assert.equal(c.calls.length, 1, `status ${status}`);
    assert.deepEqual(c.waits, [], `status ${status}`);
  }
});

test('an error carrying no status is not retried', async () => {
  const c = counter([new TypeError('fetch failed')]);
  await assert.rejects(withRetry(c.fn, {wait: c.wait}), TypeError);
  assert.equal(c.calls.length, 1);
});

test('repeated transient failures give up after the attempt limit', async () => {
  const c = counter([apiError(503), apiError(503), apiError(503), 'ok']);
  await assert.rejects(withRetry(c.fn, {attempts: 3, wait: c.wait}), {status: 503});

  assert.equal(c.calls.length, 3);
  assert.equal(c.waits.length, 2, 'no wait after the final attempt');
});

test('backoff grows between attempts', async () => {
  const c = counter([apiError(429), apiError(429), 'ok']);
  await withRetry(c.fn, {wait: c.wait});

  assert.ok(c.waits[1] > c.waits[0], `${c.waits[1]} should exceed ${c.waits[0]}`);
});
