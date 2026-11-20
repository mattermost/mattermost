// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Specs act through the drivers of the generated page objects (`composer.sendButton.click()`), not through their raw
// Playwright locator (`composer.sendButton.locator.click()`): the driver is where waiting, the action rules and the
// error metadata live. A call through `.locator` is reported when the driver it belongs to offers the same action, so a
// part whose driver has no such verb (a role-free row clicked through its locator) is left to a stated reason. Every
// driver's `click` takes Playwright's click options (`{button: 'right'}`, `{modifiers: ['Alt']}`), so a click with options
// is reported too; other verbs take none, so another action passing an options object (`hover({force: true})`) is left.
import {classifier, unwrap} from './actions.js';

/** For each Playwright locator action, the driver verbs that do it, in the order a message suggests them. */
const DRIVER_VERBS = {
    click: ['click', 'select'],
    hover: ['hover'],
    press: ['press'],
    focus: ['focus'],
    blur: ['blur'],
    fill: ['fill'],
    clear: ['clear'],
    type: ['type'],
    pressSequentially: ['type'],
    check: ['check'],
    uncheck: ['uncheck'],
    setChecked: ['set'],
    selectOption: ['choose'],
};

export default {
    meta: {
        type: 'suggestion',
        docs: {description: 'Act through the generated drivers (x.click()), not their raw locator (x.locator.click())'},
        schema: [],
        messages: {
            driver: 'Act through the driver: `{{receiver}}.{{verb}}(…)`, not `{{receiver}}.locator.{{action}}(…)`.',
        },
    },
    create(context) {
        const {driverVerb} = classifier(context);
        return {
            CallExpression(node) {
                const callee = unwrap(node.callee);
                if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') {
                    return;
                }
                const verbs = Object.hasOwn(DRIVER_VERBS, callee.property.name) ? DRIVER_VERBS[callee.property.name] : null;
                const locator = verbs && unwrap(callee.object);
                if (!locator || locator.type !== 'MemberExpression' || locator.computed || locator.property.type !== 'Identifier' || locator.property.name !== 'locator') {
                    return;
                }
                const options = node.arguments.some((argument) => unwrap(argument).type === 'ObjectExpression');
                if (options && callee.property.name !== 'click') {
                    return;
                }
                const driver = unwrap(locator.object);
                const verb = driverVerb(driver, options ? ['click'] : verbs);
                if (verb) {
                    context.report({node, messageId: 'driver', data: {receiver: context.sourceCode.getText(driver), verb, action: callee.property.name}});
                }
            },
        };
    },
};
