/*
 * Recover a writer brief from the gap sticky comment.
 * Prefer machine-readable fields when present; otherwise parse the rendered markdown.
 */

import {MARKER, parseState} from '../gap/gap.mjs';
import {extractDocsPaths, isAllowedPath} from './paths.mjs';

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
    .filter((p) => typeof p === 'string')
    .map((p) => p.trim().replace(/^\.\//, ''))
    .filter((p) => /\.(?:md|mdx)$/.test(p) && isAllowedPath(p));
  return {
    state: null,
    assessment: result.assessment,
    summary: result.summary ?? '',
    actions,
    targetPaths: [...new Set([...extractDocsPaths(actions.join('\n')), ...fromImpacts])],
  };
}

// Human-applied Docs/Needed (or a missing sticky) — draft from PR evidence alone.
export function briefFromPrEvidence({prTitle, prBody} = {}) {
  const blob = [prTitle, prBody].filter(Boolean).join('\n');
  return {
    state: null,
    assessment: 'required',
    summary:
      (prTitle && String(prTitle).trim()) ||
      'Docs/Needed was present without a docs-gap sticky comment; draft from the merged PR evidence.',
    actions: [
      'Draft documentation for the merged change using the PR title, description, and code diff as evidence.',
    ],
    targetPaths: extractDocsPaths(blob),
  };
}
