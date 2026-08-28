/*
 * Renders the gap-analysis prompt.
 *
 * The audience personas are rendered from the same frontmatter the review
 * pipeline routes on, rather than restated in the prompt. That is the mechanism
 * that keeps the two halves of the pipeline consistent: a persona whose
 * docs_paths or code_signals move updates the gap prompt in the same edit.
 */

import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PROMPTS_DIR, personasWithScope} from './personas.mjs';
import {DATA_NOTICE} from './untrusted.mjs';

export const TEMPLATE = join(PROMPTS_DIR, 'docs-gap-analysis.md');

const PLACEHOLDERS = ['DATA_NOTICE', 'INPUTS', 'PERSONAS'];

const list = (items) => items.map((i) => `\`${i}\``).join(', ');

export function impactPersonaContext() {
  const personas = personasWithScope('impact');
  if (personas.length === 0) {
    throw new Error('no persona declares impact scope; the gap prompt would have no audiences');
  }

  return personas
    .map((p) =>
      [
        `### ${p.label}`,
        '',
        `- Reads: ${list(p.docsPaths)}`,
        `- Code signals: ${list(p.codeSignals)}`,
        `- ${p.routerHints}`,
      ].join('\n'),
    )
    .join('\n\n');
}

export function renderPrompt({template = readFileSync(TEMPLATE, 'utf8'), inputs} = {}) {
  const values = {
    DATA_NOTICE,
    INPUTS: inputs,
    PERSONAS: impactPersonaContext(),
  };

  let out = template;
  for (const key of PLACEHOLDERS) {
    const token = `{{${key}}}`;
    if (!out.includes(token)) {
      throw new Error(`${TEMPLATE} no longer contains ${token}`);
    }
    if (!values[key]?.trim()) {
      throw new Error(`nothing to substitute for ${token}`);
    }
    out = out.replaceAll(token, values[key]);
  }

  const leftover = out.match(/\{\{[A-Z_]+\}\}/);
  if (leftover) {
    throw new Error(`${TEMPLATE} contains an unknown placeholder ${leftover[0]}`);
  }

  return out;
}
