import {complete, usageLine} from '../lib/anthropic.mjs';
import {additionsDiff} from '../lib/diff.mjs';
import {
  alwaysOnPersonaIds,
  authorSystemBlocks,
  groupPathsByAuthor,
  neutralAuthorSystemBlocks,
  personasWithScope,
} from '../lib/personas.mjs';
import {DATA_NOTICE, block} from '../lib/untrusted.mjs';
import {reviewPersona} from '../review/persona-review.mjs';
import {assertVersionAnchors, mergeFiles, parseFileBlocks} from './files.mjs';
import {isAllowedPath} from './paths.mjs';

const WRITER_MODEL = process.env.DOCS_AI_WRITER_MODEL || 'claude-sonnet-4-6';
const REVIEW_MODEL = process.env.DOCS_AI_REVIEW_MODEL || 'claude-sonnet-4-5-20250929';
const ROUTER_MODEL = process.env.DOCS_AI_ROUTER_MODEL || 'claude-haiku-4-5-20251001';
const MAX_REVISIONS = Number(process.env.DOCS_AI_MAX_REVISIONS || 2);

export function normalizeDocsPath(p) {
  return String(p || '')
    .trim()
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
}

/** Concrete docs/ targets for this author group; empty means "no path filter". */
export function groupPathAllowlist(groupPaths) {
  return new Set(
    (groupPaths || [])
      .map(normalizeDocsPath)
      .filter((p) => p.startsWith('docs/')),
  );
}

function buildAuthorUserPrompt({brief, groupPaths, input, revisionFeedback}) {
  const parts = [
    DATA_NOTICE,
    '',
    block('gap-brief', JSON.stringify(brief, null, 2), {maxChars: 20_000}),
    '',
  ];

  if (input.prTitle) parts.push(block('pull-request-title', input.prTitle, {maxChars: 500}), '');
  if (input.prBody) parts.push(block('pull-request-description', input.prBody, {maxChars: 6000}), '');
  if (input.milestoneTitle) {
    parts.push(
      block(
        'pr-metadata',
        [
          `PR URL: ${input.prUrl || '(unknown)'}`,
          `milestone.title: ${input.milestoneTitle}`,
          `milestone.version: ${input.milestoneVersion || '(none)'}`,
        ].join('\n'),
        {maxChars: 2000},
      ),
      '',
    );
  }
  if (input.codeDiff) parts.push(block('code_diff', input.codeDiff, {maxChars: 40_000}), '');

  parts.push(
    block('target-paths', groupPaths.join('\n') || '(derive from gap brief)'),
    '',
  );

  if (revisionFeedback?.length) {
    parts.push(
      block('reviewer-feedback', JSON.stringify(revisionFeedback, null, 2), {maxChars: 12_000}),
      '',
      'Revise the pages to address REQUEST_CHANGES feedback. Output the full file blocks again.',
    );
  } else {
    parts.push(
      'Draft the MDX file(s) that close the documentation gap for the target paths. Output only the file blocks.',
    );
  }

  return parts.join('\n');
}

async function authorPass({personaId, groupPaths, brief, input, revisionFeedback, completeFn}) {
  const system = personaId ? authorSystemBlocks(personaId) : neutralAuthorSystemBlocks();
  const {text, usage} = await completeFn({
    model: WRITER_MODEL,
    system,
    userPrompt: buildAuthorUserPrompt({brief, groupPaths, input, revisionFeedback}),
    maxTokens: 8192,
    temperature: 0.3,
  });
  console.error(`[author:${personaId ?? 'neutral'}] ${WRITER_MODEL} ${usageLine(usage)}`);

  const allow = groupPathAllowlist(groupPaths);
  const files = parseFileBlocks(text)
    .map((f) => ({...f, path: normalizeDocsPath(f.path)}))
    .filter((f) => {
      if (!isAllowedPath(f.path)) {
        console.error(`[author] dropping disallowed path ${f.path}`);
        return false;
      }
      if (allow.size > 0 && !allow.has(f.path)) {
        console.error(`[author] dropping path outside group targets: ${f.path}`);
        return false;
      }
      return true;
    });

  if (files.length === 0) {
    throw new Error(`author ${personaId ?? 'neutral'} emitted no allowed file blocks`);
  }
  return files;
}

async function selectReviewers({diff, completeFn}) {
  const alwaysOn = alwaysOnPersonaIds();
  const candidates = personasWithScope('review').filter((p) => !alwaysOn.includes(p.id));
  const validIds = new Set(candidates.map((p) => p.id));

  try {
    const menu = candidates
      .map((p) => `- ${p.id} (${p.label})\n  Applies to: ${p.routerHints}`)
      .join('\n');
    const {text, usage} = await completeFn({
      model: ROUTER_MODEL,
      system: `You route Mattermost documentation changes to reviewers.\n\n${DATA_NOTICE}\n\nAvailable reviewers:\n\n${menu}\n\nReturn strict JSON: {"personas": ["id"]}`,
      userPrompt: `${block('diff', diff)}\n\nWhich reviewers apply?`,
      maxTokens: 512,
      temperature: 0,
    });
    console.error(`[router] ${ROUTER_MODEL} ${usageLine(usage)}`);
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text).personas;
    const selected = (Array.isArray(raw) ? raw : []).filter((id) => validIds.has(id));
    return [...new Set([...selected, ...alwaysOn])].sort();
  } catch (e) {
    console.error(`[router] failed (${e.message}); using all reviewers`);
    return [...new Set([...candidates.map((p) => p.id), ...alwaysOn])].sort();
  }
}

async function reviewFiles({files, input, completeFn}) {
  const diff = additionsDiff(files);
  const reviewers = await selectReviewers({diff, completeFn});
  const results = await Promise.all(
    reviewers.map((personaId) =>
      reviewPersona({
        personaId,
        diff,
        prTitle: input.prTitle,
        prBody: input.prBody,
        model: REVIEW_MODEL,
        completeFn,
      }),
    ),
  );
  return {diff, reviewers, results};
}

/**
 * Author → review → revise loop. Returns files + trail for the draft PR body.
 */
export async function authorLoop({brief, input, completeFn = complete} = {}) {
  const targets =
    brief.targetPaths?.length > 0
      ? brief.targetPaths
      : (brief.actions ?? []).length
        ? brief.actions
        : ['(unspecified — derive from the gap brief)'];

  // When we only have action strings, groupPathsByAuthor still needs path-like targets.
  const pathTargets = targets.filter((t) => t.startsWith('docs/'));
  const groups =
    pathTargets.length > 0
      ? groupPathsByAuthor(pathTargets)
      : [{personaId: null, paths: targets}];

  let files = [];
  const trail = {iterations: [], openConcerns: []};

  for (const group of groups) {
    let groupFiles = await authorPass({
      personaId: group.personaId,
      groupPaths: group.paths,
      brief,
      input,
      completeFn,
    });
    assertVersionAnchors(groupFiles, {milestoneVersion: input.milestoneVersion});

    let revision = 0;
    let lastResults = [];
    for (;;) {
      const {results} = await reviewFiles({files: groupFiles, input, completeFn});
      lastResults = results;
      trail.iterations.push({
        author: group.personaId ?? 'neutral',
        revision,
        paths: groupFiles.map((f) => f.path),
        reviews: results.map((r) => ({
          persona: r.persona,
          verdict: r.verdict,
          summary: r.summary,
          feedback: r.feedback,
        })),
      });

      const errors = results.filter((r) => r.verdict === 'ERROR');
      if (errors.length) {
        throw new Error(
          `pre-open review failed (${errors.map((r) => r.persona).join(', ')}): ${errors.map((r) => r.summary).join('; ')}`,
        );
      }

      const blocking = results.filter((r) => r.verdict === 'REQUEST_CHANGES');
      if (blocking.length === 0 || revision >= MAX_REVISIONS) {
        if (blocking.length) {
          trail.openConcerns.push(
            ...blocking.map((r) => ({
              persona: r.persona,
              summary: r.summary,
              feedback: r.feedback,
            })),
          );
        }
        break;
      }

      revision += 1;
      groupFiles = await authorPass({
        personaId: group.personaId,
        groupPaths: group.paths,
        brief,
        input,
        revisionFeedback: blocking,
        completeFn,
      });
      assertVersionAnchors(groupFiles, {milestoneVersion: input.milestoneVersion});
    }

    files = mergeFiles(files, groupFiles);
    console.error(
      `[author-loop] ${group.personaId ?? 'neutral'}: ${groupFiles.map((f) => f.path).join(', ')} ` +
        `(${lastResults.map((r) => `${r.persona}:${r.verdict}`).join(', ')})`,
    );
  }

  return {files, trail};
}

export function renderPrBody({sourcePr, trail, brief}) {
  const lines = [
    '<!-- docs-ai-draft:v1 -->',
    `<!-- docs-ai-source-pr:${sourcePr} -->`,
    '',
    `AI-drafted documentation for #${sourcePr}.`,
    '',
    'Authored by audience personas from the gap analysis sticky comment, then reviewed',
    'in-loop before this PR opened. Treat as a draft pending human editorial review.',
    '',
    '## Gap brief',
    '',
    brief.summary || '_No summary recovered from the sticky comment._',
    '',
  ];

  if (brief.actions?.length) {
    lines.push('### Recommended actions', '', ...brief.actions.map((a) => `- [ ] ${a}`), '');
  }

  lines.push('## Pre-open review trail', '');
  for (const iter of trail.iterations) {
    lines.push(
      `### Author \`${iter.author}\` — revision ${iter.revision}`,
      '',
      `Paths: ${iter.paths.map((p) => `\`${p}\``).join(', ')}`,
      '',
    );
    for (const r of iter.reviews) {
      lines.push(`- **${r.persona}** — \`${r.verdict}\`: ${r.summary}`);
      for (const f of r.feedback ?? []) lines.push(`  - ${f}`);
    }
    lines.push('');
  }

  if (trail.openConcerns?.length) {
    lines.push('## Open concerns after revision cap', '');
    for (const c of trail.openConcerns) {
      lines.push(`- **${c.persona}**: ${c.summary}`);
      for (const f of c.feedback ?? []) lines.push(`  - ${f}`);
    }
    lines.push('');
  }

  lines.push(`Closes the docs gap filed against #${sourcePr}.`);
  return `${lines.join('\n')}\n`;
}
