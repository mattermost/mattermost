#!/usr/bin/env node
/*
 * Review a diff through one persona's lens and write a JSON verdict artifact.
 *
 * One persona per process so the workflow can fan them out in a matrix and a
 * single reviewer failing cannot take the others down. A failure here writes
 * an ERROR artifact and exits 0 — losing one reviewer is better than losing
 * the whole report.
 *
 *   node persona-review.mjs --persona brand-voice --diff pr.diff --out out/brand-voice.json \
 *     [--pr-title T] [--pr-body-file F]
 */

import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {complete, parseJson, usageLine} from './lib/anthropic.mjs';
import {getPersona, reviewSystemBlocks} from './lib/personas.mjs';
import {DATA_NOTICE, block} from './lib/untrusted.mjs';

const MODEL = process.env.DOCS_AI_REVIEW_MODEL || 'claude-sonnet-4-5-20250929';
const VERDICTS = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'];
const MAX_FEEDBACK = 3;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

/* Optional input: a missing PR body is not a reason to fail. */
function readIfSet(name) {
  const path = arg(name);
  return path && existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function buildUser({diff, prTitle, prBody}) {
  const parts = [DATA_NOTICE, ''];

  if (prTitle) parts.push(block('pull-request-title', prTitle, {maxChars: 500}), '');
  if (prBody) parts.push(block('pull-request-description', prBody, {maxChars: 6000}), '');

  parts.push(
    block('diff', diff),
    '',
    'Review the diff above from your persona. Return only the JSON object.',
  );

  return parts.join('\n');
}

/* Model output is untrusted: clamp it to the contract before it reaches a comment. */
function normalize(parsed, persona) {
  const verdict = VERDICTS.includes(parsed?.verdict) ? parsed.verdict : 'COMMENT';

  const feedback = (Array.isArray(parsed?.feedback) ? parsed.feedback : [])
    .filter((f) => typeof f === 'string' && f.trim())
    .slice(0, MAX_FEEDBACK)
    .map((f) => f.trim().slice(0, 1000));

  const summary =
    typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim().slice(0, 500)
      : 'No summary returned.';

  return {persona: persona.id, label: persona.label, verdict, summary, feedback, model: MODEL};
}

async function main() {
  const id = arg('persona');
  if (!id) throw new Error('--persona <id> is required');
  const diffPath = arg('diff');
  if (!diffPath) throw new Error('--diff <file> is required');
  const out = arg('out');
  if (!out) throw new Error('--out <file> is required');

  const persona = getPersona(id);
  let result;

  try {
    const {text, usage} = await complete({
      model: MODEL,
      system: reviewSystemBlocks(id),
      user: buildUser({
        diff: readFileSync(diffPath, 'utf8'),
        prTitle: arg('pr-title'),
        prBody: readIfSet('pr-body-file'),
      }),
      maxTokens: 2048,
      temperature: 0.2,
    });
    console.error(`[${id}] ${MODEL} ${usageLine(usage)}`);
    result = normalize(parseJson(text), persona);
  } catch (e) {
    console.error(`[${id}] review failed: ${e.message}`);
    result = {
      persona: persona.id,
      label: persona.label,
      verdict: 'ERROR',
      summary: `Review did not complete: ${e.message}`.slice(0, 500),
      feedback: [],
      model: MODEL,
    };
  }

  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.error(`[${id}] ${result.verdict} — ${result.summary}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
