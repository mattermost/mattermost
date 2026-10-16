// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PolicySimulationEvaluationNode} from '@mattermost/types/access_control';
import {
    POLICY_SIMULATION_EVALUATION_NODE_KIND,
    POLICY_SIMULATION_EVALUATION_OUTCOME,
} from '@mattermost/types/access_control';

// Attribute-value masking rebuilds NOT text as `!(child)`.
const BOT_GUARD_TEXTS = ['!user.isbot', '!(user.isbot)'];

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

// Same shape as the server's masked compound text: empty operands are skipped.
function joinOr(children: PolicySimulationEvaluationNode[]): string {
    return children.
        filter((child) => child.expression).
        map((child) => `(${child.expression})`).
        join(' || ');
}

// Server trees are binary. A chain (`!user.isbot || a || b`) parses left-nested as
// `(!user.isbot || a) || b`, so a rule's guard is its leftmost disjunct; a multi-rule
// fold puts a guarded rule (or a nested fold) on each side.
// A guard that evaluated true (a person) is kept: it is why the policy allowed them.
// Returns `node` itself when no guard is removed.
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
    return {...node, expression: joinOr([left, right]), children: [left, right]};
}

type BotTrace = {
    expression: string;
    evaluationTree?: PolicySimulationEvaluationNode;
};

// Text has no outcomes, so the tree decides: the guard leaves the text only when it left
// the tree. Without a tree the text is returned as-is.
export function unwrapBotTrace(expression: string, tree?: PolicySimulationEvaluationNode): BotTrace {
    if (!tree) {
        return {expression};
    }
    const evaluationTree = unwrapBotTraceTree(tree);
    return {expression: evaluationTree === tree ? expression : evaluationTree.expression, evaluationTree};
}
