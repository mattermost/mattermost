/*
 * Recover a writer brief from the gap sticky comment.
 * Prefer machine-readable fields when present; otherwise parse the rendered markdown.
 */

import {MARKER, parseState} from '../gap/gap.mjs';
import {extractDocsPaths} from './paths.mjs';

const ACTIONS_RE = /^\- \[ \] (.+)$/gm;

export function parseGapBrief(body) {
  if (!body || !body.includes(MARKER)) return null;

  const state = parseState(body);
  const actions = [];
  let m;
  const actionRe = new RegExp(ACTIONS_RE.source, 'gm');
  while ((m = actionRe.exec(body)) !== null) {
    actions.push(m[1].trim());
  }

  const paths = [
    ...extractDocsPaths(actions.join('\n')),
    ...extractDocsPaths(body),
  ];

  // Summary sits between the blank line after the verdict and the next section.
  let summary = '';
  const summaryMatch = body.match(
    /\*\*[^*]+\.\*\*[^\n]*\n\n([\s\S]*?)(?=\n<details>|\n\*\*Recommended actions\*\*|\n---\n)/,
  );
  if (summaryMatch) summary = summaryMatch[1].replace(/\s+/g, ' ').trim();

  return {
    state,
    assessment: state?.verdict ?? null,
    summary,
    actions,
    targetPaths: [...new Set(paths)],
  };
}

export function briefFromGapResult(result) {
  const actions = result.actions ?? [];
  const fromImpacts = (result.impacts ?? [])
    .map((r) => r.docsLocation || r.docs_location)
    .filter(Boolean);
  return {
    state: null,
    assessment: result.assessment,
    summary: result.summary ?? '',
    actions,
    targetPaths: [...new Set([...extractDocsPaths(actions.join('\n')), ...fromImpacts])],
  };
}
