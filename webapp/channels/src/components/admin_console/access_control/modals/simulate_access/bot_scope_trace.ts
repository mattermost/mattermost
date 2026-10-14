// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PolicySimulationEvaluationNode} from '@mattermost/types/access_control';
import {
    POLICY_SIMULATION_EVALUATION_NODE_KIND,
    POLICY_SIMULATION_EVALUATION_OUTCOME,
} from '@mattermost/types/access_control';

import {
    BOT_SCOPE_PREFIX,
    findMatchingParen,
    isBotScopeExpression,
    unwrapBotExpression,
} from '../../editors/bot_scope';

// Attribute-value masking rebuilds compound text from its children, so a masked
// trace carries the guard as `(!(user.isbot)) || (E)`.
const MASKED_BOT_SCOPE_PREFIX = '(!(user.isbot)) || ';
const BOT_GUARD_TEXTS = ['!user.isbot', '!(user.isbot)'];

function stripEnclosingParens(expr: string): string {
    const trimmed = expr.trim();
    if (trimmed.startsWith('(') && findMatchingParen(trimmed, 0) === trimmed.length - 1) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

function splitTopLevelOr(expr: string): string[] | null {
    const segments: string[] = [];
    let i = 0;
    while (i < expr.length) {
        if (expr[i] !== '(') {
            return null;
        }
        const close = findMatchingParen(expr, i);
        if (close === -1) {
            return null;
        }
        segments.push(expr.slice(i, close + 1));
        const rest = expr.slice(close + 1).trimStart();
        if (rest === '') {
            break;
        }
        if (!rest.startsWith('||')) {
            return null;
        }
        const next = rest.slice(2).trimStart();
        i = expr.length - next.length;
    }
    return segments.length > 1 ? segments : null;
}

// JoinExpressions folds every rule sharing an action as `(r1) || (r2)`, and masking
// nests the fold as `((r1') || (r2')) || (r3')`. Every segment must be Bot-scoped.
function unwrapBotRules(expr: string): string[] | null {
    const inner = stripEnclosingParens(expr);
    if (isBotScopeExpression(inner)) {
        return [unwrapBotExpression(inner)];
    }
    if (inner.startsWith(MASKED_BOT_SCOPE_PREFIX)) {
        return [unwrapBotExpression(BOT_SCOPE_PREFIX + inner.slice(MASKED_BOT_SCOPE_PREFIX.length))];
    }
    const segments = splitTopLevelOr(inner);
    if (!segments) {
        return null;
    }
    const rules: string[] = [];
    for (const segment of segments) {
        const unwrapped = unwrapBotRules(segment);
        if (!unwrapped) {
            return null;
        }
        rules.push(...unwrapped);
    }
    return rules;
}

// Accepts the raw rule, the simulator's JoinExpressions form `(!user.isbot || (E))`,
// the masked form, and multi-rule folds of those. Anything else is returned unchanged.
export function unwrapBotTraceExpression(expr: string): string {
    const rules = unwrapBotRules(expr);
    if (!rules) {
        return expr;
    }
    if (rules.length === 1) {
        return rules[0];
    }
    return rules.map((rule) => `(${rule})`).join(' || ');
}

function isBotGuardNode(node: PolicySimulationEvaluationNode): boolean {
    if (BOT_GUARD_TEXTS.includes(node.expression.trim())) {
        return true;
    }
    const children = node.children;
    return node.kind === POLICY_SIMULATION_EVALUATION_NODE_KIND.NOT &&
        children !== undefined &&
        children.length === 1 &&
        children[0].expression.trim() === 'user.isbot';
}

function hasBotGuard(node: PolicySimulationEvaluationNode): boolean {
    const children = node.children;
    if (node.kind !== POLICY_SIMULATION_EVALUATION_NODE_KIND.OR || children === undefined || children.length !== 2) {
        return false;
    }
    return isBotGuardNode(children[0]) || hasBotGuard(children[0]);
}

// Server trees are binary. A chain (`!user.isbot || a || b`) parses left-nested as
// `(!user.isbot || a) || b`, so a rule's guard is its leftmost disjunct; a multi-rule
// fold puts a guarded rule (or a nested fold) on each side.
// A guard that evaluated true (a person) is kept: it is why the policy allowed them.
export function unwrapBotTraceTree(node: PolicySimulationEvaluationNode): PolicySimulationEvaluationNode {
    const children = node.children;
    if (node.kind !== POLICY_SIMULATION_EVALUATION_NODE_KIND.OR || children === undefined || children.length !== 2) {
        return node;
    }
    const [first, second] = children;
    if (isBotGuardNode(first)) {
        return first.outcome === POLICY_SIMULATION_EVALUATION_OUTCOME.TRUE ? node : second;
    }
    if (!hasBotGuard(first)) {
        return node;
    }
    const left = unwrapBotTraceTree(first);
    const right = hasBotGuard(second) ? unwrapBotTraceTree(second) : second;
    if (left === first && right === second) {
        return node;
    }
    return {...node, expression: unwrapBotTraceExpression(node.expression), children: [left, right]};
}

// Flat text has no outcomes, so when a tree is available it decides: the guard is
// stripped from the text only if unwrapBotTraceTree stripped it from the tree.
export function unwrapBotTraceExpressionForTree(expr: string, tree?: PolicySimulationEvaluationNode): string {
    if (tree && unwrapBotTraceTree(tree) === tree) {
        return expr;
    }
    return unwrapBotTraceExpression(expr);
}
