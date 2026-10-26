// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Beyond this size the check isn't worth running on every render
const MAX_LENGTH = 50000;

// Distinct constructs needed before text counts as Markdown, since any single one also appears in
// shell, YAML, Python and log output
const MIN_CONSTRUCTS = 2;

// `##` and deeper are rarely used for comments, so one of them is enough on its own
const STRONG_HEADING = /^#{2,6}[ \t]+\S/;

const LIST_ITEM = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\S/;
const TABLE_DIVIDER = /^\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/;

function hasHeading(lines: string[]) {
    // A heading must be followed by a blank line, which excludes `# comment` lines directly above code
    return lines.some((line, i) => (/^#{1,6}[ \t]+\S/).test(line) && (i === lines.length - 1 || lines[i + 1].trim() === ''));
}

function hasList(lines: string[]) {
    return lines.filter((line) => LIST_ITEM.test(line)).length >= 2;
}

function hasTable(lines: string[]) {
    return lines.some((line, i) => i > 0 && line.includes('-') && TABLE_DIVIDER.test(line.trim()) && lines[i - 1].includes('|'));
}

const CONSTRUCTS: Array<(lines: string[], text: string) => boolean> = [
    hasHeading,
    hasList,
    hasTable,
    (lines) => lines.some((line) => (/^>[ \t]+\S/).test(line)),

    // The quantifiers are bounded so a huge line of unclosed brackets or asterisks can't make these scan quadratically.
    // `\r` is excluded alongside `\n` so a match can't span a visual line break on CRLF input.
    (lines, text) => (/\[[^\]\n\r]{1,200}\]\([^)\s]{1,500}\)/).test(text),
    (lines, text) => (/(\*\*|__)[^\s*_][^\n\r]{0,200}?\1/).test(text),
];

export function isLikelyMarkdown(code: string): boolean {
    if (!code || code.length > MAX_LENGTH) {
        return false;
    }

    const lines = code.split('\n');

    if (lines.some((line) => STRONG_HEADING.test(line))) {
        return true;
    }

    let found = 0;
    for (const hasConstruct of CONSTRUCTS) {
        if (hasConstruct(lines, code)) {
            found++;
            if (found >= MIN_CONSTRUCTS) {
                return true;
            }
        }
    }

    return false;
}
