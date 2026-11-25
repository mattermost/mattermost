// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const EN_JSON = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../webapp/channels/src/i18n/en.json');
let appCopy;

/** en.json messages with placeholders and markdown removed; empty when the webapp is not checked out. */
function loadAppCopy() {
    if (!appCopy) {
        try {
            const raw = JSON.parse(readFileSync(EN_JSON, 'utf8'));
            appCopy = Object.values(raw).map((val) =>
                (typeof val === 'string' ? val : (val.defaultMessage ?? '')).replace(/\{[^}]*\}|\*\*/g, '\u0000'),
            );
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
            appCopy = [];
        }
    }
    return appCopy;
}

/** Case-sensitive: a phrase found inside a message, or a single word that is a whole message (a title, a label). */
function isAppCopy(text) {
    const needle = text.trim();
    if (needle.length < 4) {
        return false;
    }
    return loadAppCopy().some((msg) => (needle.includes(' ') ? msg.includes(needle) : msg.trim() === needle));
}

const PROBE_METHODS = new Set([
    'isVisible',
    'isHidden',
    'isChecked',
    'isEnabled',
    'isDisabled',
    'isEditable',
    'count',
    'textContent',
    'innerText',
    'inputValue',
    'getAttribute',
]);
const POSITIONAL_METHODS = new Set(['first', 'last', 'nth']);

// `.cls`, `#id`, `[attr]`, or a tag-qualified class/id/attribute such as `div.post` or `button[aria-label]`.
const CSS_SELECTOR_HINT = /^(?:[a-z][a-z0-9-]*)?[.#[]/i;

/** Static text of a string literal, or the leading static part of a template literal. */
function staticString(node) {
    if (node?.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    return node?.type === 'TemplateLiteral' ? node.quasis[0].value.cooked : undefined;
}

function insidePollCallback(node) {
    for (let cur = node.parent; cur; cur = cur.parent) {
        if (cur.type === 'CallExpression' && cur.callee?.type === 'MemberExpression') {
            const prop = cur.callee.property?.name;

            // pw.waitUntil re-runs its callback (async-wait-until), so a probe inside it retries.
            if (prop === 'poll' || prop === 'toPass' || prop === 'waitUntil') {
                return true;
            }
        }
    }
    return false;
}

function isEmptyCatch(block) {
    if (!block || block.body.length === 0) {
        return true;
    }
    return block.body.length === 1 && block.body[0].type === 'ReturnStatement';
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const ACTION_METHODS = new Set([
    'click',
    'dblclick',
    'tap',
    'press',
    'pressSequentially',
    'fill',
    'type',
    'clear',
    'check',
    'uncheck',
    'setChecked',
    'selectOption',
    'setInputFiles',
    'hover',
    'dragTo',
]);
const WAITER_CALLS = new Set(['settle', 'waitForApi']);
const OBSERVING_METHODS = new Set(['waitUntil', 'clickTo', 'pressTo', 'toPass', 'poll']);
const WRAPPERS = new Set(['TSNonNullExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'ChainExpression']);

// Calls that leave the page: server/API clients, test infra, navigation. Page-object calls are not among them,
// because their next interaction waits for its own target the way a following action does.
const AWAY_ROOTS = /^(?:\w*client|pw|test|fetch|request)$/i;
const AWAY_METHODS = new Set(['goto', 'reload', 'goBack', 'goForward']);
const ASSERTION_METHOD = /^(?:to|notTo)[A-Z]/;
const WAIT_METHOD = /^waitFor/;
const PAGE_OBJECT_NAME = /Page$/;

function unwrap(node) {
    let cur = node;
    while (cur && WRAPPERS.has(cur.type)) {
        cur = cur.expression;
    }
    return cur;
}

function methodName(call) {
    const callee = unwrap(call.callee);
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        return callee.property.name;
    }
    return callee.type === 'Identifier' ? callee.name : '';
}

/** Every call in a fluent chain, outermost first: `expect(x).not.toBeVisible()` -> [toBeVisible(), expect(x)]. */
function chainCalls(call) {
    const calls = [];
    for (let cur = unwrap(call); cur;) {
        if (cur.type === 'CallExpression') {
            calls.push(cur);
            cur = unwrap(cur.callee);
        } else if (cur.type === 'MemberExpression') {
            cur = unwrap(cur.object);
        } else {
            return {calls, root: cur.type === 'Identifier' ? cur.name : ''};
        }
    }
    return {calls, root: ''};
}

/** `observation`, `action`, `away` (leaves the page) or `page` (a page-object step) for an awaited expression. */
function classifyAwaited(expr) {
    const node = unwrap(expr);

    // Awaiting a promise made earlier (`const resp = page.waitForResponse(...)`) waits for what the action caused.
    if (node?.type === 'Identifier' || node?.type === 'MemberExpression') {
        return 'observation';
    }
    if (node?.type !== 'CallExpression') {
        return 'away';
    }
    const {calls, root} = chainCalls(node);
    const names = calls.map(methodName);
    const observes = (n) =>
        WAITER_CALLS.has(n) || OBSERVING_METHODS.has(n) || ASSERTION_METHOD.test(n) || WAIT_METHOD.test(n);
    if (root === 'expect' || names.some(observes)) {
        return 'observation';
    }
    if (names[0] === 'all' && root === 'Promise') {
        const items = node.arguments[0]?.type === 'ArrayExpression' ? node.arguments[0].elements : [];
        return items.some((item) => item && classifyAwaited(item) === 'observation') ? 'observation' : 'away';
    }
    if (ACTION_METHODS.has(names[0])) {
        return 'action';
    }
    if (AWAY_METHODS.has(names[0])) {
        return 'away';
    }

    // `pw.keycloakLoginPage.login()` is a page object reached through the fixture, not test infra.
    const callee = unwrap(node.callee);
    const owner = callee.type === 'MemberExpression' ? unwrap(callee.object) : undefined;
    const viaFixturePage =
        owner?.type === 'MemberExpression' &&
        owner.property.type === 'Identifier' &&
        PAGE_OBJECT_NAME.test(owner.property.name);
    return AWAY_ROOTS.test(root) && !viaFixturePage ? 'away' : 'page';
}

/** Awaits inside one statement in evaluation order (operands first), not entering nested functions. */
function awaitsIn(node, out = []) {
    if (!node || typeof node.type !== 'string' || FUNCTION_TYPES.has(node.type)) {
        return out;
    }
    for (const [key, value] of Object.entries(node)) {
        if (key === 'parent') {
            continue;
        }
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child && typeof child.type === 'string') {
                awaitsIn(child, out);
            }
        }
    }
    if (node.type === 'AwaitExpression') {
        out.push(node);
    }
    return out;
}

function label(context, node) {
    const text = context.sourceCode.getText(node).replace(/\s+/g, ' ');
    return text.length > 70 ? `${text.slice(0, 67)}...` : text;
}

/**
 * Straight-line check of one statement list. An action stays pending until an observation; a following action or
 * page-object step chains it (Playwright waits for the next target). An API/infra/navigation call, a return, a nested
 * block or the end of the list with an action pending is reported.
 * shortcut: no path joins or loop fixed points (Peter's e2e-observe-actions); entering an if/loop/try with an action
 * pending is reported, so it over-reports there (an expect fixes it) and never misses straight-line code.
 */
function checkStatements(context, statements) {
    let pending;
    const turnAway = (what) => {
        if (pending) {
            context.report({node: pending, messageId: 'unobserved', data: {action: label(context, pending), what}});
            pending = undefined;
        }
    };
    const step = (expr) => {
        const kind = classifyAwaited(expr);
        if (kind === 'observation' || kind === 'page') {
            pending = undefined;
        } else if (kind === 'action') {
            pending = unwrap(expr);
        } else {
            turnAway(`\`${label(context, expr)}\``);
        }
    };
    for (const stmt of statements) {
        if (stmt.type === 'ReturnStatement') {
            awaitsIn(stmt.argument).forEach((aw) => step(aw.argument));
            if (
                stmt.argument &&
                stmt.argument.type !== 'AwaitExpression' &&
                classifyAwaited(stmt.argument) === 'action'
            ) {
                pending = unwrap(stmt.argument);
            }
            turnAway('returning');
            return;
        }
        const nested = nestedBlocks(stmt);
        if (nested) {
            awaitsIn(nested.head).forEach((aw) => step(aw.argument));
            turnAway(`entering this ${stmt.type.replace('Statement', '').toLowerCase()} block`);
            nested.bodies.forEach((body) => checkStatements(context, body));
            continue;
        }
        awaitsIn(stmt).forEach((aw) => step(aw.argument));
    }
    turnAway('the end of the block');
}

/** Head expression and inner statement lists of a compound statement; undefined for a simple one. */
function nestedBlocks(stmt) {
    const list = (node) => {
        if (!node) {
            return [];
        }
        return [node.type === 'BlockStatement' ? node.body : [node]];
    };
    const loop = () => ({head: stmt.test, bodies: list(stmt.body)});
    const shapes = {
        BlockStatement: () => ({head: null, bodies: [stmt.body]}),
        IfStatement: () => ({head: stmt.test, bodies: [...list(stmt.consequent), ...list(stmt.alternate)]}),
        ForStatement: loop,
        WhileStatement: loop,
        DoWhileStatement: loop,
        ForInStatement: () => ({head: stmt.right, bodies: list(stmt.body)}),
        ForOfStatement: () => ({head: stmt.right, bodies: list(stmt.body)}),
        TryStatement: () => ({
            head: null,
            bodies: [
                stmt.block.body,
                ...(stmt.handler ? [stmt.handler.body.body] : []),
                ...(stmt.finalizer ? [stmt.finalizer.body] : []),
            ],
        }),
        SwitchStatement: () => ({head: stmt.discriminant, bodies: stmt.cases.map((c) => c.consequent)}),
        LabeledStatement: () => ({head: null, bodies: list(stmt.body)}),
    };
    return shapes[stmt.type]?.();
}

/** Web-first matchers that retry and return a promise; `expect(value).toBe()` and friends are synchronous. */
const ASYNC_MATCHERS = new Set([
    'toBeAttached',
    'toBeChecked',
    'toBeDisabled',
    'toBeEditable',
    'toBeEmpty',
    'toBeEnabled',
    'toBeFocused',
    'toBeHidden',
    'toBeInViewport',
    'toBeOK',
    'toBeVisible',
    'toContainClass',
    'toContainText',
    'toHaveAccessibleDescription',
    'toHaveAccessibleErrorMessage',
    'toHaveAccessibleName',
    'toHaveAttribute',
    'toHaveCSS',
    'toHaveClass',
    'toHaveCount',
    'toHaveId',
    'toHaveJSProperty',
    'toHavePath',
    'toHaveRole',
    'toHaveScreenshot',
    'toHaveText',
    'toHaveTitle',
    'toHaveURL',
    'toHaveValue',
    'toHaveValues',
    'toMatchAriaSnapshot',
    'toPass',
]);

/** Whether an un-awaited call statement starts an action or a retrying assertion that nobody waits for. */
function floatingKind(call) {
    const name = methodName(call);
    const {calls, root} = chainCalls(call);
    const poll = calls.some((c) => methodName(c) === 'poll');
    if (ASYNC_MATCHERS.has(name) || (poll && ASSERTION_METHOD.test(name))) {
        return 'assertion';
    }
    if (root !== 'expect' && ACTION_METHODS.has(name)) {
        return 'action';
    }
    return undefined;
}

function containsAwait(node) {
    if (!node || typeof node !== 'object') {
        return false;
    }
    if (node.type === 'AwaitExpression') {
        return true;
    }
    if (FUNCTION_TYPES.has(node.type)) {
        return false;
    }
    return Object.entries(node).some(
        ([key, value]) =>
            key !== 'parent' &&
            (Array.isArray(value) ? value.some(containsAwait) : value?.type !== undefined && containsAwait(value)),
    );
}

const DISABLE_COMMENT = /^\s*eslint-disable(?:-next-line|-line)?(?:\s+([^]*?))?\s*$/;

export const rules = {
    'no-sleeps': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    const callee = node.callee;
                    if (callee.type === 'MemberExpression' && callee.property.name === 'waitForTimeout') {
                        context.report({node, message: 'Avoid waitForTimeout(); assert on UI or API state instead.'});
                    }
                    if (
                        callee.type === 'MemberExpression' &&
                        callee.property.name === 'waitForLoadState' &&
                        node.arguments[0]?.value === 'networkidle'
                    ) {
                        context.report({
                            node,
                            message:
                                'Avoid waitForLoadState("networkidle"); wait for a specific element or API response.',
                        });
                    }
                    if (callee.type === 'Identifier' && callee.name === 'setTimeout') {
                        context.report({node, message: 'Avoid setTimeout waits in Playwright specs.'});
                    }
                },
            };
        },
    },
    'no-probes': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression') {
                        return;
                    }
                    const name = node.callee.property?.name;
                    if (PROBE_METHODS.has(name) && !insidePollCallback(node)) {
                        context.report({
                            node,
                            message: `Avoid instant probe .${name}() outside expect.poll()/toPass(); use retrying expect() assertions.`,
                        });
                    }
                },
            };
        },
    },
    'no-swallowed-catch': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression' || node.callee.property?.name !== 'catch') {
                        return;
                    }
                    const arg = node.arguments[0];
                    if (arg && (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')) {
                        if (arg.body.type !== 'BlockStatement' || isEmptyCatch(arg.body)) {
                            context.report({
                                node,
                                message: 'Do not swallow errors in .catch(); let failures surface or rethrow.',
                            });
                        }
                    }
                },
                CatchClause(node) {
                    if (isEmptyCatch(node.body)) {
                        context.report({
                            node,
                            message: 'Do not swallow errors with an empty or value-only catch block.',
                        });
                    }
                },
            };
        },
    },
    'no-positional-picks': {
        meta: {type: 'suggestion', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression') {
                        return;
                    }
                    const name = node.callee.property?.name;
                    if (POSITIONAL_METHODS.has(name)) {
                        context.report({
                            node,
                            message: `Avoid positional .${name}() selector picks; use a stable key or unique role/text.`,
                        });
                    }
                },
            };
        },
    },
    'no-raw-css-locators': {
        meta: {type: 'suggestion', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression' || node.callee.property?.name !== 'locator') {
                        return;
                    }
                    const text = staticString(node.arguments[0]);
                    if (text !== undefined && CSS_SELECTOR_HINT.test(text)) {
                        context.report({
                            node,
                            message: `Avoid raw CSS selector "${text}" in locator(); use getByTestId or semantic role locators.`,
                        });
                    }
                },
            };
        },
    },
    'observe-actions': {
        meta: {
            type: 'problem',
            schema: [],
            messages: {
                unobserved:
                    'Observe `{{action}}` before {{what}}: settle(...) if it saves, otherwise an expect on what it changed.',
            },
        },
        create(context) {
            const checkFunction = (fn) => {
                if (fn.body.type === 'BlockStatement') {
                    checkStatements(context, fn.body.body);
                } else if (
                    classifyAwaited(fn.body.type === 'AwaitExpression' ? fn.body.argument : fn.body) === 'action'
                ) {
                    context.report({
                        node: fn.body,
                        messageId: 'unobserved',
                        data: {action: label(context, fn.body), what: 'returning'},
                    });
                }
            };
            return {
                FunctionDeclaration: checkFunction,
                FunctionExpression: checkFunction,
                ArrowFunctionExpression: checkFunction,
            };
        },
    },
    'no-literal-absence': {
        meta: {
            type: 'problem',
            schema: [],
            messages: {
                literal:
                    'Absence of literal text "{{text}}" passes forever once the copy changes; use Msg[...] so a removed key fails tsc and new copy flows in.',
            },
        },
        create(context) {
            /** The literal a text locator matches: getByText('x'), getByRole(r, {name: 'x'}), getByLabel('x'). */
            const literalText = (call) => {
                const name = methodName(call);
                const [first, second] = call.arguments;
                if (name === 'getByText' || name === 'getByLabel' || name === 'getByPlaceholder') {
                    return staticString(first);
                }
                if (name === 'getByRole' && second?.type === 'ObjectExpression') {
                    const prop = second.properties.find(
                        (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'name',
                    );
                    return prop && staticString(prop.value);
                }
                return undefined;
            };
            const isAbsence = (node) => {
                const name = methodName(node);
                const negated =
                    unwrap(node.callee).type === 'MemberExpression' &&
                    unwrap(unwrap(node.callee).object).type === 'MemberExpression' &&
                    unwrap(unwrap(node.callee).object).property.name === 'not';
                return (
                    name === 'toBeHidden' ||
                    (negated && (name === 'toBeVisible' || name === 'toBeAttached')) ||
                    (name === 'toHaveCount' && node.arguments[0]?.type === 'Literal' && node.arguments[0].value === 0)
                );
            };
            return {
                CallExpression(node) {
                    if (!isAbsence(node)) {
                        return;
                    }
                    const expectCall = chainCalls(node).calls.find(
                        (call) => unwrap(call.callee).type === 'Identifier' && unwrap(call.callee).name === 'expect',
                    );
                    const target = expectCall?.arguments[0];
                    if (!target || unwrap(target).type !== 'CallExpression') {
                        return;
                    }
                    for (const call of chainCalls(target).calls) {
                        const text = literalText(call);

                        // Test-created data (a marking value, a channel name) is not copy that can change under the test.
                        if (text !== undefined && isAppCopy(text)) {
                            context.report({node, messageId: 'literal', data: {text}});
                            return;
                        }
                    }
                },
            };
        },
    },
    'no-floating-actions': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                ExpressionStatement(node) {
                    let expr = unwrap(node.expression);
                    if (expr.type === 'UnaryExpression' && expr.operator === 'void') {
                        expr = unwrap(expr.argument);
                    }
                    const kind = expr.type === 'CallExpression' ? floatingKind(expr) : undefined;
                    if (kind) {
                        context.report({
                            node,
                            message: `Await this ${kind}; un-awaited, the test moves on before it finishes and its failure is lost.`,
                        });
                    }
                },
            };
        },
    },
    'no-soft-assertions': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                MemberExpression(node) {
                    if (
                        node.object.type === 'Identifier' &&
                        node.object.name === 'expect' &&
                        node.property.name === 'soft'
                    ) {
                        context.report({
                            node,
                            message: 'expect.soft() lets the test continue after a failure; use expect().',
                        });
                    }
                },
            };
        },
    },
    'no-conditional-logic': {
        meta: {type: 'problem', schema: []},
        create(context) {
            const check = (node) => {
                if (containsAwait(node.test)) {
                    context.report({
                        node: node.test,
                        message:
                            'Branching on awaited page state hides which path the test took; set the state up and assert it.',
                    });
                }
            };
            return {IfStatement: check, ConditionalExpression: check};
        },
    },
    'no-locator-action': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    const callee = unwrap(node.callee);
                    const target = callee.type === 'MemberExpression' ? unwrap(callee.object) : undefined;
                    if (
                        ACTION_METHODS.has(methodName(node)) &&
                        target?.type === 'MemberExpression' &&
                        !target.computed &&
                        target.property.name === 'locator'
                    ) {
                        context.report({
                            node,
                            message: `Act through the driver (\`x.${methodName(node)}()\`), not its raw \`.locator\`; the driver checks role semantics and state.`,
                        });
                    }
                },
            };
        },
    },
    'disable-reason': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                Program() {
                    for (const comment of context.sourceCode.getAllComments()) {
                        const match = DISABLE_COMMENT.exec(comment.value);
                        if (!match) {
                            continue;
                        }
                        const [rulesPart = '', reason] = (match[1] ?? '').split(/\s--\s/);
                        if (!rulesPart.trim()) {
                            context.report({
                                loc: comment.loc,
                                message:
                                    'Name the rule being disabled; a bare eslint-disable silences every spec rule.',
                            });
                        } else if (rulesPart.includes('ui-surface/') && !reason?.trim()) {
                            context.report({
                                loc: comment.loc,
                                message: 'Give a reason after ` -- ` when disabling a ui-surface rule.',
                            });
                        }
                    }
                },
            };
        },
    },
};

export default {rules};
