// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex, no-control-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only; ANSI escapes are matched on purpose */

// The sanitized failure trace of a control run: what the independent verifier gets instead of raw Playwright output.
// Everything that could carry an origin, port, id, slug or token is replaced, and the result is scanned again.
import fs from 'node:fs';
import path from 'node:path';

import {resultErrors, stripAnsi, walkReport} from '../../../gates/common.mjs';
import {UNSAFE_TEXT_PATTERN} from '../../../schemas/shared.mjs';
import {REPO_ROOT} from '../common.mjs';

const CHANNEL_SLUGS = /\b(?:qa-sandbox|release-planning|legacy-roadmap)\b/g;
const CODE_FRAME_LINE = /^\s*(?:>\s*)?\d+ \|| \|\s*\^+\s*$/;
const MAX_MESSAGE_LINES = 14;
const MAX_SNAPSHOT_LINES = 40;

export function scrub(text) {
    return stripAnsi(text)
        .split(REPO_ROOT)
        .join('<repo>')
        .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"<>)\]]+/gi, '<url>')
        .replace(/\b(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?/g, '<host>')
        .replace(/\b(?:Bearer\s+\S+|(?:MMAUTHTOKEN|MMCSRF)=\S+)/g, '<token>')
        .replace(/\/qa-team\/channels\/[A-Za-z0-9_-]+/g, '<path>')
        .replace(/\bqa-team\b/g, '<team>')
        .replace(CHANNEL_SLUGS, '<channel>')
        .replace(/\b(?=[a-z0-9]*\d)[a-z0-9]{26}\b/g, '<id>')
        .replace(/:\d{4,5}\b/g, ':<port>');
}

/** Returns the patterns that still match: an empty list means the text passed the unsafe-text scan. Channel keys are allowed in a task, never in a trace. */
export function unsafeFindings(text, {allowSlugs = false} = {}) {
    const findings = [];
    if (new RegExp(UNSAFE_TEXT_PATTERN, 'i').test(text)) {
        findings.push('unsafe_text');
    }
    if (/:\d{4,5}\b/.test(text)) {
        findings.push('port');
    }
    if (!allowSlugs && /\b(?:qa-team|qa-sandbox|release-planning|legacy-roadmap)\b/.test(text)) {
        findings.push('slug');
    }
    if (text.includes(REPO_ROOT)) {
        findings.push('absolute_path');
    }
    return findings;
}

function failingResult(report, title) {
    const test = walkReport(report).find((t) => t.title === title);
    return (test?.test.results ?? []).find((r) => r.status === 'failed') ?? null;
}

function errorContextPath(result, resultsRoot) {
    const attached = (result.attachments ?? []).find((a) => /error-context/.test(`${a.name} ${a.path ?? ''}`));
    if (attached?.path && fs.existsSync(attached.path)) {
        return attached.path;
    }
    const stack = [resultsRoot];
    while (stack.length) {
        const dir = stack.pop();
        if (!dir || !fs.existsSync(dir)) {
            continue;
        }
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(abs);
            } else if (entry.name === 'error-context.md') {
                return abs;
            }
        }
    }
    return null;
}

/** The page snapshot of an error-context.md (the yaml block; newer versions put a "Page snapshot" heading above it). */
export function snapshotLines(markdown) {
    const section = /```yaml\n([\s\S]*?)\n```/.exec(markdown);
    return section ? section[1].split('\n') : [];
}

const indentOf = (line) => line.length - line.trimStart().length;

/**
 * The part of the snapshot that belongs to the bookmark bar. The bar is a plain container with no role, so it is
 * found through its items: links named like a bookmark title and the bar's own controls. The block runs from the first
 * to the last such line, plus the children of the last one. Link targets are dropped.
 */
export function bookmarkBarPart(lines, titles) {
    const isBar = (line) =>
        /\b(?:Bookmark menu|Add a bookmark|Bookmarks? bar)\b/.test(line) || titles.some((t) => line.includes(`"${t}"`));
    const hits = lines.map((l, i) => (isBar(l) ? i : -1)).filter((i) => i >= 0);
    if (hits.length === 0) {
        return [];
    }
    let end = hits.at(-1);
    const base = indentOf(lines[end]);
    while (end + 1 < lines.length && indentOf(lines[end + 1]) > base) {
        end += 1;
    }
    return lines
        .slice(hits[0], end + 1)
        .filter((l) => !/^\s*-\s*\/url:/.test(l))
        .slice(0, MAX_SNAPSHOT_LINES);
}

/**
 * Reads the failing test of a control report: its first error (message, location) and the bookmark-bar part of the
 * page snapshot from Playwright's error-context.md. Returns scrubbed text only.
 */
export function failureEvidence({report, title, resultsRoot, titles}) {
    const result = failingResult(report, title);
    const errors = result ? resultErrors(result) : [];
    const first = errors[0];
    if (!first) {
        return null;
    }
    const message = scrub(first.message ?? '')
        .split('\n')
        .filter((line) => !CODE_FRAME_LINE.test(line))
        .slice(0, MAX_MESSAGE_LINES)
        .map((l) => l.trimEnd())
        .join('\n')
        .trim();
    const contextFile = errorContextPath(result, resultsRoot);
    const snapshot = contextFile ? snapshotLines(fs.readFileSync(contextFile, 'utf8')) : [];
    return {
        error_count: errors.length,
        line: first.location?.line ?? null,
        message,
        message_first_line: message
            .split('\n')[0]
            .replace(/^Error:\s*/, '')
            .slice(0, 200),
        snapshot_found: Boolean(contextFile),
        bookmark_bar: bookmarkBarPart(snapshot, titles).map((l) => scrub(l)),
    };
}
