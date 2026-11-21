// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The last action is observed before the function turns away from the page.
//
// After an action, turning away (any other awaited call, `return`, the end of the function) is an error unless an
// observation came between. Actions in a chain need nothing between them: Playwright waits for the target of each
// next action, so an earlier action followed directly by another is no longer pending; only the last one is.
//
// An observation is an awaited retrying assertion, `expect.poll`, `toPass`, an action made through `settle(...)`, a
// `clickTo`/`pressTo`, or `await Promise.all([<waiters>, <one action>])` (awaited or returned: a floating one observes
// nothing). Each function is checked on its own, on every path: paths join by "pending on any path", loops run to a
// fixed point, and a `catch` starts from every state its `try` passed through. A `finally` continues the normal exit:
// on a throw the function fails right after it, so what the throw left pending is not checked there, unless the
// `finally` returns and so swallows the throw.
import {assertionOf, classifier, isObservation, label, unwrap, usedBy} from './actions.js';

const FUNCTION = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const LOOP = new Set(['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement']);
const MAX_ITERATIONS = 32;
const EXPRESSION_WRAPPERS = new Set(['TSNonNullExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);

/** Whether a statement returns from its own function (a `return` not inside a nested function). */
function returnsIn(node) {
    if (!node || typeof node.type !== 'string' || FUNCTION.has(node.type)) {
        return false;
    }
    if (node.type === 'ReturnStatement') {
        return true;
    }
    return Object.entries(node).some(([key, value]) => key !== 'parent' && (Array.isArray(value) ? value.some(returnsIn) : value && typeof value === 'object' && returnsIn(value)));
}

/** States are maps from the pending action's call to the action: immutable, joined by union. */
function join(...states) {
    const live = states.filter(Boolean);
    if (!live.length) {
        return null;
    }
    if (live.length === 1) {
        return live[0];
    }
    const out = new Map();
    for (const state of live) {
        for (const [key, value] of state) {
            out.set(key, value);
        }
    }
    return out;
}

function same(a, b) {
    if (a === b) {
        return true;
    }
    if (!a || !b || a.size !== b.size) {
        return false;
    }
    for (const key of a.keys()) {
        if (!b.has(key)) {
            return false;
        }
    }
    return true;
}

const EMPTY = new Map();

/** A state without the actions of these calls. */
function without(state, calls) {
    if (!state) {
        return state;
    }
    const out = new Map(state);
    calls.forEach((call) => out.delete(call));
    return out;
}

export default {
    meta: {
        type: 'problem',
        docs: {description: 'Observe the last action before turning away from the page'},
        schema: [],
        messages: {
            away: 'observe `{{earlier}}` before {{what}}: `settle` if it saves, otherwise an `expect` on what it changed.',
            unsupported: '{{form}} holding an action is not a supported form: await the action, or use `await Promise.all([waitForApi(...), <one action>])`.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const {actionOf, compositionOf, isAliasedVerb} = classifier(context);
        const keys = sourceCode.visitorKeys;
        const reported = new Set();

        const report = (node, messageId, data) => {
            const key = `${messageId}:${node.range[0]}:${data.earlier ?? data.form}`;
            if (!reported.has(key)) {
                reported.add(key);
                context.report({node, messageId, data});
            }
        };

        /** Checks one function body. */
        const analyze = (body, isExpression) => {
            const collectors = [];

            // an action is reported once, at its first boundary: the fix is the same wherever it is reported
            const turnedAway = new Set();
            const frames = [];
            const note = (state) => collectors.forEach((states) => states.push(state));

            const latest = (pending) => [...pending.values()].pop();

            /**
             * An action performed. An earlier action that is not preparing is chained into this one and no longer
             * pending (Playwright waits for this action's target); the preparing actions before it were part of its
             * step. This action is pending unless it observes itself. A report never clears anything, so a disabled
             * report leaves the state as it was.
             */
            const act = (action, state) => {
                note(state);
                const chained = [...state.values()].filter((earlier) => !earlier.preparing).map((earlier) => earlier.call);
                if (action.observed) {
                    return new Map();
                }
                const next = without(state, chained);
                next.set(action.call, action);
                return next;
            };

            const observe = (state) => {
                note(state);
                return EMPTY;
            };

            /**
             * Turning away with actions pending reports those not reported at an earlier boundary. They stay pending,
             * whether or not this report is disabled.
             */
            const away = (node, what, state) => {
                note(state);
                const unreported = [...state.values()].filter((pending) => !turnedAway.has(pending.call));
                if (unreported.length) {
                    report(node, 'away', {earlier: label(sourceCode, latest(new Map(unreported.map((a) => [a.call, a])))), what});
                    unreported.forEach((pending) => turnedAway.add(pending.call));
                }
                return state;
            };

            const children = (node, state) => {
                let current = state;
                for (const key of keys[node.type] ?? []) {
                    const value = node[key];
                    for (const child of Array.isArray(value) ? value : [value]) {
                        if (child && typeof child.type === 'string' && current) {
                            current = expression(child, current);
                        }
                    }
                }
                return current;
            };

            /** An expression evaluated from `state`; returns the state after it. */
            const expression = (node, state) => {
                if (FUNCTION.has(node.type) || (node.type.startsWith('TS') && !EXPRESSION_WRAPPERS.has(node.type))) {
                    return state;
                }
                switch (node.type) {
                case 'ConditionalExpression': {
                    const tested = expression(node.test, state);
                    return join(expression(node.consequent, tested), expression(node.alternate, tested));
                }
                case 'LogicalExpression': {
                    const left = expression(node.left, state);
                    return join(left, expression(node.right, left));
                }
                case 'AwaitExpression': {
                    const argument = unwrap(node.argument);
                    if (argument.type === 'CallExpression') {
                        if (isObservation(argument)) {
                            return observe(state);
                        }
                        if (assertionOf(argument)) {
                            return children(argument, state);
                        }
                        const handled = call(argument, state);
                        if (handled) {
                            return handled.state;
                        }
                    }
                    const evaluated = expression(node.argument, state);
                    return away(node, 'the next awaited call', evaluated);
                }
                case 'CallExpression': {
                    const handled = call(node, state);
                    return handled ? handled.state : children(node, state);
                }
                case 'MemberExpression':
                    if (isAliasedVerb(node)) {
                        report(node, 'unsupported', {form: `\`${sourceCode.getText(node)}\` read without calling it`});
                    }
                    return children(node, state);
                default:
                    return children(node, state);
                }
            };

            /** A call that is an action or a composition: `{state}` after it, or null for any other call. */
            const call = (node, state) => {
                const composed = compositionOf(node);
                if (composed) {
                    if (composed.accepted) {
                        const {child, parent} = usedBy(node);
                        const awaited = parent?.type === 'AwaitExpression' || parent?.type === 'ReturnStatement' || (parent?.type === 'ArrowFunctionExpression' && parent.body === child);
                        return {state: act({...composed.action, observed: awaited}, state)};
                    }

                    // Reported once as the form; the actions in it are checked against what came before, then dropped.
                    report(node, 'unsupported', {form: `\`${sourceCode.getText(unwrap(node.callee))}\``});
                    return {state: without(children(node, state), composed.elements)};
                }
                const action = actionOf(node);
                if (!action) {
                    return null;
                }
                const {parent} = usedBy(node);
                const chained = parent?.type === 'MemberExpression' && ['then', 'catch', 'finally'].includes(parent.property?.name);
                if (chained) {
                    report(node, 'unsupported', {form: `\`.${parent.property.name}\``});
                }
                if (action.unsupported) {
                    report(node, 'unsupported', {form: 'A computed method name'});
                }
                const evaluated = node.arguments.reduce((current, argument) => (current ? expression(argument, current) : current), state);
                const after = evaluated && act(action, evaluated);
                return {state: chained ? without(after, [node]) : after};
            };

            const loop = (node, state, labels) => {
                const frame = {loop: true, labels, breaks: [], continues: []};
                frames.push(frame);
                let entry = state;
                if (node.type === 'ForStatement' && node.init) {
                    entry = node.init.type === 'VariableDeclaration' ? statement(node.init, entry) : expression(node.init, entry);
                }
                if ((node.type === 'ForOfStatement' || node.type === 'ForInStatement')) {
                    entry = expression(node.right, entry);
                }
                if (node.type === 'DoWhileStatement') {
                    entry = statement(node.body, entry) ?? entry;
                }
                let head = entry;
                let tested = head;
                for (let i = 0; i < MAX_ITERATIONS; i++) {
                    frame.breaks = [];
                    frame.continues = [];
                    tested = node.test ? expression(node.test, head) : head;
                    const out = join(statement(node.body, tested), ...frame.continues);
                    const updated = out && node.type === 'ForStatement' && node.update ? expression(node.update, out) : out;
                    const widened = join(head, updated);
                    if (same(widened, head)) {
                        break;
                    }
                    head = widened;
                }
                frames.pop();
                const runsForever = node.type === 'ForStatement' && !node.test;
                return join(runsForever ? null : tested, ...frame.breaks);
            };

            const target = (node, kind) => {
                for (let i = frames.length - 1; i >= 0; i--) {
                    const frame = frames[i];
                    const unlabeled = kind === 'continue' ? frame.loop : frame.loop || frame.switch;
                    if (node.label ? frame.labels.includes(node.label.name) : unlabeled) {
                        return frame;
                    }
                }
                return null;
            };

            /** A statement executed from `state`; returns the state after it, or null when no path continues. */
            const statement = (node, state, labels = []) => {
                if (!state) {
                    return null;
                }
                if (LOOP.has(node.type)) {
                    return loop(node, state, labels);
                }
                switch (node.type) {
                case 'BlockStatement':
                case 'StaticBlock': {
                    let current = state;
                    for (const child of node.body) {
                        current = statement(child, current);
                        if (!current) {
                            return null;
                        }
                    }
                    return current;
                }
                case 'ExpressionStatement':
                    return expression(node.expression, state);
                case 'VariableDeclaration':
                    return node.declarations.reduce((current, declarator) => (current && declarator.init ? expression(declarator.init, current) : current), state);
                case 'ReturnStatement': {
                    const evaluated = node.argument ? expression(node.argument, state) : state;
                    if (evaluated) {
                        away(node, 'returning', evaluated);
                    }
                    return null;
                }
                case 'ThrowStatement': {
                    // where an enclosing catch, or a finally that returns, starts from
                    const thrown = node.argument ? expression(node.argument, state) : state;
                    if (thrown) {
                        note(thrown);
                    }
                    return null;
                }
                case 'IfStatement': {
                    const tested = expression(node.test, state);
                    return join(statement(node.consequent, tested), node.alternate ? statement(node.alternate, tested) : tested);
                }
                case 'LabeledStatement': {
                    if (LOOP.has(node.body.type)) {
                        return statement(node.body, state, [...labels, node.label.name]);
                    }
                    const frame = {labels: [...labels, node.label.name], breaks: []};
                    frames.push(frame);
                    const out = statement(node.body, state);
                    frames.pop();
                    return join(out, ...frame.breaks);
                }
                case 'BreakStatement':
                case 'ContinueStatement': {
                    const frame = target(node, node.type === 'BreakStatement' ? 'break' : 'continue');
                    frame?.[node.type === 'BreakStatement' ? 'breaks' : 'continues'].push(state);
                    return null;
                }
                case 'SwitchStatement': {
                    const tested = expression(node.discriminant, state);
                    const frame = {switch: true, labels, breaks: []};
                    frames.push(frame);
                    let fall = null;
                    for (const branch of node.cases) {
                        let current = join(tested, fall);
                        for (const child of branch.consequent) {
                            current = statement(child, current);
                        }
                        fall = current;
                    }
                    frames.pop();
                    return join(fall, ...frame.breaks, node.cases.some((branch) => !branch.test) ? null : tested);
                }
                case 'TryStatement': {
                    const seen = [];
                    collectors.push(seen);
                    const tried = statement(node.block, state);
                    collectors.pop();
                    let caught = null;
                    const catchEntry = node.handler ? join(state, ...seen, tried) : null;
                    const seenInCatch = [];
                    if (node.handler) {
                        collectors.push(seenInCatch);
                        caught = statement(node.handler.body, catchEntry);
                        collectors.pop();
                    }
                    const entry = node.handler ? join(tried, caught) : tried;
                    if (node.finalizer) {
                        // A finally that returns swallows a throw, so the function goes on from what the throw left
                        // pending: check it from those states too. One that only cleans up is checked from the normal
                        // exit, since on a throw the function fails right after it.
                        const thrown = node.handler ? join(catchEntry, ...seenInCatch) : join(state, ...seen);
                        if (returnsIn(node.finalizer) && thrown) {
                            statement(node.finalizer, thrown);
                        }

                        // with no normal exit, the finally's own actions are still checked
                        const finished = statement(node.finalizer, entry ?? EMPTY);
                        return entry ? finished : null;
                    }
                    return entry;
                }
                default:
                    return state;
                }
            };

            const end = isExpression ? expression(body, EMPTY) : statement(body, EMPTY);
            if (isExpression && end) {
                away(body, 'returning', end);
            } else if (end) {
                for (const pending of end.values()) {
                    if (!turnedAway.has(pending.call)) {
                        report(pending.call, 'away', {earlier: label(sourceCode, pending), what: 'the function ends'});
                    }
                }
            }
        };

        return {
            Program(node) {
                analyze({type: 'BlockStatement', body: node.body.filter((child) => !FUNCTION.has(child.type))}, false);
            },
            ':function'(node) {
                analyze(node.body, node.body.type !== 'BlockStatement');
            },
        };
    },
};
