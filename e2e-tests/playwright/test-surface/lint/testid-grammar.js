// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- messages and cases quote template-literal syntax */

// The testid grammar is defined in the sibling grammar.js:
//
//     testid  := path [ ":" KEY ] [ "--" ROLE ]
//     path    := WORD ( "." WORD )*        leading WORDs = scope, last WORD = name
//     WORD    := [a-z][a-z0-9_]*
//
// In a template literal, runtime data may fill the key (`a.b.item:${id}--button`) or, in a component that composes
// its parts from a testId prop, the whole leading path (`${testId}.close--button`). Every branch that can render is
// checked (`?:`, `||`, `??`, the right of `&&`), and so are the arguments of the testid helpers (`part`, `keyed`,
// `withRole`, `pluginSlotTestId`, `pluginSlotPath`).

import {isTestIdProblem, parseTestId, TEST_ID_ROLES} from './grammar.js';
import {
    constInit,
    isNothing,
    isPassThroughName,
    isStringLiteral,
    OPTIONS_SCHEMA,
    propKinds,
    stringValue,
    testIdKind,
    testIdValueNode,
    unwrapCasts,
    valueLeaves,
} from './testid-utils.js';

const KEY = '\u0000';
const PREFIX = '\u0001';
const MAX_VARIANTS = 32;

/** One message per `TestIdProblem` kind; `problemMessage` falls back for a kind added later. */
export const MESSAGES = {
    dashes_in_path: () => '"--" may only precede the role',
    empty_key: () => 'empty key after ":"',
    data_outside_key: () => 'runtime data may only fill the key of the last word (`scope.name:${value}`)',
    composed_without_separator: () => 'a composed testid continues its prefix with "." (`${testId}.part--role`)',
    unknown_role: (p) => `unknown role "--${p.role}"; use one of ${TEST_ID_ROLES.join(', ')}`,
    word: (p) => `"${p.word}" is not a lower_snake_case word`,
    unscoped: () => 'a testid needs a scope (`area.name--role`)',
};

export function problemMessage(p) {
    const message = MESSAGES[p.problem];
    return message ? message(p) : `breaks the testid grammar (${p.problem})`;
}

const PATH_ONLY = 'a testId prop is the path only; the component appends "--<role>"';

/**
 * Checks a testid written as literal text, where KEY marks runtime data after ":" and PREFIX marks a leading
 * composed path. Returns an error message, or null when it follows the grammar.
 */
export function grammarError(text, {withRole = true} = {}) {
    const parsed = parseTestId(text, {key: KEY, prefix: PREFIX});
    if (!withRole && !isTestIdProblem(parsed) && (parsed.role || parsed.hasKey)) {
        return PATH_ONLY;
    }
    const p = parseTestId(text, {key: KEY, prefix: PREFIX});
    if (!isTestIdProblem(p) && p.hasKey && p.key === null) {
        const suffix = p.role ? `--${p.role}` : '';
        const key = text.slice(text.indexOf(':') + 1, suffix ? -suffix.length : undefined);
        if (key !== KEY) {
            return 'a runtime key must be exactly one interpolation; use one id or nest scopes';
        }
    }
    return isTestIdProblem(p) ? problemMessage(p) : null;
}

const show = (text) => JSON.stringify(text.replaceAll(KEY, '${…}').replaceAll(PREFIX, '${…}'));

/**
 * The texts an expression can produce inside a testid, with runtime data marked: string literals, nested templates,
 * the branches of `?:` / `||` / `??` / `&&` (an `undefined` branch renders nothing) and same-file consts expand to
 * every alternative; anything else is runtime data (PREFIX at the start, KEY elsewhere). `badPrefixes` collects
 * leading expressions that don't come from a testid prop or scope.
 */
function expressionTexts(context, node, atStart, badPrefixes, depth = 0) {
    const expr = unwrapCasts(node);
    if (isStringLiteral(expr)) {
        return [stringValue(expr)];
    }
    if (depth < 4) {
        let branches = null;
        if (expr.type === 'ConditionalExpression') {
            branches = [expr.consequent, expr.alternate];
        } else if (expr.type === 'LogicalExpression') {
            branches = expr.operator === '&&' ? [expr.right] : [expr.left, expr.right];
        }
        branches = branches && branches.map(unwrapCasts).filter((b) => !isNothing(b));
        if (branches && branches.length) {
            return branches.flatMap((b) => expressionTexts(context, b, atStart, badPrefixes, depth + 1)).slice(0, MAX_VARIANTS);
        }
        if (expr.type === 'TemplateLiteral') {
            return templateTexts(context, expr, atStart, badPrefixes, depth + 1);
        }
        const init = constInit(context, expr);
        if (init && ['Literal', 'TemplateLiteral', 'ConditionalExpression', 'LogicalExpression'].includes(unwrapCasts(init).type)) {
            return expressionTexts(context, init, atStart, badPrefixes, depth + 1);
        }
    }
    if (atStart && !isPassThroughName(expr)) {
        badPrefixes.push(expr);
    }
    return [atStart ? PREFIX : KEY];
}

function templateTexts(context, node, atStart, badPrefixes, depth = 0) {
    let texts = [''];
    node.quasis.forEach((q, i) => {
        const quasi = q.value.cooked ?? q.value.raw;
        texts = texts.map((t) => t + quasi);
        if (i < node.expressions.length) {
            const start = atStart && texts.every((t) => t === '');
            const alternatives = expressionTexts(context, node.expressions[i], start, badPrefixes, depth);
            const next = [];
            for (const t of texts) {
                for (const a of alternatives) {
                    if (next.length < MAX_VARIANTS) {
                        next.push(t + a);
                    }
                }
            }
            texts = next;
        }
    });
    return texts;
}

function isStringConcat(node) {
    if (node.type !== 'BinaryExpression' || node.operator !== '+') {
        return false;
    }
    const stringy = (n) => isStringLiteral(n) || n.type === 'TemplateLiteral' || isStringConcat(n);
    return stringy(node.left) || stringy(node.right);
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require testids to follow the testid grammar (scope.name:key--role)',
        },
        schema: OPTIONS_SCHEMA,
    },
    create: (context) => {
        const kindOf = propKinds(context.options[0]);

        const checkText = (node, text, withRole) => {
            const error = grammarError(text, {withRole});
            if (error) {
                context.report({node, message: `testid ${show(text)}: ${error}.`});
            }
        };

        const checkLeaf = (leaf, withRole) => {
            if (isStringLiteral(leaf)) {
                checkText(leaf, stringValue(leaf), withRole);
                return;
            }
            if (leaf.type === 'TemplateLiteral') {
                const badPrefixes = [];
                const texts = templateTexts(context, leaf, true, badPrefixes);
                for (const prefix of badPrefixes) {
                    context.report({
                        node: prefix,
                        message: `testid ${show(texts[0])}: a composed testid starts from a testid prop or scope (\`\${testId}.part\`, \`\${testIdScope}.part\`), not \`${context.sourceCode.getText(prefix)}\`; put other runtime data in the key.`,
                    });
                }
                const seen = new Set();
                for (const text of texts) {
                    const error = grammarError(text, {withRole});
                    if (error && !seen.has(error)) {
                        seen.add(error);
                        context.report({node: leaf, message: `testid ${show(text)}: ${error}.`});
                    }
                }
                return;
            }
            if (isStringConcat(leaf)) {
                context.report({node: leaf, message: 'testid built with "+": write it as a template literal (`scope.name:${key}--role`) with a literal scope and name.'});
                return;
            }
            if (leaf.type === 'CallExpression') {
                context.report({node: leaf, message: 'Declare testids as string literals or template literals.'});
            }
        };

        const checkTarget = (node) => {
            const kind = testIdKind(node, kindOf);
            if (!kind) {
                return;
            }
            const value = testIdValueNode(node);
            if (!value) {
                return;
            }
            if (value.type === 'LogicalExpression' && value.operator === '&&' && isPassThroughName(value.left)) {
                context.report({node: value, message: 'Guard a missing scope with a conditional expression returning undefined; && can render an empty testid.'});
            }
            for (const leaf of valueLeaves(value)) {
                checkLeaf(leaf, kind === 'full');
            }
        };

        return {
            JSXAttribute: checkTarget,
            Property: checkTarget,
        };
    },
};
