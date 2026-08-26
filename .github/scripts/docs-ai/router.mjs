#!/usr/bin/env node
/*
 * Persona router.
 *
 * Runs one cheap call to pick which personas a diff actually warrants, so the
 * expensive per-persona reviews only run where they have something to say. A
 * config-reference change should not spend tokens on an economic-buyer review.
 *
 * Emits a JSON array of persona ids on stdout, for the workflow's matrix.
 * Fails open to every review persona: a router outage should degrade cost,
 * not coverage.
 *
 *   node router.mjs --diff <file> [--out <file>]
 */

import {readFileSync, writeFileSync} from 'node:fs';
import {complete, parseJson, usageLine} from './lib/anthropic.mjs';
import {alwaysOnPersonaIds, personasWithScope} from './lib/personas.mjs';
import {DATA_NOTICE, block} from './lib/untrusted.mjs';

const MODEL = process.env.DOCS_AI_ROUTER_MODEL || 'claude-haiku-4-5-20251001';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

function buildSystem(candidates) {
  const menu = candidates
    .map((p) => `- ${p.id} (${p.label})\n  Applies to: ${p.routerHints}`)
    .join('\n');

  return `You route Mattermost documentation changes to the reviewers who have something
useful to say about them.

${DATA_NOTICE}

Available reviewers:

${menu}

Select every reviewer whose stated scope the change genuinely touches, and no
others. Judge by what the change does, not by which directory it sits in — an
administration page that adds an authentication step warrants the security
reviewer.

Err toward including a reviewer when a change plausibly touches their domain.
A missed reviewer costs a real finding; an extra one costs a few cents.

Return strict JSON and nothing else — no prose, no markdown fence:

{"personas": ["id", "id"]}`;
}

async function main() {
  const diffPath = arg('diff');
  if (!diffPath) throw new Error('--diff <file> is required');
  const diff = readFileSync(diffPath, 'utf8');

  const reviewers = personasWithScope('review');
  const alwaysOn = alwaysOnPersonaIds();
  // Never offered to the model: they run regardless, so asking wastes tokens
  // and invites the model to drop them.
  const candidates = reviewers.filter((p) => !alwaysOn.includes(p.id));
  const validIds = new Set(candidates.map((p) => p.id));

  let selected;
  if (!diff.trim()) {
    console.error('[router] empty diff; selecting always-on personas only');
    selected = [];
  } else {
    try {
      const {text, usage} = await complete({
        model: MODEL,
        system: buildSystem(candidates),
        user: `${block('diff', diff)}\n\nWhich reviewers apply?`,
        maxTokens: 512,
        temperature: 0,
      });
      console.error(`[router] ${MODEL} ${usageLine(usage)}`);

      const parsed = parseJson(text);
      const raw = Array.isArray(parsed) ? parsed : parsed.personas;
      if (!Array.isArray(raw)) throw new Error('response had no personas array');

      selected = raw.filter((id) => validIds.has(id));
      const dropped = raw.filter((id) => !validIds.has(id));
      if (dropped.length) {
        console.error(`[router] ignoring unknown ids: ${dropped.join(', ')}`);
      }
    } catch (e) {
      console.error(`[router] failed (${e.message}); falling back to all reviewers`);
      selected = candidates.map((p) => p.id);
    }
  }

  const result = [...new Set([...selected, ...alwaysOn])].sort();
  console.error(`[router] selected: ${result.join(', ')}`);

  const json = JSON.stringify(result);
  const out = arg('out');
  if (out) writeFileSync(out, json);
  process.stdout.write(json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
