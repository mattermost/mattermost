// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A '…' / "…" literal or a // comment. Matched left to right, so a quote inside a comment,
// or // inside a literal, belongs to the token it sits in. An unterminated literal runs to
// the end of its line. Raw and triple-quoted strings are not modeled.
const LITERAL_OR_COMMENT = String.raw`"(?:[^"\\\n\r]|\\.)*"?|'(?:[^'\\\n\r]|\\.)*'?|//[^\n]*`;

const LITERALS_AND_COMMENTS = new RegExp(LITERAL_OR_COMMENT, 'g');

// The reference patterns can't run over the masked string because the bracket form
// (`user.attributes["x"]`) names the attribute inside a literal. Instead, literals and
// comments are leading alternatives, so a reference inside one is consumed as part of it
// and produces no capture. Captures: 1 = dotted name, 2 = "quoted" name, 3 = 'quoted' name.
const USER_ATTRIBUTE_REFERENCE = new RegExp(String.raw`${LITERAL_OR_COMMENT}|user\s*\.\s*attributes(?:\s*\.\s*(\w+)|\s*\[\s*(?:"([^"]*)"|'([^']*)')\s*\])`, 'g');
const SESSION_ATTRIBUTE_REFERENCE = new RegExp(String.raw`${LITERAL_OR_COMMENT}|user\s*\.\s*session(?:\s*\.\s*(\w+)|\s*\[\s*(?:"([^"]*)"|'([^']*)')\s*\])`, 'g');

// A single-segment `user.<name>` selector such as `user.email`; `attributes` and `session` are namespaces, not fields.
const NATIVE_USER_REFERENCE = new RegExp(String.raw`${LITERAL_OR_COMMENT}|(?<![\w.])user\s*(?:\.\s*(\w+)|\[\s*(?:"([^"]*)"|'([^']*)')\s*\])`, 'g');
const USER_NAMESPACES = new Set(['attributes', 'session']);

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

type BooleanNode =
    {type: 'and' | 'or'; operands: BooleanNode[]} |
    {type: 'not'; operand: BooleanNode} |
    {type: 'ternary'; condition: BooleanNode; whenTrue: BooleanNode; whenFalse: BooleanNode} |
    {type: 'condition'; expression: string};

// Indices of `token` outside literals, comments and any (), [] or {} nesting.
function topLevelIndices(masked: string, token: string): number[] {
    const indices: number[] = [];
    let depth = 0;
    for (let i = 0; i < masked.length; i++) {
        const c = masked[i];
        if (c === '(' || c === '[' || c === '{') {
            depth++;
        } else if (c === ')' || c === ']' || c === '}') {
            depth--;
        } else if (depth === 0 && masked.startsWith(token, i)) {
            indices.push(i);
            i += token.length - 1;
        }
    }
    return indices;
}

function splitAtIndices(s: string, indices: number[], tokenLength: number): string[] {
    const parts: string[] = [];
    let start = 0;
    for (const i of indices) {
        parts.push(s.slice(start, i));
        start = i + tokenLength;
    }
    parts.push(s.slice(start));
    return parts;
}

// Splits an expression into its boolean structure (ternary, ||, &&, !) down to
// conditions such as `user.attributes.a == "x"`. Precedence follows CEL.
function parseBooleanStructure(expr: string): BooleanNode {
    let text = expr.trim();
    while (isWrappedInParens(text)) {
        text = text.slice(1, -1).trim();
    }
    const masked = maskLiteralsAndComments(text);

    const [question] = topLevelIndices(masked, '?');
    if (question !== undefined) {
        const markers = [...topLevelIndices(masked, '?'), ...topLevelIndices(masked, ':')].filter((i) => i > question).sort((a, b) => a - b);
        let open = 1;
        const colon = markers.find((i) => {
            open += masked[i] === '?' ? 1 : -1;
            return open === 0;
        });
        if (colon !== undefined) {
            return {
                type: 'ternary',
                condition: parseBooleanStructure(text.slice(0, question)),
                whenTrue: parseBooleanStructure(text.slice(question + 1, colon)),
                whenFalse: parseBooleanStructure(text.slice(colon + 1)),
            };
        }
    }

    for (const [token, type] of [['||', 'or'], ['&&', 'and']] as const) {
        const indices = topLevelIndices(masked, token);
        if (indices.length > 0) {
            return {type, operands: splitAtIndices(text, indices, token.length).map(parseBooleanStructure)};
        }
    }

    if (masked.startsWith('!') && !masked.startsWith('!=')) {
        return {type: 'not', operand: parseBooleanStructure(text.slice(1))};
    }

    return {type: 'condition', expression: text};
}

function everyPathRequiresNode(node: BooleanNode, outcome: boolean, isRequired: (condition: string) => boolean): boolean {
    switch (node.type) {
    case 'condition':
        return isRequired(node.expression);
    case 'not':
        return everyPathRequiresNode(node.operand, !outcome, isRequired);
    case 'and':
    case 'or': {
        // Reaching `outcome` needs every operand when it's true for && or false for ||, and any one otherwise.
        const needsAll = (node.type === 'and') === outcome;
        const requires = (operand: BooleanNode) => everyPathRequiresNode(operand, outcome, isRequired);
        return needsAll ? node.operands.some(requires) : node.operands.every(requires);
    }
    default:
        return (everyPathRequiresNode(node.condition, true, isRequired) || everyPathRequiresNode(node.whenTrue, outcome, isRequired)) &&
            (everyPathRequiresNode(node.condition, false, isRequired) || everyPathRequiresNode(node.whenFalse, outcome, isRequired));
    }
}

// True when the expression can only evaluate to true through at least one condition
// matching `isRequired`. `a || b` needs both sides to match; `a && b` needs either.
export function everyPathRequires(expr: string, isRequired: (condition: string) => boolean): boolean {
    // Comments would otherwise keep `(a || b) // note` from being unwrapped.
    const withoutComments = expr.replace(LITERALS_AND_COMMENTS, (token) => (token.startsWith('//') ? ' '.repeat(token.length) : token));
    return everyPathRequiresNode(parseBooleanStructure(withoutComments), true, isRequired);
}

function referencedNames(expr: string, pattern: RegExp): Set<string> {
    const names = new Set<string>();
    for (const [, dotted, doubleQuoted, singleQuoted] of expr.matchAll(pattern)) {
        const name = dotted ?? doubleQuoted ?? singleQuoted;
        if (name !== undefined) {
            names.add(name);
        }
    }
    return names;
}

export function referencedUserAttributeNames(expr: string): string[] {
    return Array.from(referencedNames(expr, USER_ATTRIBUTE_REFERENCE));
}

export function referencedSessionAttributeNames(expr: string): string[] {
    return Array.from(referencedNames(expr, SESSION_ATTRIBUTE_REFERENCE));
}

export function referencedNativeUserAttributeNames(expr: string): string[] {
    return Array.from(referencedNames(expr, NATIVE_USER_REFERENCE)).filter((name) => !USER_NAMESPACES.has(name));
}
