#!/usr/bin/env node
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {complete, parseJson, usageLine} from '../lib/anthropic.mjs';
import {getPersona, reviewSystemBlocks} from '../lib/personas.mjs';
import {DATA_NOTICE, block} from '../lib/untrusted.mjs';

const MODEL = process.env.DOCS_AI_REVIEW_MODEL || 'claude-sonnet-4-5-20250929';
const VERDICTS = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'];
const MAX_FEEDBACK = 3;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

function readIfSet(name) {
  const path = arg(name);
  return path && existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export function buildReviewUserPrompt({diff, prTitle, prBody}) {
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

export function normalizeReview(parsed, persona, model = MODEL) {
  const verdict = VERDICTS.includes(parsed?.verdict) ? parsed.verdict : 'COMMENT';

  const feedback = (Array.isArray(parsed?.feedback) ? parsed.feedback : [])
    .filter((f) => typeof f === 'string' && f.trim())
    .slice(0, MAX_FEEDBACK)
    .map((f) => f.trim().slice(0, 1000));

  const summary =
    typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim().slice(0, 500)
      : 'No summary returned.';

  return {persona: persona.id, label: persona.label, verdict, summary, feedback, model};
}

export async function reviewPersona({
  personaId,
  diff,
  prTitle,
  prBody,
  model = MODEL,
  completeFn = complete,
}) {
  const persona = getPersona(personaId);
  try {
    const {text, usage} = await completeFn({
      model,
      system: reviewSystemBlocks(personaId),
      userPrompt: buildReviewUserPrompt({diff, prTitle, prBody}),
      maxTokens: 2048,
      temperature: 0.2,
    });
    console.error(`[${personaId}] ${model} ${usageLine(usage)}`);
    return normalizeReview(parseJson(text), persona, model);
  } catch (e) {
    console.error(`[${personaId}] review failed: ${e.message}`);
    return {
      persona: persona.id,
      label: persona.label,
      verdict: 'ERROR',
      summary: `Review did not complete: ${e.message}`.slice(0, 500),
      feedback: [],
      model,
    };
  }
}

async function main() {
  const id = arg('persona');
  if (!id) throw new Error('--persona <id> is required');
  const diffPath = arg('diff');
  if (!diffPath) throw new Error('--diff <file> is required');
  const out = arg('out');
  if (!out) throw new Error('--out <file> is required');

  const result = await reviewPersona({
    personaId: id,
    diff: readFileSync(diffPath, 'utf8'),
    prTitle: arg('pr-title'),
    prBody: readIfSet('pr-body-file'),
  });

  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.error(`[${id}] ${result.verdict} — ${result.summary}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
