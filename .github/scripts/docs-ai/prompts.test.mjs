/*
 * Guards the prose of the shared prompts in .github/prompts/.
 *
 * These assert on editorial content, not on code: they fail when someone edits
 * conventions.md or review-contract.md, not when the loader changes. Every rule
 * below is stated in exactly one place and enforced by no linter, so a section
 * deleted in an edit degrades the review silently — the personas keep running
 * and simply stop checking for it.
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conventions, reviewContract, writerPrompt} from './lib/personas.mjs';

test('conventions state the version anchoring rule', () => {
  // The requirement most likely to be silently dropped in an edit, and the
  // whole pipeline depends on the prompt carrying it.
  assert.match(conventions(), /From Mattermost v/);
  assert.match(conventions(), /ask which release/);
});

test('conventions state the heading case standard', () => {
  // brand-voice reads it from here. If the rule stops being stated, nothing in
  // the pipeline checks heading case at all.
  assert.match(conventions(), /[Ss]entence case/);
});

// brand-voice scores a change "against the rules in the conventions file you
// were given" and names these without restating them. A section dropped from
// conventions leaves the persona citing a rule the model never received.
const DEFERRED_RULES = [
  ['minimal frontmatter', /is the only key required/],
  ['plan availability', /<PlanAvailability/],
  ['callout severity', /<Warning>/],
  ['absolute internal links', /Never hardcode/],
  ['code block languages', /must declare a language/],
  ['escaped angle brackets', /Escape `>` and `<`/],
  ['sequential heading levels', /heading levels sequential/i],
  ['terminology', /not SSL/],
];

test('conventions state every rule brand-voice defers to them for', () => {
  const text = conventions();
  for (const [rule, pattern] of DEFERRED_RULES) {
    assert.match(text, pattern, `conventions no longer state the ${rule} rule`);
  }
});

test('review contract fixes the verdict vocabulary', () => {
  const contract = reviewContract();
  for (const verdict of ['APPROVE', 'REQUEST_CHANGES', 'COMMENT']) {
    assert.ok(contract.includes(verdict), `contract omits ${verdict}`);
  }
});

test('review contract names the fields the reviewer parses', () => {
  // normalize() in persona-review.mjs reads exactly these keys and caps
  // feedback at three. A contract that stops asking for one does not fail —
  // the field is quietly defaulted on every verdict.
  const contract = reviewContract();
  for (const field of ['verdict', 'summary', 'feedback']) {
    assert.match(contract, new RegExp(`"${field}"`), `contract omits the ${field} field`);
  }
  assert.match(contract, /At most three findings/);
});

test('writer prompt states the path= output contract and version rule', () => {
  const prompt = writerPrompt();
  assert.match(prompt, /path=/);
  assert.match(prompt, /From Mattermost vX\.Y/);
  assert.match(prompt, /From Mattermost \[NOT PRESENT — REQUIRES HUMAN JUDGMENT\]/);
  assert.match(prompt, /milestone\.version/);
  assert.match(prompt, /docs\/api\/reference/);
});

test('writer prompt states scope and observability guidance', () => {
  const prompt = writerPrompt();
  assert.match(prompt, /Parity/);
  assert.match(prompt, /Net-new/);
  assert.match(prompt, /Observability and diagnostics/);
  assert.match(prompt, /USER_PASSWORD_CHANGED/);
  assert.match(prompt, /processWidgets/);
});
