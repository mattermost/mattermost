/*
 * Clamp the model result, decide Docs/Needed, compose the sticky comment.
 * Dependency-free so the report job runs on a bare checkout.
 * Prior state lives in the sticky comment — that is how we tell bot vs human labels.
 */

export const ASSESSMENTS = ['required', 'recommended', 'none'];
export const CONFIDENCES = ['high', 'medium', 'low'];

export const LABEL = 'Docs/Needed';
export const SUPPRESSING_LABELS = ['Docs/Not Needed', 'Docs/Done']; // human opt-outs

export const MARKER = '<!-- docs-gap:v1 -->';
const STATE_TAG = 'docs-gap-state';
const STATE_RE = new RegExp(`<!--\\s*${STATE_TAG}\\s+(\\{[\\s\\S]*?\\})\\s*-->`);

const MAX = {summary: 1200, action: 400, cell: 200, impacts: 12, actions: 12};

const HEADLINE = {
  required: 'Documentation updates required',
  recommended: 'Documentation updates recommended',
  none: 'No documentation changes needed',
};

// Strip HTML comment delimiters so model text cannot forge docs-gap-state.
function text(value, max) {
  if (typeof value !== 'string') return '';
  return value.replaceAll('<!--', '').replaceAll('-->', '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const cell = (value) => text(value, MAX.cell).replaceAll('|', '\\|') || '—';

export function clampResult(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('gap result was not a JSON object');
  }
  // Moves a label — abort rather than defaulting.
  if (!ASSESSMENTS.includes(parsed.assessment)) {
    throw new Error(
      `assessment must be one of ${ASSESSMENTS.join(', ')}; got ${text(String(parsed.assessment), 40)}`,
    );
  }

  const rows = Array.isArray(parsed.impacts) ? parsed.impacts : [];
  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

  return {
    assessment: parsed.assessment,
    summary: text(parsed.summary, MAX.summary) || 'No summary returned.',
    confidence: CONFIDENCES.includes(parsed.confidence) ? parsed.confidence : null,
    impacts: rows
      .filter((r) => r && typeof r === 'object')
      .slice(0, MAX.impacts)
      .map((r) => ({
        change: cell(r.change),
        files: cell(r.files),
        audiences: cell(r.audiences),
        action: cell(r.action),
        docsLocation: cell(r.docs_location),
      })),
    actions: actions
      .map((a) => text(a, MAX.action))
      .filter(Boolean)
      .slice(0, MAX.actions),
  };
}

export function parseState(body) {
  const match = body?.match(STATE_RE);
  if (!match) return null;
  try {
    const state = JSON.parse(match[1]);
    return state && typeof state === 'object' ? state : null;
  } catch {
    return null;
  }
}

function serializeState({appliedBy, assessment, sha}) {
  const state = {applied_by: appliedBy, verdict: assessment, sha: sha ?? null};
  return `<!-- ${STATE_TAG} ${JSON.stringify(state)} -->`;
}

// Label follows the verdict, not "touched docs/" — otherwise an unrelated
// docs edit would clear Docs/Needed.
export function decide({assessment, labels, priorState}) {
  const suppressed = SUPPRESSING_LABELS.find((l) => labels.includes(l));
  if (suppressed) return {skip: suppressed};

  const hasLabel = labels.includes(LABEL);
  const botApplied = priorState?.applied_by === 'bot';

  if (assessment !== 'none') {
    return {
      label: hasLabel ? 'keep' : 'add',
      // Label present without our state → human; record that so a later none keeps it.
      appliedBy: hasLabel && !botApplied ? 'human' : 'bot',
      create: true,
    };
  }

  if (hasLabel && botApplied) {
    return {label: 'remove', appliedBy: null, create: false};
  }
  if (hasLabel) {
    return {label: 'keep', appliedBy: 'human', humanOverride: true, create: false};
  }
  // Clean PR: do not open a sticky on every push.
  return {label: 'keep', appliedBy: null, create: false};
}

function verdictLine({assessment, decision}) {
  const headline = `**${HEADLINE[assessment]}.**`;

  if (assessment === 'none') {
    if (decision.label === 'remove') {
      return `${headline} The gap this pull request opened is closed by the documentation it now carries, so \`${LABEL}\` has been removed.`;
    }
    if (decision.humanOverride) {
      return `${headline} \`${LABEL}\` was applied by hand rather than by this analysis, so it has been left in place.`;
    }
    return headline;
  }

  const label =
    decision.label === 'add'
      ? `\`${LABEL}\` applied.`
      : decision.humanOverride || decision.appliedBy === 'human'
        ? `\`${LABEL}\` was already applied by hand and stays.`
        : `\`${LABEL}\` stays applied.`;

  return `${headline} ${label}`;
}

function impactTable(impacts) {
  if (impacts.length === 0) return [];
  return [
    '<details>',
    '<summary>Impact details</summary>',
    '',
    '| Change | Files | Audience | Documentation action | Location |',
    '| --- | --- | --- | --- | --- |',
    ...impacts.map((r) => `| ${r.change} | ${r.files} | ${r.audiences} | ${r.action} | ${r.docsLocation} |`),
    '',
    '</details>',
    '',
  ];
}

function footer({confidence, sha, runUrl, labelled}) {
  const parts = ['Advisory'];
  if (confidence) parts.push(`${confidence} confidence`);
  if (sha) parts.push(`analysed \`${sha.slice(0, 7)}\``);
  if (runUrl) parts.push(`[run](${runUrl})`);

  const optOut = labelled
    ? ` Add \`Docs/Not Needed\` to opt out — removing \`${LABEL}\` on its own lasts only until the next push.`
    : '';

  return ['---', `<sub>${parts.join(' · ')}.${optOut}</sub>`];
}

export function buildComment({result, decision, sha, runUrl}) {
  const body = [
    MARKER,
    serializeState({appliedBy: decision.appliedBy, assessment: result.assessment, sha}),
    '### Documentation gap analysis',
    '',
    verdictLine({assessment: result.assessment, decision}),
    '',
    result.summary,
    '',
    ...impactTable(result.impacts),
  ];

  if (result.actions.length) {
    body.push('**Recommended actions**', '', ...result.actions.map((a) => `- [ ] ${a}`), '');
  }

  const labelled = decision.label === 'add' || (decision.label === 'keep' && decision.appliedBy);
  body.push(...footer({confidence: result.confidence, sha, runUrl, labelled}));

  return body.join('\n');
}

// Keep prior state on failure so a bot label does not start looking human-applied.
export function buildFailureComment({priorState, runUrl}) {
  const body = [MARKER];
  if (priorState) {
    body.push(
      serializeState({
        appliedBy: priorState.applied_by ?? null,
        assessment: priorState.verdict ?? null,
        sha: priorState.sha ?? null,
      }),
    );
  }

  body.push(
    '### Documentation gap analysis',
    '',
    `The analysis did not complete on this push, so \`${LABEL}\` has been left exactly as it was. Review this pull request for documentation impact by hand.`,
    '',
    ...footer({runUrl, labelled: false}),
  );

  return body.join('\n');
}
