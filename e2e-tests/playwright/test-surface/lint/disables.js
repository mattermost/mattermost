// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The disable directives of the spec action rules: how one is read, and how many a file has (the count is held by a
// ceiling).
import ts from 'typescript';

/** The rules whose disables need a reason and are counted. */
export const ACTION_RULES = Object.freeze(['test-surface/e2e-observe-actions', 'test-surface/e2e-no-floating-actions']);

const DIRECTIVE = /^\s*eslint-disable(?:-next-line|-line)?(?:\s|$)(.*)$/s;

/**
 * A comment's text (without `//` or `/* *\/`) read as a disable directive: the rules it names and its reason, or null
 * when it is not one. `rules` is empty for a directive that names none, which disables every rule.
 */
export function parseDisable(comment) {
    const match = DIRECTIVE.exec(comment);
    if (!match) {
        return null;
    }
    const [names, ...reason] = match[1].split(/\s--\s|\s--$/);
    return {
        rules: names.split(',').map((rule) => rule.trim()).filter(Boolean),
        reason: reason.join(' -- ').trim(),
    };
}

/** The text of every comment in a TypeScript or JavaScript source, once each; strings and templates are not comments. */
function comments(source, fileName) {
    const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, (/\.[jt]sx$/).test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const seen = new Map();
    const take = (ranges) => {
        for (const range of ranges ?? []) {
            const text = source.slice(range.pos, range.end);
            seen.set(range.pos, range.kind === ts.SyntaxKind.SingleLineCommentTrivia ? text.slice(2) : text.slice(2, -2));
        }
    };
    const visit = (node) => {
        take(ts.getLeadingCommentRanges(source, node.pos));
        take(ts.getTrailingCommentRanges(source, node.end));
        ts.forEachChild(node, visit);
    };
    visit(file);
    take(ts.getLeadingCommentRanges(source, file.endOfFileToken.pos));
    return [...seen.values()];
}

/**
 * How many times the source's disable directives name one of `ACTION_RULES`: each rule named in each directive counts
 * once. A directive that names no rule is not counted here (`e2e-disable-reason` rejects it).
 */
export function countActionDisables(source, fileName = 'spec.ts') {
    let count = 0;
    for (const comment of comments(source, fileName)) {
        const directive = parseDisable(comment);
        count += directive ? directive.rules.filter((rule) => ACTION_RULES.includes(rule)).length : 0;
    }
    return count;
}
