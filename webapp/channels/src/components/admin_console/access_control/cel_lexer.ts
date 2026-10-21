// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A '…' / "…" literal or a // comment. Matched left to right, so a quote inside a comment,
// or // inside a literal, belongs to the token it sits in. An unterminated literal runs to
// the end of its line. Raw and triple-quoted strings are not modeled.
const LITERAL_OR_COMMENT = String.raw`"(?:[^"\\\n\r]|\\.)*"?|'(?:[^'\\\n\r]|\\.)*'?|//[^\n]*`;

const LITERALS_AND_COMMENTS = new RegExp(LITERAL_OR_COMMENT, 'g');

// Literals and comments are alternatives, so a reference inside one is consumed as part of it.
const USER_ATTRIBUTE_REFERENCE = new RegExp(String.raw`${LITERAL_OR_COMMENT}|user\.attributes(?:\.(\w+)|\s*\[\s*(?:"([^"]*)"|'([^']*)')\s*\])`, 'g');

// Same length as `s`, so an index into the result is an index into `s`.
function maskLiteralsAndComments(s: string): string {
    return s.replace(LITERALS_AND_COMMENTS, (token) => ' '.repeat(token.length));
}

// True when the leading '(' closes at the last character, so `(a) || (b)` is not wrapped.
export function isWrappedInParens(s: string): boolean {
    const masked = maskLiteralsAndComments(s);
    if (!masked.startsWith('(')) {
        return false;
    }

    let depth = 0;
    for (let i = 0; i < masked.length; i++) {
        if (masked[i] === '(') {
            depth++;
        } else if (masked[i] === ')') {
            depth--;
            if (depth === 0) {
                return i === masked.length - 1;
            }
        }
    }
    return false;
}

// Skips literals and comments but not parens: `(a || b) && c` splits on `||` too.
export function splitOutsideLiterals(s: string, separator: string): string[] {
    const masked = maskLiteralsAndComments(s);
    const parts: string[] = [];
    let start = 0;
    for (let i = masked.indexOf(separator); i !== -1; i = masked.indexOf(separator, start)) {
        parts.push(s.slice(start, i));
        start = i + separator.length;
    }
    parts.push(s.slice(start));
    return parts;
}

export function referencedUserAttributeNames(expr: string): string[] {
    const names = new Set<string>();
    for (const [, dotted, doubleQuoted, singleQuoted] of expr.matchAll(USER_ATTRIBUTE_REFERENCE)) {
        const name = dotted ?? doubleQuoted ?? singleQuoted;
        if (name !== undefined) {
            names.add(name);
        }
    }
    return Array.from(names);
}
