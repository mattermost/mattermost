// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';

// A Bot accounts policy is a system_user policy flagged with `props.bot_scope: true`
// whose rule is stored as `!user.isbot || (<E>\n)`. The server re-serializes on read
// but keeps this prefix first and verbatim for a well-formed `E`.
export const BOT_SCOPE_PREFIX = '!user.isbot || ';

export const BOT_SCOPE_PROP = 'bot_scope';

type ParenScan = {
    pairs: Map<number, number>;
    balanced: boolean;
};

// Skips '…' / "…" literals (honoring backslash escapes) and // comments.
// Raw (r"…") and triple-quoted strings are not modeled and are rejected
// (fail closed); callers must also validate with /cel/check.
function scanParens(s: string): ParenScan {
    const pairs = new Map<number, number>();
    const stack: number[] = [];
    let balanced = true;
    let i = 0;

    while (i < s.length) {
        const ch = s[i];

        if (ch === '"' || ch === "'") {
            if ((s[i + 1] === ch && s[i + 2] === ch) || s[i - 1] === 'r' || s[i - 1] === 'R') {
                return {pairs, balanced: false};
            }
            let j = i + 1;
            let closed = false;
            while (j < s.length) {
                const c = s[j];
                if (c === '\\') {
                    if (s[j + 1] === '\n' || s[j + 1] === '\r') {
                        break;
                    }
                    j += 2;
                    continue;
                }
                if (c === '\n' || c === '\r') {
                    break;
                }
                if (c === ch) {
                    closed = true;
                    break;
                }
                j++;
            }
            if (!closed) {
                return {pairs, balanced: false};
            }
            i = j + 1;
            continue;
        }

        if (ch === '/' && s[i + 1] === '/') {
            const newline = s.indexOf('\n', i + 2);
            if (newline === -1) {
                break;
            }
            i = newline + 1;
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
        i++;
    }

    return {pairs, balanced: balanced && stack.length === 0};
}

export function isBotScopePolicy(policy: Pick<AccessControlPolicy, 'props'>): boolean {
    return policy.props?.[BOT_SCOPE_PROP] === true;
}

export function findMatchingParen(s: string, openIdx: number): number {
    if (s[openIdx] !== '(') {
        return -1;
    }
    const scan = scanParens(s);
    if (!scan.balanced) {
        return -1;
    }
    return scan.pairs.get(openIdx) ?? -1;
}

export function hasBalancedParens(expr: string): boolean {
    return scanParens(expr).balanced;
}

export function unwrapBotExpression(expr: string): string {
    if (!expr.startsWith(BOT_SCOPE_PREFIX)) {
        return expr;
    }

    let rest = expr;
    while (rest.startsWith(BOT_SCOPE_PREFIX)) {
        rest = rest.slice(BOT_SCOPE_PREFIX.length);
    }
    rest = rest.trim();

    if (rest.startsWith('(') && findMatchingParen(rest, 0) === rest.length - 1) {
        rest = rest.slice(1, -1).trim();
    }
    return rest;
}

// The newline keeps a trailing `// comment` in the expression from swallowing the `)`.
export function wrapBotExpression(expr: string): string {
    return `${BOT_SCOPE_PREFIX}(${expr}\n)`;
}

export function isMaskingFailureExpression(expr: string): boolean {
    return expr.trim() === 'false';
}

type MaskedExpression = {
    code: string;
    literals: string[];
};

// Drops // comments and replaces each '…' / "…" literal with a "#<index>"
// placeholder, so an apostrophe inside a comment can't open a fake literal.
function maskLiteralsAndComments(s: string): MaskedExpression {
    const literals: string[] = [];
    let code = '';
    let i = 0;

    while (i < s.length) {
        const ch = s[i];

        if (ch === '"' || ch === "'") {
            let j = i + 1;
            while (j < s.length && s[j] !== ch && s[j] !== '\n' && s[j] !== '\r') {
                j += s[j] === '\\' && s[j + 1] !== '\n' && s[j + 1] !== '\r' ? 2 : 1;
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

        code += ch;
        i++;
    }

    return {code, literals};
}

const USER_ATTRIBUTE_REFERENCE = /user\.attributes(?:\.(\w+)|\s*\[\s*"#(\d+)"\s*\])/g;

export function referencedUserAttributeNames(expr: string): string[] {
    const {code, literals} = maskLiteralsAndComments(expr);
    const names: string[] = [];
    for (const match of code.matchAll(USER_ATTRIBUTE_REFERENCE)) {
        names.push(match[1] ?? literals[Number(match[2])]);
    }
    return Array.from(new Set(names));
}

export function getSyncedAttributeReferences(expr: string, userFields: UserPropertyField[]): UserPropertyField[] {
    const names = new Set(referencedUserAttributeNames(expr));
    return userFields.filter((field) => names.has(field.name) && Boolean(field.attrs?.ldap || field.attrs?.saml));
}
