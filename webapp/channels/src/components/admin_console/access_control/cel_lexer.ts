// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type CelScan = {
    pairs: Map<number, number>;
    balanced: boolean;

    // The input with // comments dropped and each literal replaced by "#<index>".
    code: string;
    literals: string[];

    // Indices into the input of characters outside literals and comments.
    codeIndices: number[];
};

// Skips '…' / "…" literals (honoring backslash escapes) and // comments.
// Raw (r"…") and triple-quoted strings are not modeled: they mark the scan
// unbalanced (fail closed) and are otherwise lexed as ordinary literals;
// callers must also validate with /cel/check.
function scanCel(s: string): CelScan {
    const pairs = new Map<number, number>();
    const stack: number[] = [];
    const literals: string[] = [];
    const codeIndices: number[] = [];
    let code = '';
    let balanced = true;
    let i = 0;

    while (i < s.length) {
        const ch = s[i];

        if (ch === '"' || ch === "'") {
            if ((s[i + 1] === ch && s[i + 2] === ch) || s[i - 1] === 'r' || s[i - 1] === 'R') {
                balanced = false;
            }
            let j = i + 1;
            while (j < s.length && s[j] !== ch && s[j] !== '\n' && s[j] !== '\r') {
                j += s[j] === '\\' && s[j + 1] !== '\n' && s[j + 1] !== '\r' ? 2 : 1;
            }
            if (s[j] !== ch) {
                balanced = false;
            }
            literals.push(s.slice(i + 1, Math.min(j, s.length)));
            code += `"#${literals.length - 1}"`;
            i = j + 1;
            continue;
        }

        if (ch === '/' && s[i + 1] === '/') {
            const newline = s.indexOf('\n', i + 2);
            if (newline === -1) {
                break;
            }
            i = newline;
            continue;
        }

        if (ch === '(') {
            stack.push(i);
        } else if (ch === ')') {
            const open = stack.pop();
            if (open === undefined) {
                balanced = false;
            } else {
                pairs.set(open, i);
            }
        }
        code += ch;
        codeIndices.push(i);
        i++;
    }

    return {pairs, balanced: balanced && stack.length === 0, code, literals, codeIndices};
}

export function findMatchingParen(s: string, openIdx: number): number {
    if (s[openIdx] !== '(') {
        return -1;
    }
    const scan = scanCel(s);
    if (!scan.balanced) {
        return -1;
    }
    return scan.pairs.get(openIdx) ?? -1;
}

// True when the leading '(' closes at the last character, so `(a) || (b)` is not wrapped.
export function isWrappedInParens(s: string): boolean {
    return s.startsWith('(') && findMatchingParen(s, 0) === s.length - 1;
}

export function hasBalancedParens(expr: string): boolean {
    return scanCel(expr).balanced;
}

// Skips literals and comments but not parens: `(a || b) && c` splits on `||` too.
export function splitOutsideLiterals(s: string, separator: string): string[] {
    const {codeIndices} = scanCel(s);
    const span = separator.length - 1;
    const parts: string[] = [];
    let start = 0;
    codeIndices.forEach((i, k) => {
        if (i >= start && s.startsWith(separator, i) && codeIndices[k + span] === i + span) {
            parts.push(s.slice(start, i));
            start = i + separator.length;
        }
    });
    parts.push(s.slice(start));
    return parts;
}

const USER_ATTRIBUTE_REFERENCE = /user\.attributes(?:\.(\w+)|\s*\[\s*"#(\d+)"\s*\])/g;

export function referencedUserAttributeNames(expr: string): string[] {
    const {code, literals} = scanCel(expr);
    const names: string[] = [];
    for (const match of code.matchAll(USER_ATTRIBUTE_REFERENCE)) {
        names.push(match[1] ?? literals[Number(match[2])]);
    }
    return Array.from(new Set(names));
}
