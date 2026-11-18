// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// An action, or an assertion that returns a promise, is awaited, returned, or an element of the one accepted
// `Promise.all([<waiters>, <one action>])` that is itself awaited or returned. `d.click();`, `void d.click()` and
// `expect(x).toBeVisible();` are errors; a synchronous `expect(value).toBe(...)` is not. A `settle(...)` is called on
// the spot (`settle(d, {wait}).click()`): storing it or reading its verb off hides the action from both rules.
import {classifier, isAssertionPromise, unwrap, usedBy} from './actions.js';

export default {
    meta: {
        type: 'problem',
        docs: {description: 'Await every action and every retrying assertion'},
        schema: [],
        messages: {
            action: 'await `{{text}}`: an action that is not awaited runs past the next line.',
            settled: 'call the verb on `settle(...)` directly (`await settle(d, {wait}).click()`): a stored or passed settle hides its action.',
            assertion: 'await `{{text}}`: a retrying assertion that is not awaited checks nothing.',
        },
    },
    create(context) {
        const {actionOf, compositionOf, isDetachedSettle} = classifier(context);

        const handled = (node) => {
            const {child, parent} = usedBy(node);
            if (!parent) {
                return false;
            }
            if (parent.type === 'AwaitExpression' || parent.type === 'ReturnStatement') {
                return true;
            }
            if (parent.type === 'ArrowFunctionExpression' && parent.body === child) {
                return true;
            }
            if (parent.type === 'ArrayExpression') {
                const combinator = usedBy(parent).parent;
                return combinator?.type === 'CallExpression' && Boolean(compositionOf(combinator)?.accepted) && handled(combinator);
            }
            return false;
        };

        const text = (node) => {
            const source = context.sourceCode.getText(unwrap(node.callee)).replace(/\s+/g, ' ');
            return `${source.length > 60 ? `…${source.slice(-59)}` : source}()`;
        };

        return {
            CallExpression(node) {
                if (isDetachedSettle(node)) {
                    context.report({node, messageId: 'settled'});
                    return;
                }
                const kind = (isAssertionPromise(node) && 'assertion') || (actionOf(node) && 'action');
                if (kind && !handled(node)) {
                    context.report({node, messageId: kind, data: {text: text(node)}});
                }
            },
        };
    },
};
