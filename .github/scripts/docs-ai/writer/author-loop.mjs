import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {complete, usageLine} from '../lib/anthropic.mjs';
import {additionsDiff} from '../lib/diff.mjs';
import {
  alwaysOnPersonaIds,
  authorSystemBlocks,
  groupPathsByAuthor,
  neutralAuthorSystemBlocks,
  personasWithScope,
  REPO_ROOT as DEFAULT_ROOT,
} from '../lib/personas.mjs';
import {DATA_NOTICE, block} from '../lib/untrusted.mjs';
import {reviewPersona} from '../review/persona-review.mjs';
import {assertSafeMdx, assertVersionAnchors, mergeFiles, parseFileBlocks} from './files.mjs';
import {isAllowedPath} from './paths.mjs';

const WRITER_MODEL = process.env.DOCS_AI_WRITER_MODEL || 'claude-sonnet-4-6';
const REVIEW_MODEL = process.env.DOCS_AI_REVIEW_MODEL || 'claude-sonnet-4-5-20250929';
const ROUTER_MODEL = process.env.DOCS_AI_ROUTER_MODEL || 'claude-haiku-4-5-20251001';

/** Accept only non-negative integers; fall back when missing or malformed. */
export function parseMaxRevisions(raw, fallback = 2) {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

const MAX_REVISIONS = parseMaxRevisions(process.env.DOCS_AI_MAX_REVISIONS);

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

/** Targets in the group allowlist that are absent from the authored files. */
export function missingGroupTargets(files, groupPaths) {
  const allow = groupPathAllowlist(groupPaths);
  if (allow.size === 0) return [];
  const have = new Set((files || []).map((f) => normalizeDocsPath(f.path)));
  return [...allow].filter((t) => !have.has(t)).sort();
}

/** Load on-disk pages for targets so updates edit the real page, not a blank rewrite. */
export function loadExistingPages(repoRoot, groupPaths) {
  const root = repoRoot || DEFAULT_ROOT;
  const pages = [];
  for (const raw of groupPaths || []) {
    const path = normalizeDocsPath(raw);
    if (!path.startsWith('docs/') || !isAllowedPath(path)) continue;
    const abs = join(root, path);
    if (!existsSync(abs)) continue;
    pages.push({path, content: readFileSync(abs, 'utf8')});
  }
  return pages;
}

/** Refuse pages too large to fit in the prompt without truncation (would risk deleting omitted content). */
export const MAX_PAGE_PROMPT_CHARS = 100_000;

export function assertPagesFitPrompt(pages, maxChars = MAX_PAGE_PROMPT_CHARS) {
  for (const p of pages || []) {
    const n = String(p.content ?? '').length;
    if (n > maxChars) {
      throw new Error(
        `${p.path}: page is ${n} characters (limit ${maxChars}); refusing to author a replacement that might omit content`,
      );
    }
  }
}

function buildAuthorUserPrompt({brief, groupPaths, input, revisionFeedback, existingPages}) {
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

  if (existingPages?.length) {
    // Full page only (no truncation): assertPagesFitPrompt already rejected oversized files.
    const pageTag = revisionFeedback?.length ? 'current-draft' : 'existing-page';
    for (const page of existingPages) {
      parts.push(
        block(`${pageTag} path=${page.path}`, page.content, {maxChars: Number.MAX_SAFE_INTEGER}),
        '',
      );
    }
    parts.push(
      revisionFeedback?.length
        ? 'For paths with a current-draft block, revise that draft in place. Output the full updated file.'
        : 'For paths with an existing-page block, edit that page in place (smallest change that closes the gap). Output the full updated file.',
      '',
    );
  }

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

async function authorPass({personaId, groupPaths, brief, input, revisionFeedback, basePages, completeFn}) {
  const system = personaId ? authorSystemBlocks(personaId) : neutralAuthorSystemBlocks();
  // Revisions use the in-memory draft; initial passes load the on-disk page when present.
  const existingPages = basePages ?? loadExistingPages(input.repoRoot, groupPaths);
  assertPagesFitPrompt(existingPages);
  const {text, usage} = await completeFn({
    model: WRITER_MODEL,
    system,
    userPrompt: buildAuthorUserPrompt({
      brief,
      groupPaths,
      input,
      revisionFeedback,
      existingPages,
    }),
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
    const initialMissing = missingGroupTargets(groupFiles, group.paths);
    if (initialMissing.length) {
      throw new Error(
        `author ${group.personaId ?? 'neutral'} omitted required targets: ${initialMissing.join(', ')}`,
      );
    }
    assertVersionAnchors(groupFiles, {milestoneVersion: input.milestoneVersion});
    assertSafeMdx(groupFiles);

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
      const revised = await authorPass({
        personaId: group.personaId,
        groupPaths: group.paths,
        brief,
        input,
        revisionFeedback: blocking,
        basePages: groupFiles,
        completeFn,
      });
      const revisedMissing = missingGroupTargets(revised, group.paths);
      if (revisedMissing.length) {
        // Incomplete revision must not replace a complete prior pass.
        console.error(
          `[author-loop] revision omitted targets (${revisedMissing.join(', ')}); keeping prior files`,
        );
        trail.openConcerns.push({
          persona: group.personaId ?? 'neutral',
          summary: `Revision omitted required targets: ${revisedMissing.join(', ')}`,
          feedback: [],
        });
        break;
      }
      try {
        assertVersionAnchors(revised, {milestoneVersion: input.milestoneVersion});
        assertSafeMdx(revised);
      } catch (e) {
        // Dropped anchor / unsafe MDX must not replace a complete prior pass.
        console.error(
          `[author-loop] revision failed validation (${e.message}); keeping prior files`,
        );
        trail.openConcerns.push({
          persona: group.personaId ?? 'neutral',
          summary: `Revision rejected: ${e.message}`,
          feedback: [],
        });
        break;
      }
      groupFiles = revised;
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
