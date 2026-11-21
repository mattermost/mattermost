// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// TypeScript-API helpers for static_spec_check.mjs. Every helper takes the `ts` module as its first argument.
import {ELEMENT_EXISTENCE, LOCATOR_FACTORIES} from './static_spec_rules.mjs';

export function snippetOf(text) {
    const line = text.split('\n')[0].replace(/\s+/g, ' ').trim();
    return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}

// Secrets must never appear in evidence: quoted contents are replaced before the snippet is cut.
export function redact(text) {
    return text.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '$1<redacted>$1');
}

export function unwrap(ts, node) {
    let current = node;
    while (
        current &&
        (ts.isParenthesizedExpression(current) ||
            ts.isAwaitExpression(current) ||
            ts.isNonNullExpression(current) ||
            ts.isAsExpression(current))
    ) {
        current = current.expression;
    }
    return current;
}

export function stringValue(ts, node) {
    return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

export function resolveIdentifier(ts, id) {
    for (let scope = id.parent; scope; scope = scope.parent) {
        if (ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope)) {
            for (const statement of scope.statements) {
                if (!ts.isVariableStatement(statement)) {
                    continue;
                }
                for (const declaration of statement.declarationList.declarations) {
                    if (
                        ts.isIdentifier(declaration.name) &&
                        declaration.name.text === id.text &&
                        declaration.initializer
                    ) {
                        return declaration.initializer;
                    }
                }
            }
        }
    }
    return undefined;
}

// Locator factories in a receiver chain, closest to the end of the chain first; local consts are followed.
export function collectFactories(ts, start, out = [], depth = 0) {
    const node = unwrap(ts, start);
    if (!node || depth > 8) {
        return out;
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        if (LOCATOR_FACTORIES.has(name)) {
            out.push({name, call: node});
        }
        return collectFactories(ts, node.expression.expression, out, depth + 1);
    }
    if (ts.isPropertyAccessExpression(node)) {
        return collectFactories(ts, node.expression, out, depth + 1);
    }
    if (ts.isIdentifier(node)) {
        const initializer = resolveIdentifier(ts, node);
        return initializer ? collectFactories(ts, initializer, out, depth + 1) : out;
    }
    return out;
}

export function optionProperty(ts, objectNode, name) {
    if (!objectNode || !ts.isObjectLiteralExpression(objectNode)) {
        return undefined;
    }
    return objectNode.properties.find(
        (p) =>
            ts.isPropertyAssignment(p) &&
            (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
            p.name.text === name,
    );
}

export function describeFactory(ts, factory) {
    const args = factory.call.arguments;
    const options = args[1];
    const nameNode = factory.name === 'getByRole' ? optionProperty(ts, args[1], 'name')?.initializer : args[0];
    const exactProp = optionProperty(ts, options, 'exact');
    let nameKind = 'none';
    if (nameNode) {
        if (ts.isRegularExpressionLiteral(nameNode)) {
            nameKind = 'regex';
        } else {
            nameKind = stringValue(ts, nameNode) === undefined ? 'dynamic' : 'string';
        }
    }
    return {
        nameKind,
        nameText: stringValue(ts, nameNode) ?? '',
        exact: exactProp?.initializer.kind === ts.SyntaxKind.TrueKeyword,
    };
}

export function calleePath(ts, node) {
    const parts = [];
    let current = unwrap(ts, node);
    while (current) {
        if (ts.isPropertyAccessExpression(current)) {
            parts.unshift(current.name.text);
            current = unwrap(ts, current.expression);
        } else if (ts.isElementAccessExpression(current)) {
            parts.unshift(stringValue(ts, current.argumentExpression) ?? '<dynamic>');
            current = unwrap(ts, current.expression);
        } else if (ts.isCallExpression(current)) {
            current = unwrap(ts, current.expression);
        } else if (ts.isIdentifier(current)) {
            parts.unshift(current.text);
            break;
        } else {
            break;
        }
    }
    return parts;
}

export function expectInfo(ts, call) {
    const callee = call.expression;
    if (ts.isIdentifier(callee) && callee.text === 'expect') {
        return {soft: false, poll: false};
    }
    if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'expect'
    ) {
        if (callee.name.text === 'soft' || callee.name.text === 'poll') {
            return {soft: callee.name.text === 'soft', poll: callee.name.text === 'poll'};
        }
    }
    return undefined;
}

// A matcher call on an expect(...) call, or undefined.
export function asAssertion(ts, call) {
    if (!ts.isPropertyAccessExpression(call.expression)) {
        return undefined;
    }
    const matcher = call.expression.name.text;
    let negated = false;
    let receiver = unwrap(ts, call.expression.expression);
    while (receiver && ts.isPropertyAccessExpression(receiver)) {
        if (receiver.name.text === 'not') {
            negated = !negated;
        } else if (receiver.name.text !== 'resolves' && receiver.name.text !== 'rejects') {
            return undefined;
        }
        receiver = unwrap(ts, receiver.expression);
    }
    if (!receiver || !ts.isCallExpression(receiver)) {
        return undefined;
    }
    const info = expectInfo(ts, receiver);
    if (!info) {
        return undefined;
    }
    return {...info, matcher, negated, subject: receiver.arguments[0], args: call.arguments, call};
}

export function classify(ts, assertion) {
    const {matcher, negated, args} = assertion;
    if (matcher === 'toHaveCount') {
        const zero = args[0] && ts.isNumericLiteral(args[0]) && args[0].text === '0';
        if (zero) {
            return negated ? 'presence' : 'absence';
        }
        return negated ? 'other' : 'presence';
    }
    if (ELEMENT_EXISTENCE.has(matcher) || matcher === 'toBeDetached') {
        const hides = matcher === 'toBeHidden' || matcher === 'toBeDetached';
        return hides === negated ? 'presence' : 'absence';
    }
    return negated ? 'other' : 'presence';
}

export function timeoutOf(ts, args) {
    const last = args[args.length - 1];
    const prop = optionProperty(ts, last, 'timeout');
    if (!prop) {
        return undefined;
    }
    return ts.isNumericLiteral(prop.initializer) ? Number(prop.initializer.text) : undefined;
}

export function enclosingStatement(ts, node) {
    for (let current = node; current; current = current.parent) {
        if (ts.isExpressionStatement(current) || ts.isVariableStatement(current) || ts.isReturnStatement(current)) {
            return current;
        }
    }
    return node;
}

export function isAwaited(ts, node) {
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isAwaitExpression(current) || ts.isReturnStatement(current)) {
            return true;
        }
        if (ts.isArrowFunction(current) && current.body !== undefined && !ts.isBlock(current.body)) {
            return true;
        }
        if (ts.isBlock(current) || ts.isSourceFile(current) || ts.isExpressionStatement(current)) {
            return false;
        }
    }
    return false;
}

export function collectComments(ts, sf) {
    const byPos = new Map();
    const record = (ranges) => {
        for (const r of ranges ?? []) {
            if (!byPos.has(r.pos)) {
                byPos.set(r.pos, {
                    pos: r.pos,
                    end: r.end,
                    text: sf.text.slice(r.pos, r.end),
                    line: sf.getLineAndCharacterOfPosition(r.pos).line + 1,
                });
            }
        }
    };
    const visit = (node) => {
        record(ts.getLeadingCommentRanges(sf.text, node.pos));
        record(ts.getTrailingCommentRanges(sf.text, node.end));
        if (ts.isJSDoc(node)) {
            return;
        }
        for (const child of node.getChildren(sf)) {
            visit(child);
        }
    };
    visit(sf);
    return [...byPos.values()];
}
