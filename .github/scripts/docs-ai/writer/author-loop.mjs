import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {complete, usageLine} from '../lib/anthropic.mjs';
import {unifiedDiff} from '../lib/diff.mjs';
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

const AUTHOR_REMINDER = [
  'Copy unchanged lines through unchanged.',
  'Document every brief action. Related behaviours may share a section.',
  'Do not add error strings, bind or firewall detail, or packaging variables.',
  'Match sibling spacing. Do not put a blank line between a label and its code fence.',
].join(' ');

/** Writer-loop only. docs-review.yml does not send this. */
export const PREOPEN_REVIEW_NOTE = [
  'This is a pre-open review of an AI documentation draft.',
  'REQUEST_CHANGES only when new text is factually wrong, a required capability is absent from the draft, or added lines insert blank lines the sibling sections do not use.',
  'Related capabilities may share a section. Do not request a separate heading for an action that belongs with the section already written.',
  'A blank line between a field label and its code fence, or between every sentence, is a spacing defect in added text. The blank line after a callout opening tag is required.',
  'Do not request exact error strings, bind addresses, firewall rules, port conflicts, or packaging variables. That is COMMENT at most, and only when the pull request evidence already states the behaviour.',
  'Do not request fixes to unchanged context lines.',
].join('\n');

const SUMMARY_RE = /`{3,}summary[ \t]*\n([\s\S]*?)\n`{3,}/;

/**
 * Drop HTML comment delimiters from model text. An unmatched opener at the
 * start of a line is an HTML block through the end of the pull request body.
 */
export function sanitizeSummary(summary) {
  return String(summary || '').replaceAll('<!--', '').replaceAll('-->', '').trim();
}

/** Summary fence from an author response. Empty when the model omits it. */
export function parseSummaryBlock(text) {
  const match = String(text || '').match(SUMMARY_RE);
  return match ? match[1].trim() : '';
}

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
  parts.push(
    block(
      'pr-metadata',
      [
        `PR URL: ${input.prUrl || '(unknown)'}`,
        `milestone.title: ${input.milestoneTitle || '(none)'}`,
        `milestone.version: ${input.milestoneVersion || '(none)'}`,
      ].join('\n'),
      {maxChars: 2000},
    ),
    '',
  );
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
        ? 'For paths with a current-draft block, revise that draft in place. Output the full updated file. Keep every line the review did not require.'
        : 'For paths with an existing-page block, edit that page in place. Copy every line you do not need to change through unchanged. Output the full updated file.',
      '',
    );
  }

  if (revisionFeedback?.length) {
    parts.push(
      block('reviewer-feedback', JSON.stringify(revisionFeedback, null, 2), {maxChars: 12_000}),
      '',
      'Revise the text this draft added. Ignore feedback about pre-existing lines. Do not add behaviour that is not in the pull request evidence.',
      'Output the summary fence, then the full file blocks.',
      AUTHOR_REMINDER,
    );
  } else {
    parts.push(
      'Draft the MDX file(s) that close the documentation gap for the target paths.',
      'Output the summary fence, then the file blocks. No other prose.',
      AUTHOR_REMINDER,
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
  return {files, summary: parseSummaryBlock(text)};
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

// clampResult allows 12 actions of 400 characters. Escaping `<`, `>`, and `&`
// expands that list, so the cap has to hold the escaped text.
const CAPABILITIES_MAX_CHARS = 25_000;

export function requiredCapabilities(brief) {
  const actions = (brief?.actions ?? []).map((a) => String(a).trim()).filter(Boolean);
  if (actions.length === 0) return '';
  return block('required-capabilities', actions.join('\n'), {maxChars: CAPABILITIES_MAX_CHARS});
}

function draftDiff(files, input) {
  return unifiedDiff(files, loadExistingPages(input.repoRoot, files.map((f) => f.path)));
}

async function reviewFiles({diff, input, brief, completeFn}) {
  const reviewers = await selectReviewers({diff, completeFn});
  const extra = requiredCapabilities(brief);
  const results = await Promise.all(
    reviewers.map((personaId) =>
      reviewPersona({
        personaId,
        diff,
        prTitle: input.prTitle,
        prBody: input.prBody,
        reviewNote: PREOPEN_REVIEW_NOTE,
        extra,
        model: REVIEW_MODEL,
        completeFn,
      }),
    ),
  );
  return {diff, reviewers, results};
}

/**
 * Author → review → revise loop.
 * `summary` is the draft PR body. `trail` is kept for the workflow artifact only.
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
  const summaries = [];

  for (const group of groups) {
    let authored = await authorPass({
      personaId: group.personaId,
      groupPaths: group.paths,
      brief,
      input,
      completeFn,
    });
    let groupFiles = authored.files;
    let groupSummary = authored.summary;
    const initialMissing = missingGroupTargets(groupFiles, group.paths);
    if (initialMissing.length) {
      throw new Error(
        `author ${group.personaId ?? 'neutral'} omitted required targets: ${initialMissing.join(', ')}`,
      );
    }
    assertVersionAnchors(groupFiles, {milestoneVersion: input.milestoneVersion});
    assertSafeMdx(groupFiles);
    let groupDiff = draftDiff(groupFiles, input);
    if (!groupDiff.trim()) {
      const paths = groupFiles.map((f) => f.path).join(', ');
      throw new Error(`authored pages are identical to the existing files: ${paths}`);
    }

    let revision = 0;
    let lastResults = [];
    for (;;) {
      const {results} = await reviewFiles({diff: groupDiff, input, brief, completeFn});
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
      const revisedMissing = missingGroupTargets(revised.files, group.paths);
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
        assertVersionAnchors(revised.files, {milestoneVersion: input.milestoneVersion});
        assertSafeMdx(revised.files);
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
      const revisedDiff = draftDiff(revised.files, input);
      if (!revisedDiff.trim()) {
        // A revision that reverts to the existing page must not replace a complete prior pass.
        console.error('[author-loop] revision is identical to the existing files; keeping prior files');
        trail.openConcerns.push({
          persona: group.personaId ?? 'neutral',
          summary: 'Revision rejected: identical to the existing files',
          feedback: [],
        });
        break;
      }
      groupFiles = revised.files;
      groupDiff = revisedDiff;
      // Only a summary from this revision may describe these files.
      groupSummary = revised.summary;
      if (!groupSummary) {
        console.error(
          '[author-loop] accepted revision omitted the summary fence; clearing the draft summary',
        );
      }
    }

    if (groupSummary) summaries.push(groupSummary);
    files = mergeFiles(files, groupFiles);
    console.error(
      `[author-loop] ${group.personaId ?? 'neutral'}: ${groupFiles.map((f) => f.path).join(', ')} ` +
        `(${lastResults.map((r) => `${r.persona}:${r.verdict}`).join(', ')})`,
    );
  }

  return {files, trail, summary: summaries.join('\n\n').trim()};
}

const DRAFT_TITLE_PREFIX = 'docs: AI draft for ';
const DRAFT_TITLE_MAX = 240;

/** Single-line draft PR title from the source PR title, without a doubled "docs:". */
export function draftTitle(sourceTitle) {
  const subject =
    String(sourceTitle ?? '')
      .replace(/[\s\u0000-\u001f\u007f]+/g, ' ')
      .trim()
      .replace(/^docs:\s*/i, '') || 'documentation update';
  const title = DRAFT_TITLE_PREFIX + subject;
  return title.length > DRAFT_TITLE_MAX ? `${title.slice(0, DRAFT_TITLE_MAX - 3).trimEnd()}...` : title;
}

export function renderPrBody({sourcePr, summary, milestoneVersion}) {
  const lines = [
    '<!-- docs-ai-draft:v1 -->',
    `<!-- docs-ai-source-pr:${sourcePr} -->`,
    '',
    `AI-drafted documentation for #${sourcePr}.`,
    '',
  ];

  if (!milestoneVersion) {
    lines.push(
      'The source PR had no milestone version. Version anchors are',
      '`From Mattermost [NOT PRESENT — REQUIRES HUMAN JUDGMENT]` until a human replaces them.',
      '',
    );
  }

  let change = sanitizeSummary(summary);
  if (change.length > 2000) change = `${change.slice(0, 2000).trimEnd()}...`;
  lines.push('## Summary', '', change || '_The draft did not include a change summary._', '');
  lines.push('Pending human editorial review.');
  return `${lines.join('\n')}\n`;
}
